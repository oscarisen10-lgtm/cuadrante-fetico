import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const useNotifications = (user) => {
  const [token, setToken] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [permissionState, setPermissionState] = useState('Notification' in window ? Notification.permission : 'default');

  const requestTokenManually = async () => {
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
      } else {
        setTokenError('Error al generar token FCM');
      }
    } catch (error) {
      setTokenError(error.message);
    }
  };

  useEffect(() => {
    if (!user || !user.uid || !messaging) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      requestTokenManually();
    }

    const unsubscribe = onMessage(messaging, (payload) => {
      if (payload.notification) {
        alert(`🔔 ${payload.notification.title}\n${payload.notification.body}`);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  return { token, tokenError, permissionState, requestTokenManually };
};
