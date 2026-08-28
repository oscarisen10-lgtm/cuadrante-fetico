import { useCallback, useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../firebase';
import { doc, updateDoc, arrayUnion, deleteField } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { FCM } from '@capacitor-community/fcm';
import { toast } from '../services/toastBus';
import { subscribeTokenToNewsTopic } from '../services/firebaseService';

// Topic de broadcast de noticias (debe coincidir con NEWS_TOPIC de las functions).
// El backend ya no lee la colección de usuarios para enviar: publica al topic, y
// cada dispositivo se suscribe aquí en cada arranque (operación idempotente).
const NEWS_TOPIC = 'noticias';

// En iOS el token FCM puede no estar listo en el instante en que APNs devuelve su token
// (Firebase necesita haber recibido antes el apnsToken). Reintentamos con pequeña espera
// en vez de rendirnos a la primera y, sobre todo, NUNCA guardamos el token APNs crudo
// como si fuera un token FCM (eso rompía el envío desde la Cloud Function).
const getFcmTokenWithRetry = async (attempts = 5, delayMs = 1500) => {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await FCM.getToken();
      if (res?.token) return res.token;
    } catch (e) {
      if (i === attempts - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('No se pudo obtener el token FCM tras varios intentos');
};

// Máximo de dispositivos por cuenta. Cada reinstalación genera un token nuevo, así
// que sin tope el array crecería para siempre con tokens muertos a los que se
// seguiría intentando enviar. Se recorta por el principio (los más antiguos).
const MAX_DEVICE_TOKENS = 5;

/**
 * Guarda el token de ESTE dispositivo en el perfil, junto a los de los demás.
 *
 * ⚠️ Antes era un único campo `profile.fcmToken` que cada dispositivo sobrescribía:
 * quien tenía la cuenta en el móvil y en la tablet solo recibía los envíos DIRIGIDOS
 * (p. ej. "nueva cuenta por activar") en el último que hubiera abierto la app.
 * Ahora es `profile.fcmTokens`, un array con un token por dispositivo.
 *
 * arrayUnion evita leer antes de escribir y es seguro si dos dispositivos coinciden.
 * El campo viejo se borra en la misma escritura para que un token que ya no es de
 * nadie no siga recibiendo las push de esta cuenta.
 */
const saveDeviceToken = async (uid, token, tokensActuales) => {
  const previos = Array.isArray(tokensActuales) ? tokensActuales : [];
  if (previos.includes(token)) return;

  const ref = doc(db, 'users', uid);
  if (previos.length >= MAX_DEVICE_TOKENS) {
    // Solo en este caso raro se escribe el array entero (arrayUnion no puede recortar).
    const recortado = [...previos.slice(previos.length - MAX_DEVICE_TOKENS + 1), token];
    await updateDoc(ref, { 'profile.fcmTokens': recortado, 'profile.fcmToken': deleteField() });
    return;
  }
  await updateDoc(ref, { 'profile.fcmTokens': arrayUnion(token), 'profile.fcmToken': deleteField() });
};

export const useNotifications = (user) => {
  const [token, setToken] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [permissionState, setPermissionState] = useState('Notification' in window ? Notification.permission : 'default');

  // useCallback NO es cosmético aquí: esta función viaja como prop a cuatro vistas
  // envueltas en React.memo (Dashboard, Calendario, Ajustes, Licencias). Sin
  // memoizarla se recreaba en CADA render de AppContent —que ocurre, por ejemplo,
  // cada vez que fluctúa el estado de red— y anulaba el memo de las cuatro.
  const requestTokenManually = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await PushNotifications.requestPermissions();
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
          setPermissionState('granted');
        } else {
          setTokenError('Permiso nativo denegado');
        }
      } catch (e) {
        setTokenError(e.message);
      }
      return;
    }

    if (!messaging) {
       setTokenError('Push no soportado');
       return;
    }
    try {
      let permission = Notification.permission;
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
        setPermissionState(permission);
        if (permission !== 'granted') {
          setTokenError('Permiso denegado');
          return;
        }
      }

      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (currentToken) {
        setToken(currentToken);
        // Solo si este dispositivo no consta ya (mismo criterio que recordAppOpen en
        // useAuth): evita una escritura por cada apertura de la app.
        if (auth.currentUser) {
          await saveDeviceToken(auth.currentUser.uid, currentToken, user?.fcmTokens);
        }
        // Web: la suscripción al topic la hace el backend (el SDK web no puede solo).
        // Mejor esfuerzo: si falla (p.ej. sin red), se reintenta en el próximo arranque.
        subscribeTokenToNewsTopic(currentToken)
          .catch((e) => console.warn('No se pudo suscribir al topic de noticias:', e?.message));
      } else {
        setTokenError('Error al generar token FCM');
      }
    } catch (error) {
      setTokenError(error.message);
    }
  }, [user?.fcmTokens]);

  useEffect(() => {
    if (!user || !user.uid) return;

    if (Capacitor.isNativePlatform()) {
      PushNotifications.checkPermissions().then(res => {
         setPermissionState(res.receive);
         if (res.receive === 'granted') PushNotifications.register();
      });

      PushNotifications.addListener('registration', async (token) => {
        // Sin valor inicial: todas las ramas (try y catch) lo asignan antes de leerlo.
        let fcmToken;
        try {
          fcmToken = token.value;
          if (Capacitor.getPlatform() === 'ios') {
            // En iOS `token.value` es el token APNs (hex), NO el token FCM. Convertimos.
            fcmToken = await getFcmTokenWithRetry();
          }
          setToken(fcmToken);
          setTokenError(null);
          // Solo si este dispositivo no consta ya: en cada arranque el token suele ser
          // el mismo, así que evitamos una escritura por apertura (a 50k usuarios,
          // millones de escrituras/mes de más).
          saveDeviceToken(user.uid, fcmToken, user.fcmTokens).catch(()=>{});
        } catch (err) {
          // OJO: en iOS NO guardamos token.value (es APNs, no FCM) porque haría fallar
          // el envío desde el backend. Preferimos no guardar nada y reflejar el error.
          console.error("Error al obtener token FCM en iOS:", err);
          setTokenError(err?.message || 'No se pudo obtener el token FCM');
          if (Capacitor.getPlatform() !== 'ios') {
            fcmToken = token.value;
            setToken(fcmToken);
            saveDeviceToken(user.uid, fcmToken, user.fcmTokens).catch(()=>{});
          } else {
            fcmToken = null;
          }
        }
        // Suscripción al topic de noticias por DOS vías (cinturón y tirantes):
        // 1) El plugin FCM en el dispositivo. En iOS se observó que puede fallar
        //    en silencio (push directo al token OK pero el del topic no llegaba).
        FCM.subscribeTo({ topic: NEWS_TOPIC })
          .catch((e) => console.warn('No se pudo suscribir al topic (plugin):', e?.message));
        // 2) El backend (subscribeToNewsTopic, Admin SDK): fiable e idempotente.
        //    Es la misma vía que ya usaba la web; ahora también nativo.
        if (fcmToken) {
          subscribeTokenToNewsTopic(fcmToken)
            .catch((e) => console.warn('No se pudo suscribir al topic (backend):', e?.message));
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('Error registrando push nativo:', err);
        setTokenError(err?.error || 'Error de registro de push');
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        toast(`🔔 ${notification.title}: ${notification.body}`, 'info');
      });

      return () => {
        PushNotifications.removeAllListeners();
      };
    } else {
      if (!messaging) return;
      
      if ('Notification' in window && Notification.permission === 'granted') {
        requestTokenManually();
      }

      const unsubscribe = onMessage(messaging, (payload) => {
        if (payload.notification) {
          toast(`🔔 ${payload.notification.title}: ${payload.notification.body}`, 'info');
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [user?.uid]);

  return { token, tokenError, permissionState, requestTokenManually };
};
