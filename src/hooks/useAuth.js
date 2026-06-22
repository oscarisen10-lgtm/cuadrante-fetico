import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  subscribeToAuth, 
  subscribeToUserDoc, 
  subscribeToShifts,
  saveUserData,
  saveShiftsBatch,
  deleteShiftsBatch,
  logoutUser,
  ensureUserDoc
} from '../services/firebaseService';
import { toast } from '../components/Toast';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
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

  useEffect(() => {
    let unsubUserDoc = null;
    let unsubShifts = null;

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
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({ ...data.profile, uid: firebaseUser.uid });
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
          console.error("Error al cargar perfil de usuario:", error);
          toast("Error al cargar datos: " + error.message, "error");
          setLoading(false);
        });

        // Ventana de turnos: solo desde el 1 de enero del año pasado en adelante.
        // Acota las lecturas de Firestore y evita que crezcan sin límite con los años.
        // (Cubre todo el historial de los usuarios actuales; los cuadrantes de hace
        // 2+ años no se cargan en cada apertura.)
        const shiftsSince = `${new Date().getFullYear() - 1}-01-01`;
        unsubShifts = subscribeToShifts(firebaseUser.uid, (shiftsArr) => {
          setShifts(shiftsArr);
        }, (error) => {
          console.error("Error al cargar turnos:", error);
        }, shiftsSince);

      } else {
        clearTimeout(safetyTimeout);
        if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }
        if (unsubShifts) { unsubShifts(); unsubShifts = null; }
        setUser(null);
        setShifts([]);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubShifts) unsubShifts();
    };
  }, []);

  const saveToCloud = useCallback(async (updates) => {
    if (!user?.uid) return;
    
    try {
      // Handle shifts separately — they go to subcollection now
      if (updates.shifts !== undefined) {
        const newShifts = updates.shifts;
        const oldDates = new Set(shiftsRef.current.map(s => s.date));
        const newDates = new Set(newShifts.map(s => s.date));
        
        // Find shifts to delete (in old but not in new)
        const datesToDelete = [...oldDates].filter(d => !newDates.has(d));
        
        // Find shifts to save (in new but different or not in old)
        const shiftsToSave = newShifts.filter(s => {
          const existing = shiftsRef.current.find(e => e.date === s.date);
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

  return {
    user, loading, logoutUser, saveToCloud,
    settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime
  };
};
