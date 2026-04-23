import { useState, useEffect } from 'react';
import { subscribeToAuth, subscribeToUserDoc, saveUserData, logoutUser } from '../services/firebaseService';

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
    const unsubscribe = subscribeToAuth((firebaseUser) => {
      if (firebaseUser) {
        subscribeToUserDoc(firebaseUser.uid, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({ ...data.profile, uid: firebaseUser.uid });
            setSettings(data.settings || { notifications: true, breakDuration: 15 });
            setShifts(data.shifts || []);
            setActiveShift(data.activeShift || null);
            setWorkTimeAccumulated(data.workTimeAccumulated || 0);
            setIsBreakActive(data.isBreakActive || false);
            setBreakStartTime(data.breakStartTime || null);
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveToCloud = async (updates) => {
    if (updates.profile !== undefined) setUser((prev) => ({ ...prev, ...updates.profile }));
    if (updates.settings !== undefined) setSettings(updates.settings);
    if (updates.shifts !== undefined) setShifts(updates.shifts);
    if (updates.activeShift !== undefined) setActiveShift(updates.activeShift);
    if (updates.workTimeAccumulated !== undefined) setWorkTimeAccumulated(updates.workTimeAccumulated);
    if (updates.isBreakActive !== undefined) setIsBreakActive(updates.isBreakActive);
    if (updates.breakStartTime !== undefined) setBreakStartTime(updates.breakStartTime);

    await saveUserData(updates);
  };

  return {
    user, loading, logoutUser, saveToCloud,
    settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime
  };
};
