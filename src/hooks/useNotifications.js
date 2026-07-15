import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { FCM } from '@capacitor-community/fcm';
import { toast } from '../components/Toast';
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

export const useNotifications = (user) => {
  const [token, setToken] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [permissionState, setPermissionState] = useState('Notification' in window ? Notification.permission : 'default');

  const requestTokenManually = async () => {
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
        if (auth.currentUser) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            'profile.fcmToken': currentToken
          });
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
  };

  useEffect(() => {
    if (!user || !user.uid) return;

    if (Capacitor.isNativePlatform()) {
      PushNotifications.checkPermissions().then(res => {
         setPermissionState(res.receive);
         if (res.receive === 'granted') PushNotifications.register();
      });

      PushNotifications.addListener('registration', async (token) => {
        try {
          let fcmToken = token.value;
          if (Capacitor.getPlatform() === 'ios') {
            // En iOS `token.value` es el token APNs (hex), NO el token FCM. Convertimos.
            fcmToken = await getFcmTokenWithRetry();
          }
          setToken(fcmToken);
          setTokenError(null);
          updateDoc(doc(db, 'users', user.uid), { 'profile.fcmToken': fcmToken }).catch(()=>{});
        } catch (err) {
          // OJO: en iOS NO guardamos token.value (es APNs, no FCM) porque haría fallar
          // el envío desde el backend. Preferimos no guardar nada y reflejar el error.
          console.error("Error al obtener token FCM en iOS:", err);
          setTokenError(err?.message || 'No se pudo obtener el token FCM');
          if (Capacitor.getPlatform() !== 'ios') {
            setToken(token.value);
            updateDoc(doc(db, 'users', user.uid), { 'profile.fcmToken': token.value }).catch(()=>{});
          }
        }
        // Suscripción al topic de noticias (nativo): la hace el plugin FCM en el
        // dispositivo, sin backend. Va FUERA del try del token: aunque la conversión
        // a token FCM fallara, la suscripción al topic puede funcionar igualmente.
        FCM.subscribeTo({ topic: NEWS_TOPIC })
          .catch((e) => console.warn('No se pudo suscribir al topic de noticias:', e?.message));
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
