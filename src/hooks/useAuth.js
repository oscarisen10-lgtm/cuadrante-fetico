import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { markFirestoreAlive } from '../firebase';
import {
  subscribeToAuth,
  subscribeToUserDoc,
  subscribeToShiftMonths,
  subscribeToDelegado,
  saveUserData,
  saveShiftsBatch,
  deleteShiftsBatch,
  migrateShiftsToMonths,
  logoutUser,
  ensureUserDoc,
  recordAppOpen
} from '../services/firebaseService';
import { toast } from '../services/toastBus';

// Cada cuánto se refresca el sello de "última actividad". Con 12h, el contador de
// usuarios activos de los últimos 7 días es exacto a nivel de día y cada usuario
// escribe como mucho dos veces al día, no una por cada apertura de la app.
const ACTIVITY_STAMP_TTL_MS = 12 * 60 * 60 * 1000;

// Compara dos objetos "user" a nivel superficial. Evita crear una referencia
// nueva (y disparar re-renders en cascada en vistas memoizadas y en useShifts)
// cuando el perfil llega igual en un nuevo snapshot del documento.
// Los arrays de primitivos (profile.fcmTokens) se comparan por CONTENIDO: Firestore
// construye uno nuevo en cada snapshot, así que con === el perfil salía distinto
// siempre y la memoización de aquí abajo no servía de nada.
const mismoValor = (x, y) => {
  if (x === y) return true;
  if (Array.isArray(x) && Array.isArray(y)) {
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  return false;
};

const shallowEqualUser = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => mismoValor(a[k], b[k]));
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sistema de delegados: cuenta activada (membership AUSENTE = usuario anterior
  // al sistema → activo) y doc de delegado (null si este usuario no lo es).
  const [isActive, setIsActive] = useState(true);
  const [delegado, setDelegado] = useState(null);

  // App State managed in the cloud
  const [settings, setSettings] = useState({ notifications: true, breakDuration: 15 });
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [workTimeAccumulated, setWorkTimeAccumulated] = useState(0);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);

  // Keep a mutable ref of shifts to prevent saveToCloud from recreating on every change of shifts.
  // This avoids render cascades in child components receiving saveToCloud as prop.
  const shiftsRef = useRef(shifts);
  useEffect(() => {
    shiftsRef.current = shifts;
  }, [shifts]);

  // Migración al modelo mensual de turnos: como mucho UNA vez por sesión (el
  // marcador shiftsMonthlyMigratedAt del perfil evita repetirla entre sesiones).
  const migrationStartedRef = useRef(false);

  // Custom claim de admin, leído del token de Auth (ver isAdminUser en config.js).
  // En un ref porque el snapshot del perfil, que se dispara muchas veces, tiene que
  // poder reinyectarlo en el objeto `user` sin volver a pedir el token.
  const adminClaimRef = useRef(false);

  useEffect(() => {
    let unsubUserDoc = null;
    let unsubShifts = null;
    let unsubDelegado = null;

    // Safety timeout: if loading doesn't resolve in 10s, force it.
    // This covers the edge case where onSnapshot never fires on first
    // install under restrictive networks (e.g. Apple Review IPv6-only).
    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('Safety timeout: forcing loading=false after 10s');
        }
        return false;
      });
    }, 10000);

    const unsubAuth = subscribeToAuth((firebaseUser) => {
      if (firebaseUser) {
        let snapshotFired = false;

        // ¿Es admin? Va por CUSTOM CLAIM, que llega firmado dentro del token de Auth
        // (antes se deducía comparando profile.email con VITE_ADMIN_EMAIL, y ese campo
        // lo puede reescribir el propio usuario → cualquiera se abría el panel de admin).
        // Es asíncrono, así que se guarda en un ref y se reinyecta en el user cuando
        // llega: mientras tanto, isAdminClaim es false, que es el valor seguro.
        firebaseUser.getIdTokenResult()
          .then((res) => {
            adminClaimRef.current = res?.claims?.admin === true;
            setUser((prev) => (
              prev && prev.isAdminClaim !== adminClaimRef.current
                ? { ...prev, isAdminClaim: adminClaimRef.current }
                : prev
            ));
          })
          .catch((e) => console.warn("No se pudo leer el claim de admin:", e?.message));

        const docTimeout = setTimeout(() => {
          if (!snapshotFired) {
            console.error("Firestore timeout: No se recibió perfil de usuario a tiempo.");
            toast("Error de conexión con la base de datos. Reinicia la app.", "error");
            setLoading(false);
          }
        }, 12000);

        unsubUserDoc = subscribeToUserDoc(firebaseUser.uid, (docSnap) => {
          snapshotFired = true;
          clearTimeout(safetyTimeout);
          clearTimeout(docTimeout);
          // Firestore ha respondido: desarma la red de seguridad de la caché
          // persistente de iOS (ver firebase.js).
          markFirestoreAlive();
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Analítica (admin): plataforma + versión, y/o sello de actividad, cada uno
            // SOLO si hace falta respecto a lo guardado — y las dos en la MISMA escritura
            // si ambas hacen falta a la vez (típico el día que sale una versión nueva).
            // Al escribir, el propio onSnapshot vuelve a disparar ya con los valores
            // nuevos → las condiciones se vuelven falsas y no hay bucle de escrituras.
            const currentPlatform = Capacitor.getPlatform();
            const analyticsFields = {};
            if (data.profile && (data.profile.platform !== currentPlatform || data.profile.appVersion !== __APP_VERSION__)) {
              analyticsFields["profile.platform"] = currentPlatform;
              analyticsFields["profile.appVersion"] = __APP_VERSION__;
            }
            if (data.profile && Date.now() - (data.profile.lastActiveAt || 0) > ACTIVITY_STAMP_TTL_MS) {
              analyticsFields["profile.lastActiveAt"] = Date.now();
            }
            if (Object.keys(analyticsFields).length > 0) {
              recordAppOpen(firebaseUser.uid, analyticsFields);
            }
            // Migración única al modelo mensual de turnos (usuarios con datos del
            // modelo diario). Al terminar escribe el marcador en el perfil, y la
            // suscripción a shiftMonths (ya viva) recoge los meses recién creados.
            if (!data.shiftsMonthlyMigratedAt && !migrationStartedRef.current) {
              migrationStartedRef.current = true;
              migrateShiftsToMonths(firebaseUser.uid)
                .catch((e) => console.error("Migración de turnos a modelo mensual falló:", e?.message));
            }
            setUser((prev) => {
              const next = { ...data.profile, uid: firebaseUser.uid, isAdminClaim: adminClaimRef.current };
              return shallowEqualUser(prev, next) ? prev : next;
            });
            // membership ausente = cuenta anterior al sistema de delegados → activa.
            setIsActive(!data.membership || data.membership.active === true);
            setSettings(data.settings || { notifications: true, breakDuration: 15 });
            setActiveShift(data.activeShift || null);
            setWorkTimeAccumulated(data.workTimeAccumulated || 0);
            setIsBreakActive(data.isBreakActive || false);
            setBreakStartTime(data.breakStartTime || null);
          } else {
             console.warn("User doc doesn't exist for authenticated user — auto-reparando en Firestore");
             // Auto-reparación de "huérfano": el usuario está autenticado pero no tiene
             // documento (registro a medias, doc borrado, etc.). Lo creamos en Firestore;
             // como la suscripción onSnapshot sigue viva, al crearse volverá a dispararse
             // con exists()=true y cargará el perfil real. Mientras, perfil local instantáneo.
             ensureUserDoc(firebaseUser).catch((e) => console.error("Auto-reparación de doc falló:", e?.message));
             setUser({
               uid: firebaseUser.uid,
               email: firebaseUser.email || "usuario@ejemplo.com",
               fullName: firebaseUser.displayName || "Compañero/a",
               company: "Supercor",
               store: "Centro sin definir",
               rank: "Personal base"
             });
             setSettings({ notifications: true, breakDuration: 15 });
          }
          setLoading(false);
        }, (error) => {
          snapshotFired = true;
          clearTimeout(safetyTimeout);
          clearTimeout(docTimeout);
          // Un error también es una RESPUESTA: Firestore está vivo (el cuelgue
          // de WKWebView se caracteriza por no responder nada en absoluto).
          markFirestoreAlive();
          console.error("Error al cargar perfil de usuario:", error);
          toast("Error al cargar datos: " + error.message, "error");
          setLoading(false);
        });

        // Ventana de turnos: últimos 12 MESES RODANTES sobre el modelo MENSUAL
        // (users/{uid}/shiftMonths): cargar la ventana entera son 12-13 lecturas,
        // frente a las ~365 del modelo diario anterior. Cubre el año en curso
        // completo (lo único que usan las estadísticas del convenio) y el
        // calendario puede navegar hasta un año atrás.
        const sinceDate = new Date();
        sinceDate.setFullYear(sinceDate.getFullYear() - 1);
        const sinceMonth = `${sinceDate.getFullYear()}-${String(sinceDate.getMonth() + 1).padStart(2, '0')}`;
        unsubShifts = subscribeToShiftMonths(firebaseUser.uid, (shiftsArr) => {
          setShifts(shiftsArr);
        }, (error) => {
          console.error("Error al cargar turnos:", error);
        }, sinceMonth);

        // ¿Es delegado? Suscripción a su propio doc delegados/{uid} (si no existe,
        // devuelve null y no se muestra la pestaña). El admin lo crea/borra en vivo.
        unsubDelegado = subscribeToDelegado(firebaseUser.uid, setDelegado);

      } else {
        clearTimeout(safetyTimeout);
        // Sin sesión no se usa Firestore: no dejes armado el marcador de arranque
        // (evita un falso positivo que desactivaría la caché sin motivo).
        markFirestoreAlive();
        if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }
        if (unsubShifts) { unsubShifts(); unsubShifts = null; }
        if (unsubDelegado) { unsubDelegado(); unsubDelegado = null; }
        setUser(null);
        setShifts([]);
        setIsActive(true);
        setDelegado(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubShifts) unsubShifts();
      if (unsubDelegado) unsubDelegado();
    };
  }, []);

  const saveToCloud = useCallback(async (updates) => {
    if (!user?.uid) return;
    
    try {
      // Handle shifts separately — they go to subcollection now
      if (updates.shifts !== undefined) {
        const newShifts = updates.shifts;
        // Índice fecha -> turno anterior. Antes esto era un find() lineal DENTRO
        // del filter() de abajo, o sea O(n²) sobre la ventana de 12 meses de turnos
        // (cientos de días). Con el Map se recorre una vez: O(n).
        const previousByDate = new Map(shiftsRef.current.map(s => [s.date, s]));
        const newDates = new Set(newShifts.map(s => s.date));

        // Find shifts to delete (in old but not in new). Las claves del Map ya son
        // únicas, igual que el Set que había antes.
        const datesToDelete = [...previousByDate.keys()].filter(d => !newDates.has(d));

        // Find shifts to save (in new but different or not in old)
        const shiftsToSave = newShifts.filter(s => {
          const existing = previousByDate.get(s.date);
          if (!existing) return true;
          return JSON.stringify(existing) !== JSON.stringify(s);
        });
        
        // Batch operations
        if (datesToDelete.length > 0) await deleteShiftsBatch(user.uid, datesToDelete);
        if (shiftsToSave.length > 0) await saveShiftsBatch(user.uid, shiftsToSave);
        
        // Remove shifts from the updates object so it doesn't go to user doc
        delete updates.shifts;
      }
      
      // Update local state optimistically for non-shift fields
      if (updates.profile !== undefined) setUser((prev) => ({ ...prev, ...updates.profile }));
      if (updates.settings !== undefined) setSettings(updates.settings);
      if (updates.activeShift !== undefined) setActiveShift(updates.activeShift);
      if (updates.workTimeAccumulated !== undefined) setWorkTimeAccumulated(updates.workTimeAccumulated);
      if (updates.isBreakActive !== undefined) setIsBreakActive(updates.isBreakActive);
      if (updates.breakStartTime !== undefined) setBreakStartTime(updates.breakStartTime);

      if (Object.keys(updates).length > 0) {
        await saveUserData(updates);
      }
    } catch (error) {
      console.error("Error guardando datos:", error);
      toast("Error de red o permisos al guardar: " + error.message, "error");
      throw error; // Re-throw so caller knows it failed
    }
  }, [user?.uid]);

  // Refleja EN LOCAL un cambio de perfil que ya ha aplicado el SERVIDOR y que el
  // cliente no puede escribir por sí mismo (la tienda: ver cambiarMiTienda). El
  // onSnapshot acabará trayendo lo mismo, pero mientras tanto la pantalla se
  // quedaba con el valor viejo — de ahí la sensación de que el cambio de empresa
  // "no ocurre" hasta cerrar y reabrir la app. NO escribe nada en Firestore.
  const applyProfileLocally = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  return {
    user, loading, logoutUser, saveToCloud, applyProfileLocally,
    isActive, delegado,
    settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime
  };
};
