import { useState, useEffect, useRef } from 'react';

export const useTimer = (activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings, alarmUrl = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg') => {
  const [elapsed, setElapsed] = useState(0); 
  const [breakTimeLeft, setBreakTimeLeft] = useState(settings.breakDuration * 60); 
  const [showBreakFinishedMsg, setShowBreakFinishedMsg] = useState(false);
  
  const alarmRef = useRef(typeof Audio !== 'undefined' ? new Audio(alarmUrl) : null);

  useEffect(() => {
    let interval;
    if (activeShift && !isBreakActive) {
      interval = setInterval(() => {
        const currentSessionSeconds = Math.floor((Date.now() - activeShift.startTime) / 1000);
        setElapsed(workTimeAccumulated + currentSessionSeconds);
      }, 1000);
    } else if (activeShift && isBreakActive) {
      setElapsed(workTimeAccumulated);
      interval = setInterval(() => {
        const secondsInBreak = Math.floor((Date.now() - breakStartTime) / 1000);
        const totalBreakSeconds = settings.breakDuration * 60;
        const remaining = Math.max(0, totalBreakSeconds - secondsInBreak);
        setBreakTimeLeft(remaining);
        
        if (remaining === 0 && !showBreakFinishedMsg) {
          setShowBreakFinishedMsg(true);
          if (alarmRef.current && settings.notifications) {
            alarmRef.current.loop = true; 
            alarmRef.current.play().catch(e => console.log("Sonido bloqueado", e));
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
  };

  return { elapsed, breakTimeLeft, showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm };
};
