import { useState, useEffect, useRef } from 'react';

export const useTimer = (activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings, alarmUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') => {
  const [elapsed, setElapsed] = useState(0); 
  const [breakTimeLeft, setBreakTimeLeft] = useState(settings.breakDuration * 60); 
  const [showBreakFinishedMsg, setShowBreakFinishedMsg] = useState(false);
  
  const alarmRef = useRef(null);

  // Inicializar audio solo en cliente
  useEffect(() => {
    if (typeof Audio !== 'undefined' && !alarmRef.current) {
      alarmRef.current = new Audio(alarmUrl);
      alarmRef.current.preload = 'auto';
    }
  }, [alarmUrl]);

  useEffect(() => {
    let interval;
    if (activeShift && !isBreakActive) {
      interval = setInterval(() => {
        const currentSessionSeconds = Math.floor((Date.now() - activeShift.startTime) / 1000);
        setElapsed(workTimeAccumulated + currentSessionSeconds);
      }, 1000);
    } else if (activeShift && isBreakActive) {
      setElapsed(workTimeAccumulated);

      // Intentar "desbloquear" el audio al entrar en modo descanso
      if (alarmRef.current) {
        alarmRef.current.play().then(() => {
          alarmRef.current.pause();
          alarmRef.current.currentTime = 0;
        }).catch(() => {
          console.log("Audio esperando interacción");
        });
      }

      interval = setInterval(() => {
        const secondsInBreak = Math.floor((Date.now() - breakStartTime) / 1000);
        const totalBreakSeconds = settings.breakDuration * 60;
        const remaining = Math.max(0, totalBreakSeconds - secondsInBreak);
        setBreakTimeLeft(remaining);
        
        if (remaining === 0 && !showBreakFinishedMsg) {
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
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeShift, isBreakActive, workTimeAccumulated, breakStartTime, showBreakFinishedMsg, settings]);

  const stopAlarm = () => {
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
    }
    if (typeof navigator !== 'undefined' && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
  };

  return { elapsed, breakTimeLeft, showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm };
};
