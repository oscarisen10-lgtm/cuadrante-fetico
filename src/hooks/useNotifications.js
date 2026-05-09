import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { toast } from '../components/Toast';

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

      PushNotifications.addListener('registration', (token) => {
        setToken(token.value);
        updateDoc(doc(db, 'users', user.uid), { 'profile.fcmToken': token.value }).catch(()=>{});
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
