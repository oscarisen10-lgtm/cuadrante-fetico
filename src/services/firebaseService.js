import { auth, db, functions } from '../firebase';
import { httpsCallable } from "firebase/functions";
import {
  onAuthStateChanged, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail
} from "firebase/auth";
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, collection, addDoc, deleteDoc,
  query, getDocs, writeBatch, orderBy, where, limit, deleteField
} from "firebase/firestore";

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve/reject
 * within `ms` milliseconds, it rejects with a timeout error.
 * Prevents the app from hanging indefinitely if Firestore operations stall.
 */
const withTimeout = (promise, ms = 15000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: la operación tardó demasiado. Comprueba tu conexión.')), ms)
    ),
  ]);

/**
 * Ejecuta operaciones en lotes de como máximo `size` (Firestore limita los batch
 * a 500 por commit). Evita que un usuario con muchos turnos (2 años ≈ cientos de
 * documentos) rompa el borrado de cuenta o el guardado masivo.
 */
const commitInChunks = async (items, apply, size = 450) => {
  for (let i = 0; i < items.length; i += size) {
    const batch = writeBatch(db);
    items.slice(i, i + size).forEach((item) => apply(batch, item));
    await batch.commit();
  }
};

// --- AUTH & USER ---

export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const subscribeToUserDoc = (uid, callback, onError) => {
  return onSnapshot(doc(db, "users", uid), callback, onError);
};

// ── TURNOS: MODELO MENSUAL (v2) ──────────────────────────────────────────────
// Antes: un documento POR DÍA en users/{uid}/shifts/{YYYY-MM-DD} → cargar la
// ventana de 12 meses costaba ~365 lecturas en cada arranque en frío (en iOS,
// con caché en memoria, eso es CADA apertura de la app: el mayor coste de toda
// la factura de Firestore y varios segundos de espera).
// Ahora: un documento POR MES en users/{uid}/shiftMonths/{YYYY-MM} con un mapa
// days { "DD": { type, hours, isHA, turn } } → la misma ventana son 12-13
// lecturas (~30 veces menos). La app se migra sola la primera vez (ver
// migrateShiftsToMonths) y, mientras queden builds antiguas instaladas que leen
// el modelo diario, seguimos escribiendo TAMBIÉN los docs diarios (dual-write).
// Cuando las builds antiguas mueran, poner LEGACY_SHIFTS_DUAL_WRITE en false.
const LEGACY_SHIFTS_DUAL_WRITE = true;

// Normaliza un turno para guardarlo dentro del mapa days del doc mensual
// (sin date ni id: la fecha es la clave, y el id del cliente no aporta nada).
const cleanShiftData = (s) => ({
  type: s.type || 'work',
  hours: typeof s.hours === 'number' ? s.hours : 0,
  isHA: !!s.isHA,
  ...(s.turn ? { turn: s.turn } : {}),
});

// Agrupa una lista de turnos (o fechas) por mes: { 'YYYY-MM': { 'DD': valor } }.
const groupByMonth = (items, valueOf) => {
  const byMonth = {};
  items.forEach((item) => {
    const date = typeof item === 'string' ? item : item.date;
    if (!date || typeof date !== 'string' || date.length < 10) return;
    const month = date.slice(0, 7);
    const day = date.slice(8, 10);
    if (!byMonth[month]) byMonth[month] = {};
    byMonth[month][day] = valueOf(item);
  });
  return byMonth;
};

/**
 * Suscripción a los turnos (modelo mensual). Devuelve al callback un array plano
 * [{ date: 'YYYY-MM-DD', type, hours, isHA, turn }] idéntico al del modelo
 * antiguo, así que el resto de la app (stats, calendario) no cambia.
 * sinceMonth ('YYYY-MM') acota la ventana de lectura.
 */
export const subscribeToShiftMonths = (uid, callback, onError, sinceMonth) => {
  const monthsRef = collection(db, "users", uid, "shiftMonths");
  const q = sinceMonth ? query(monthsRef, where("month", ">=", sinceMonth)) : monthsRef;
  return onSnapshot(q, (snapshot) => {
    const arr = [];
    snapshot.docs.forEach((docSnap) => {
      const { month, days } = docSnap.data() || {};
      if (!month || !days) return;
      Object.keys(days).forEach((dd) => {
        arr.push({ date: `${month}-${dd}`, ...days[dd] });
      });
    });
    callback(arr);
  }, onError);
};

/** Guarda turnos en los docs mensuales (merge por día: no pisa el resto del mes). */
const saveShiftMonthsBatch = async (uid, shiftsArray) => {
  if (!uid || !shiftsArray.length) return;
  const byMonth = groupByMonth(shiftsArray.filter((s) => s.date), cleanShiftData);
  await commitInChunks(Object.entries(byMonth), (batch, [month, days]) => {
    batch.set(doc(db, "users", uid, "shiftMonths", month), { month, days }, { merge: true });
  });
};

/** Borra días concretos de los docs mensuales (deleteField sobre days.DD). */
const deleteShiftMonthDays = async (uid, dateStrings) => {
  if (!uid || !dateStrings.length) return;
  const byMonth = groupByMonth(dateStrings, () => deleteField());
  await commitInChunks(Object.entries(byMonth), (batch, [month, days]) => {
    batch.set(doc(db, "users", uid, "shiftMonths", month), { month, days }, { merge: true });
  });
};

/** Modelo diario antiguo — solo para el dual-write de compatibilidad. */
const saveShiftsBatchLegacy = async (uid, shiftsArray) => {
  if (!uid || !shiftsArray.length) return;
  const valid = shiftsArray.filter((s) => s.date);
  await commitInChunks(valid, (batch, shift) => {
    batch.set(doc(db, "users", uid, "shifts", shift.date), shift, { merge: true });
  });
};

const deleteShiftsBatchLegacy = async (uid, dateStrings) => {
  if (!uid || !dateStrings.length) return;
  await commitInChunks(dateStrings, (batch, dateStr) => {
    batch.delete(doc(db, "users", uid, "shifts", dateStr));
  });
};

/** Punto de entrada único de escritura de turnos: mensual + diario (compat). */
export const saveShiftsBatch = async (uid, shiftsArray) => {
  await saveShiftMonthsBatch(uid, shiftsArray);
  if (LEGACY_SHIFTS_DUAL_WRITE) await saveShiftsBatchLegacy(uid, shiftsArray);
};

/** Punto de entrada único de borrado de turnos: mensual + diario (compat). */
export const deleteShiftsBatch = async (uid, dateStrings) => {
  await deleteShiftMonthDays(uid, dateStrings);
  if (LEGACY_SHIFTS_DUAL_WRITE) await deleteShiftsBatchLegacy(uid, dateStrings);
};

/**
 * Migración ÚNICA por usuario al modelo mensual: lee los docs diarios (una sola
 * vez, el mismo coste que tenía UNA carga del calendario), los agrupa por mes y
 * marca el perfil con shiftsMonthlyMigratedAt para no repetirla. Es idempotente
 * (re-ejecutarla escribe los mismos datos), así que una carrera entre dos
 * dispositivos es inofensiva. Los docs diarios NO se borran: las builds antiguas
 * siguen leyéndolos hasta que se retire el dual-write.
 */
export const migrateShiftsToMonths = async (uid) => {
  if (!uid) return 0;
  // No-destructiva: si un día YA existe en el modelo mensual (p.ej. el usuario
  // editó el calendario en los segundos que tarda esta migración), ese valor
  // fresco GANA y la migración no lo pisa con el dato antiguo del modelo diario.
  const [dailySnap, monthlySnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "shifts")),
    getDocs(collection(db, "users", uid, "shiftMonths")),
  ]);
  const alreadyMonthly = new Set();
  monthlySnap.docs.forEach((m) => {
    const { month, days } = m.data() || {};
    if (month && days) Object.keys(days).forEach((dd) => alreadyMonthly.add(`${month}-${dd}`));
  });
  const shifts = dailySnap.docs
    .map((d) => d.data())
    .filter((s) => s && s.date && !alreadyMonthly.has(s.date));
  if (shifts.length > 0) {
    await saveShiftMonthsBatch(uid, shifts);
  }
  await setDoc(doc(db, "users", uid), { shiftsMonthlyMigratedAt: Date.now() }, { merge: true });
  console.log(`Turnos migrados al modelo mensual: ${shifts.length} días para ${uid}`);
  return shifts.length;
};

export const loginUser = async (email, password) => {
  const res = await withTimeout(signInWithEmailAndPassword(auth, email, password));
  // Auto-reparación: si el doc de Firestore no existe (registro a medias, doc borrado…),
  // lo creamos para que el usuario deje de ser "huérfano" (Auth sin documento).
  await ensureUserDoc(res.user).catch((e) => console.error('ensureUserDoc (login):', e?.message));
  return res;
};

export const registerUser = async (email, password, profileData) => {
  const res = await withTimeout(createUserWithEmailAndPassword(auth, email, password));

  await withTimeout(setDoc(doc(db, "users", res.user.uid), {
    profile: {
      ...profileData,
      section: profileData.section || "Sin especificar"
    },
    // Las cuentas nuevas nacen DESACTIVADAS (solo noticias) hasta que un delegado
    // de FETICO las active. Las reglas de Firestore EXIGEN este campo en el alta;
    // solo el backend (delegadoSetActive) puede cambiarlo después.
    membership: { active: false, createdAt: Date.now() },
    settings: { notifications: true, breakDuration: 15 },
    shifts: [],
    // Las cuentas nuevas nacen ya en el modelo mensual de turnos: no hay nada que migrar.
    shiftsMonthlyMigratedAt: Date.now(),
    activeShift: null,
    workTimeAccumulated: 0,
    isBreakActive: false,
    breakStartTime: null
  }));

  return res;
};

// Crea el documento users/{uid} si no existe (auto-reparación de "huérfanos":
// cuentas de Auth sin documento en Firestore). Se usa en login email, Google y Apple,
// y al arrancar la sesión desde useAuth. Si el doc ya existe, no hace nada.
export const ensureUserDoc = async (user) => {
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  if (!userDoc.exists()) {
    await setDoc(userDocRef, {
      profile: {
        email: user.email,
        fullName: user.displayName || 'Compañero/a',
        company: "Supercor",
        store: "Centro sin definir",
        rank: "Personal base",
        section: "Sin especificar"
      },
      // Igual que en el registro: toda cuenta creada desde cero nace desactivada
      // (lo exigen las reglas); un delegado la activará al verificar la afiliación.
      membership: { active: false, createdAt: Date.now() },
      settings: { notifications: true, breakDuration: 15 },
      shifts: [],
      // Cuenta creada desde cero: nace en el modelo mensual, sin migración pendiente.
      shiftsMonthlyMigratedAt: Date.now(),
      activeShift: null,
      workTimeAccumulated: 0,
      isBreakActive: false,
      breakStartTime: null
    });
  }
};

export const resetPassword = async (email) => {
  return await sendPasswordResetEmail(auth, email);
};

export const logoutUser = async () => {
  return await signOut(auth);
};

export const deleteUserAccount = async () => {
  if (!auth.currentUser) return;
  // El borrado lo hace el SERVIDOR (Admin SDK): elimina perfil, turnos, cuota, peticiones
  // y la cuenta de Auth de forma consistente, sin el fallo "requires-recent-login" ni
  // dejar datos huérfanos. Ver Cloud Function `deleteMyAccount`.
  const fn = httpsCallable(functions, 'deleteMyAccount');
  await fn();
  // Cerramos sesión localmente para que la app vuelva al login de inmediato.
  await signOut(auth).catch(() => {});
};

export const saveUserData = async (updates) => {
  if (auth.currentUser) {
    await setDoc(doc(db, "users", auth.currentUser.uid), updates, { merge: true });
  }
};

// --- ANALÍTICA (admin) ---

/**
 * Registra en el perfil, en UNA sola escritura, lo que haya cambiado desde el último
 * snapshot: plataforma (ios/android/web) + versión de la app, y/o el sello de "última
 * actividad" (para contar usuarios activos en los últimos días). Quien llama decide qué
 * incluir en `fields` — así el día que sale una versión nueva, cuando casi todo el mundo
 * dispara a la vez el cambio de versión Y el sello de actividad caducado, es una escritura
 * y no dos. Mejor esfuerzo: si falla, no molesta al usuario.
 */
export const recordAppOpen = async (uid, fields) => {
  try {
    await updateDoc(doc(db, "users", uid), fields);
  } catch (e) {
    console.warn("recordAppOpen:", e?.message);
  }
};

/**
 * Marca que el usuario ha usado el apartado "Fichar" (para medir su uso real). Se llama al
 * iniciar un turno. Mejor esfuerzo: no bloquea el fichaje si falla.
 */
export const markFichado = async (uid) => {
  try {
    await updateDoc(doc(db, "users", uid), {
      "profile.hasFichado": true,
      "profile.lastFichar": Date.now(),
    });
  } catch (e) {
    console.warn("markFichado:", e?.message);
  }
};

/**
 * Estadísticas agregadas para el admin (recuentos, sin datos personales).
 * El backend cachea el resultado unos minutos porque recorre la colección de
 * usuarios entera; `refresh: true` fuerza el recálculo (botón de recargar).
 */
export const fetchAdminStats = async ({ refresh = false } = {}) => {
  const fn = httpsCallable(functions, 'adminStats');
  const { data } = await fn({ refresh });
  return data;
};

// --- DELEGADOS (activación de cuentas por tienda) ---

/**
 * Suscripción al doc delegados/{uid} del propio usuario: si existe (y está
 * activo), la app le muestra la pestaña "Delegados" con sus tiendas autorizadas.
 * Las reglas solo permiten leer el doc propio, así que esto no expone nada.
 */
export const subscribeToDelegado = (uid, callback) => {
  return onSnapshot(
    doc(db, "delegados", uid),
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      callback(data && data.active !== false ? data : null);
    },
    () => callback(null)
  );
};

/** Usuarios de una tienda (vía backend; valida que el delegado la tenga autorizada). */
export const fetchStoreUsers = async (store) => {
  const fn = httpsCallable(functions, 'delegadoListUsers');
  const { data } = await fn({ store });
  return data.users || [];
};

/** Activa/desactiva la cuenta de un usuario (delegado con tienda autorizada, o admin). */
export const setUserActiveStatus = async (uid, active) => {
  const fn = httpsCallable(functions, 'delegadoSetActive');
  const { data } = await fn({ uid, active });
  return data;
};

/**
 * Expulsa a un usuario que se fue de la empresa (desaparece de las listas y
 * del censo del delegado) o lo readmite. NO borra nada: su cuenta queda activa
 * por si quiere seguir usando la app.
 */
export const setUserExpelled = async (uid, expelled) => {
  const fn = httpsCallable(functions, 'delegadoExpelUser');
  const { data } = await fn({ uid, expelled });
  return data;
};

// --- CENSO (delegados) ---

/**
 * Recuentos de usuarios/activos por tienda para el Censo. El backend usa
 * consultas de agregación count(): 2 lecturas por tienda, dé igual cuántos
 * usuarios tenga. Devuelve { "PINEA": { users, activos }, ... }.
 */
export const fetchCensusCounts = async () => {
  const fn = httpsCallable(functions, 'delegadoCensusCounts');
  const { data } = await fn();
  return data.counts || {};
};

/**
 * Censo del delegado: UN doc (censos/{uid}) con los futuros usuarios apuntados
 * a mano, por tienda. 1 lectura carga todo; 1 escritura guarda cualquier cambio.
 */
export const getCenso = async (uid) => {
  const snap = await getDoc(doc(db, "censos", uid));
  return snap.exists() ? (snap.data().prospects || {}) : {};
};

export const saveCenso = async (uid, prospects) => {
  await setDoc(doc(db, "censos", uid), { prospects, updatedAt: Date.now() });
};

/** SOLO admin: nombra un delegado ({ email, stores }) o lo retira ({ email, remove: true }). */
export const saveDelegado = async (payload) => {
  const fn = httpsCallable(functions, 'adminSetDelegado');
  const { data } = await fn(payload);
  return data;
};

/**
 * SOLO admin: totales (activos, pendientes, push) y delegados con sus recuentos.
 * Cacheado en el backend unos minutos (recorre la colección de usuarios entera);
 * `refresh: true` fuerza el recálculo desde el botón de recargar del panel.
 */
export const fetchAdminOverview = async ({ refresh = false } = {}) => {
  const fn = httpsCallable(functions, 'adminOverview');
  const { data } = await fn({ refresh });
  return data;
};

/**
 * Suscribe un token FCM WEB al topic de noticias, vía backend (el SDK web no puede
 * suscribirse a topics por sí mismo). Los clientes nativos usan el plugin FCM directo.
 * Idempotente: se llama en cada arranque con permiso concedido.
 */
export const subscribeTokenToNewsTopic = async (token) => {
  const fn = httpsCallable(functions, 'subscribeToNewsTopic');
  return fn({ token });
};

// --- NOTICIAS ---

export const subscribeToNews = (callback) => {
  // Ordenado y acotado en servidor: evita descargar toda la colección (que crece sin
  // límite) y re-ordenarla en el cliente en cada cambio. Requiere que cada noticia
  // tenga `createdAt` (el alta siempre lo añade).
  const q = query(collection(db, "noticias"), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(q, (snapshot) => {
    const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(arr);
  });
};

export const addNews = async (newsData) => {
  return await addDoc(collection(db, "noticias"), newsData);
};

export const deleteNews = async (id) => {
  return await deleteDoc(doc(db, "noticias", id));
};

// --- NOTICIAS DE DELEGADO (noticiasTienda) ---
// Colección SEPARADA de las noticias globales: cada doc lleva stores[] con las
// tiendas destino y las reglas solo dejan leer a los usuarios de esas tiendas
// (y al autor/admin). Las builds antiguas no leen esta colección: no les
// aparece el feed, pero el push dirigido sí les llega (va por token directo).

/** Feed del usuario: noticias de delegado dirigidas a SU tienda. */
export const subscribeToStoreNews = (store, callback) => {
  if (!store) { callback([]); return () => {}; }
  const q = query(
    collection(db, "noticiasTienda"),
    where("stores", "array-contains", store),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    // Índice aún construyéndose o sin permisos: el feed global sigue funcionando.
    (error) => { console.warn("subscribeToStoreNews:", error?.message); callback([]); }
  );
};

/** Noticias publicadas por el propio delegado (para su pestaña Noticias). */
export const subscribeToMyStoreNews = (uid, callback) => {
  const q = query(
    collection(db, "noticiasTienda"),
    where("authorUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => { console.warn("subscribeToMyStoreNews:", error?.message); callback([]); }
  );
};

/** Publica una noticia de delegado. Con sendPush:true, el backend la envía por
 *  push SOLO a los usuarios de las tiendas destino (ver sendStoreNews). */
export const addStoreNews = async (newsData) => {
  return await addDoc(collection(db, "noticiasTienda"), newsData);
};

export const deleteStoreNews = async (id) => {
  return await deleteDoc(doc(db, "noticiasTienda", id));
};

// --- LICENCIAS ---
// (La colección `licencias` de Firestore ya no se usa: el contenido de permisos se
// sirve estático desde constants/licenciasData.js. Se eliminaron subscribeToLicencias,
// addLicencia, updateLicencia y deleteLicencia por ser código muerto.)

// --- PETICIONES / EQUIPO ---
// Eliminado (28-jul-2026): el flujo de "pedir día libre" y la callable teamStatus
// (que servía para el límite de responsables y para que el coordinador viera las
// peticiones) se retiraron por completo. No se implementará. La colección `requests`
// se conserva solo por las peticiones que dejaran las builds antiguas; deleteMyAccount
// sigue limpiándola. Ver historial git para el código anterior.

// --- ARENA / COMPETICIÓN ---
// Eliminada del proyecto (17-jul-2026): se quitaron los 31 minijuegos, la vista,
// la función submitArenaScore, las reglas de leaderboards y las dependencias 3D
// (three/@react-three). La colección leaderboards se purgó de Firestore.
