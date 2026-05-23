import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

// Import local notifications only on native platforms
let LocalNotifications = null;
let localNotifPromise = null;

if (Capacitor.isNativePlatform()) {
  localNotifPromise = import('@capacitor/local-notifications').then(mod => {
    LocalNotifications = mod.LocalNotifications;
    return LocalNotifications;
  });
}

const BREAK_NOTIFICATION_ID = 9999;

/** Schedule a local notification for when break ends */
async function scheduleBreakNotification(breakDurationMinutes) {
  if (localNotifPromise) await localNotifPromise;
  if (!LocalNotifications) return;
  try {
    const perms = await LocalNotifications.checkPermissions();
    if (perms.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }

    // Cancel any previous break notification first
    await LocalNotifications.cancel({ notifications: [{ id: BREAK_NOTIFICATION_ID }] }).catch(() => {});

    const triggerDate = new Date(Date.now() + breakDurationMinutes * 60 * 1000);

    await LocalNotifications.schedule({
      notifications: [{
        id: BREAK_NOTIFICATION_ID,
        title: '☕ ¡Descanso terminado!',
        body: `Tu descanso de ${breakDurationMinutes} minutos ha finalizado. Es hora de volver al trabajo.`,
        schedule: { at: triggerDate },
        sound: 'default',
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#059669',
      }],
    });
    console.log(`[LocalNotif] Programada para dentro de ${breakDurationMinutes} min`);
  } catch (e) {
    console.log('[LocalNotif] Error al programar:', e);
  }
}

/** Cancel any pending break notification */
async function cancelBreakNotification() {
  if (localNotifPromise) await localNotifPromise;
  if (!LocalNotifications) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: BREAK_NOTIFICATION_ID }] });
    console.log('[LocalNotif] Notificación de descanso cancelada');
  } catch (e) {
    console.log('[LocalNotif] Error al cancelar:', e);
  }
}

export const useTimer = (activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings, alarmUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') => {
  const [showBreakFinishedMsg, setShowBreakFinishedMsg] = useState(false);
  
  const alarmRef = useRef(null);
  const intervalRef = useRef(null);
  const breakFinishedRef = useRef(false);
  const alarmTimeoutRef = useRef(null);
  const unlockAttemptedRef = useRef(false);

  // Keep ref in sync with state to avoid stale closures
  breakFinishedRef.current = showBreakFinishedMsg;

  // Inicializar audio y limpieza
  useEffect(() => {
    if (typeof Audio !== 'undefined' && !alarmRef.current) {
      alarmRef.current = new Audio(alarmUrl);
      alarmRef.current.preload = 'auto';
    }
    return () => {
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current.src = "";
        alarmRef.current = null;
      }
    };
  }, [alarmUrl]);

  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (activeShift && isBreakActive) {
      // Intentar "desbloquear" el audio al entrar en modo descanso solo la primera vez
      if (alarmRef.current && !unlockAttemptedRef.current) {
        unlockAttemptedRef.current = true;
        alarmRef.current.play().then(() => {
          alarmRef.current.pause();
          alarmRef.current.currentTime = 0;
        }).catch(() => {
          console.log("Audio esperando interacción");
        });
      }

      // Programar notificación local nativa para cuando acabe el descanso
      const secondsAlready = Math.floor((Date.now() - breakStartTime) / 1000);
      const totalBreakSeconds = (settings?.breakDuration || 15) * 60;
      const remainingMinutes = Math.max(0, (totalBreakSeconds - secondsAlready) / 60);
      if (remainingMinutes > 0) {
        scheduleBreakNotification(remainingMinutes);
      }

      const tick = () => {
        const secondsInBreak = Math.floor((Date.now() - breakStartTime) / 1000);
        const remaining = Math.max(0, totalBreakSeconds - secondsInBreak);
        
        if (remaining === 0 && !breakFinishedRef.current) {
          setShowBreakFinishedMsg(true);
          if (settings?.notifications) {
            if (alarmRef.current) {
              alarmRef.current.loop = true; 
              alarmRef.current.play().catch(e => console.log("Sonido bloqueado por el sistema", e));
              
              // Limitar alarma a 1 minuto máximo
              if (alarmTimeoutRef.current) clearTimeout(alarmTimeoutRef.current);
              alarmTimeoutRef.current = setTimeout(() => {
                if (alarmRef.current) {
                  alarmRef.current.pause();
                  alarmRef.current.currentTime = 0;
                }
              }, 60000);
            }
            if (typeof navigator !== 'undefined' && "vibrate" in navigator) {
              navigator.vibrate([1000, 500, 1000, 500, 1000]);
            }
          }
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      unlockAttemptedRef.current = false;
      cancelBreakNotification();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeShift, isBreakActive, breakStartTime, settings?.breakDuration, settings?.notifications]);

  const stopAlarm = useCallback(() => {
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
    }
    if (typeof navigator !== 'undefined' && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
    cancelBreakNotification();
  }, []);

  return { showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm };
};
