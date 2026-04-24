import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const useNotifications = (user) => {
  const [token, setToken] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  useEffect(() => {
    if (!user || !user.uid || !messaging) {
      console.log('[Push] Esperando usuario o messaging no soportado.');
      return;
    }

    const requestToken = async () => {
      try {
        // 1. Comprobar permiso
        const permission = Notification.permission;
        console.log('[Push] Estado del permiso:', permission);
        
        if (permission !== 'granted') {
          const result = await Notification.requestPermission();
          console.log('[Push] Resultado de la petición de permiso:', result);
          if (result !== 'granted') {
            setTokenError('Permiso denegado');
            return;
          }
        }

        // 2. Obtener el token FCM
        console.log('[Push] Obteniendo token con VAPID_KEY:', VAPID_KEY.substring(0, 20) + '...');
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        
        if (currentToken) {
          console.log('[Push] ✅ Token obtenido:', currentToken.substring(0, 30) + '...');
          setToken(currentToken);
          
          // 3. Guardar SOLO el fcmToken en Firestore (sin sobreescribir todo el perfil)
          if (auth.currentUser) {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              'profile.fcmToken': currentToken
            });
            console.log('[Push] ✅ Token guardado en Firestore correctamente.');
          }
        } else {
          const msg = 'getToken devolvió vacío. Comprueba la VAPID Key y el Service Worker.';
          console.warn('[Push] ⚠️', msg);
          setTokenError(msg);
        }
      } catch (error) {
        console.error('[Push] ❌ Error al obtener token:', error.code, error.message);
        setTokenError(error.message);
      }
    };

    requestToken();

    // Escuchar mensajes cuando la app está en primer plano
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Push] Mensaje en primer plano:', payload);
      if (payload.notification) {
        alert(`🔔 ${payload.notification.title}\n${payload.notification.body}`);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  return { token, tokenError };
};
