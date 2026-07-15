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
  // Respaldo de audio SIN conexión: el mp3 viene de un CDN externo y no suena en un
  // almacén/trastienda sin red (justo el caso de uso). Sintetizamos un pitido con la
  // Web Audio API, que no depende de internet ni de ningún asset descargado.
  const audioCtxRef = useRef(null);
  const beepRef = useRef(null); // { stop } mientras el pitido de respaldo está sonando

  const getAudioCtx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new Ctx(); } catch { return null; }
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Pitido en bucle (dos tonos alternos) hasta que se llame a stop().
  const startFallbackBeep = useCallback(() => {
    if (beepRef.current) return; // ya sonando
    const ctx = getAudioCtx();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.connect(gain);
    osc.start();
    let on = false;
    const pulse = () => {
      on = !on;
      const t = ctx.currentTime;
      osc.frequency.setValueAtTime(on ? 880 : 660, t);
      gain.gain.setTargetAtTime(on ? 0.22 : 0.0001, t, 0.01);
    };
    pulse();
    const id = setInterval(pulse, 450);
    beepRef.current = {
      stop: () => {
        clearInterval(id);
        try { gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.01); } catch { /* noop */ }
        try { osc.stop(ctx.currentTime + 0.05); } catch { /* noop */ }
        beepRef.current = null;
      },
    };
  }, [getAudioCtx]);

  const stopFallbackBeep = useCallback(() => {
    if (beepRef.current) beepRef.current.stop();
  }, []);

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
      stopFallbackBeep();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [alarmUrl, stopFallbackBeep]);

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
        // Preparar también el contexto de Web Audio (respaldo offline). Al entrar en
        // descanso hay un gesto del usuario, momento válido para reanudarlo.
        getAudioCtx();
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
              // Si el mp3 (CDN externo) no puede sonar —típicamente por estar sin red—
              // arrancamos el pitido sintetizado, que funciona offline.
              alarmRef.current.play().catch((e) => {
                console.log("mp3 no disponible, uso pitido de respaldo", e?.message);
                startFallbackBeep();
              });

              // Limitar alarma a 1 minuto máximo (mp3 + pitido de respaldo)
              if (alarmTimeoutRef.current) clearTimeout(alarmTimeoutRef.current);
              alarmTimeoutRef.current = setTimeout(() => {
                if (alarmRef.current) {
                  alarmRef.current.pause();
                  alarmRef.current.currentTime = 0;
                }
                stopFallbackBeep();
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
  }, [activeShift, isBreakActive, breakStartTime, settings?.breakDuration, settings?.notifications, startFallbackBeep, stopFallbackBeep, getAudioCtx]);

  const stopAlarm = useCallback(() => {
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
    }
    stopFallbackBeep();
    if (typeof navigator !== 'undefined' && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
    cancelBreakNotification();
  }, [stopFallbackBeep]);

  return { showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm };
};
