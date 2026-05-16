import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// memoryLocalCache avoids IndexedDB issues on iOS WKWebView (Capacitor).
// persistentLocalCache can silently hang on first launch in WKWebView,
// causing setDoc operations to never resolve.
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true
});

// Firebase Messaging only works in browsers with Service Worker support.
// iOS WKWebView (Capacitor native) does NOT support SW, so getMessaging()
// would throw a fatal error and cause a blank screen on launch.
let _messaging = null;
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    _messaging = getMessaging(app);
  }
} catch (e) {
  console.warn('Firebase Messaging not available:', e.message);
}
export const messaging = _messaging;

export const storage = getStorage(app);

export const VAPID_KEY = "BEYovLJVC-gnlNb_aJ4qkOTxh849wiUY_3Y5p9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z";