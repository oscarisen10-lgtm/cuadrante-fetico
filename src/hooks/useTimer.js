import { useState, useEffect, useRef, useCallback } from 'react';

export const useTimer = (activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings, alarmUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') => {
  const [showBreakFinishedMsg, setShowBreakFinishedMsg] = useState(false);
  
  const alarmRef = useRef(null);
  const intervalRef = useRef(null);
  const breakFinishedRef = useRef(false);

  // Keep ref in sync with state to avoid stale closures
  breakFinishedRef.current = showBreakFinishedMsg;

  // Inicializar audio solo en cliente
  useEffect(() => {
    if (typeof Audio !== 'undefined' && !alarmRef.current) {
      alarmRef.current = new Audio(alarmUrl);
      alarmRef.current.preload = 'auto';
    }
  }, [alarmUrl]);

  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (activeShift && isBreakActive) {
      // Intentar "desbloquear" el audio al entrar en modo descanso
      if (alarmRef.current) {
        alarmRef.current.play().then(() => {
          alarmRef.current.pause();
          alarmRef.current.currentTime = 0;
        }).catch(() => {
          console.log("Audio esperando interacción");
        });
      }

      const tick = () => {
        const secondsInBreak = Math.floor((Date.now() - breakStartTime) / 1000);
        const totalBreakSeconds = settings.breakDuration * 60;
        const remaining = Math.max(0, totalBreakSeconds - secondsInBreak);
        
        if (remaining === 0 && !breakFinishedRef.current) {
          setShowBreakFinishedMsg(true);
          if (settings.notifications) {
            if (alarmRef.current) {
              alarmRef.current.loop = true; 
              alarmRef.current.play().catch(e => console.log("Sonido bloqueado por el sistema", e));
            }
            if (typeof navigator !== 'undefined' && "vibrate" in navigator) {
              navigator.vibrate([1000, 500, 1000, 500, 1000]);
            }
          }
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeShift, isBreakActive, breakStartTime, settings.breakDuration, settings.notifications]);

  const stopAlarm = useCallback(() => {
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
    }
    if (typeof navigator !== 'undefined' && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  return { showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm };
};
