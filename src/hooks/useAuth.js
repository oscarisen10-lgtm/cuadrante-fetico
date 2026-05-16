import { useState, useEffect, useCallback } from 'react';
import { 
  subscribeToAuth, 
  subscribeToUserDoc, 
  subscribeToShifts,
  saveUserData, 
  saveShiftsBatch,
  deleteShiftsBatch,
  logoutUser 
} from '../services/firebaseService';
import toast from 'react-hot-toast';

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
            toast.error("Error de conexión con la base de datos. Reinicia la app.", { duration: 5000 });
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
             console.warn("User doc doesn't exist for authenticated user, creating default local profile");
             setUser({
               uid: firebaseUser.uid,
               email: firebaseUser.email || "usuario@ejemplo.com",
               fullName: "Usuario Recuperado",
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
          toast.error("Error al cargar datos: " + error.message);
          setLoading(false);
        });

        unsubShifts = subscribeToShifts(firebaseUser.uid, (shiftsArr) => {
          setShifts(shiftsArr);
        }, (error) => {
          console.error("Error al cargar turnos:", error);
        });

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
        const oldDates = new Set(shifts.map(s => s.date));
        const newDates = new Set(newShifts.map(s => s.date));
        
        // Find shifts to delete (in old but not in new)
        const datesToDelete = [...oldDates].filter(d => !newDates.has(d));
        
        // Find shifts to save (in new but different or not in old)
        const shiftsToSave = newShifts.filter(s => {
          const existing = shifts.find(e => e.date === s.date);
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
      toast("Error de red o permisos al guardar: " + error.message, { icon: "❌" });
      throw error; // Re-throw so caller knows it failed
    }
  }, [user?.uid, shifts]);

  return {
    user, loading, logoutUser, saveToCloud,
    settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime
  };
};
