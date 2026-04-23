import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../firebase';
import { saveUserData } from '../services/firebaseService';

export const useNotifications = (user) => {
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (!user || !user.uid || !messaging) return;

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
          if (currentToken) {
            setToken(currentToken);
            // Save token to Firestore profile
            await saveUserData({
              profile: { ...user, fcmToken: currentToken }
            });
          } else {
            console.log('No registration token available.');
          }
        } else {
          console.log('Notification permission not granted.');
        }
      } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
      }
    };

    requestPermission();

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      alert(`🔔 ${payload.notification.title}\n${payload.notification.body}`);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  return { token };
};
