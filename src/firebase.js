import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getMessaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { Capacitor } from "@capacitor/core";

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

const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
const isNative = platform !== 'web';

// App Check (solo web): protege Functions/Firestore frente a clientes no legítimos.
// Inerte hasta que definas VITE_APPCHECK_SITE_KEY (reCAPTCHA v3) en .env y registres
// la clave en Firebase Console. La importación es dinámica para no engordar el bundle
// cuando no está configurado.
if (!isNative && import.meta.env.VITE_APPCHECK_SITE_KEY) {
  import("firebase/app-check")
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(import.meta.env.VITE_APPCHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch((e) => console.warn("App Check init failed:", e.message));
}

// FIX iOS: getAuth() auto-detecta la persistencia y se cuelga dentro de WKWebView.
// initializeAuth() con indexedDBLocalPersistence explícita evita ese sondeo.
let auth;
if (isNative) {
  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence,
  });
} else {
  auth = getAuth(app);
}
export { auth };

// Firestore — caché según plataforma:
// - iOS (WKWebView): SOLO memoria. persistentLocalCache puede colgar el arranque aquí.
// - Android (WebView Chromium): caché PERSISTENTE en disco → en reaperturas sirve los
//   datos desde el móvil sin gastar lecturas de Firestore (Android no sufre el cuelgue de iOS).
// - Web/escritorio: caché persistente multipestaña + transporte por defecto.
export const db = (() => {
  if (platform === 'ios') {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    });
  }
  if (platform === 'android') {
    return initializeFirestore(app, {
      localCache: persistentLocalCache(),
      experimentalForceLongPolling: true,
    });
  }
  return initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
})();

// Firebase Messaging solo funciona en navegadores con Service Worker.
// iOS WKWebView (Capacitor nativo) NO lo soporta, así que getMessaging() lanzaría
// un error fatal y dejaría la pantalla en blanco al arrancar.
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

// Las callable se invocan por nombre + REGIÓN. El backend corre en europe-west1
// (junto a Firestore eur3 y a los usuarios); esta instancia es la que debe usarse
// para todas las funciones nuevas.
export const functions = getFunctions(app, "europe-west1");

// TRANSICIÓN: solo para `teamStatus`, que sigue desplegada en us-central1 por
// compatibilidad con las builds nativas antiguas (ver comentario en functions/index.js).
// Cuando teamStatus migre a europe-west1, eliminar esta instancia y su único uso.
export const functionsUsCentral = getFunctions(app, "us-central1");

// Clave VAPID para Web Push. Se obtiene en Firebase Console > Configuración del proyecto
// > Cloud Messaging > Certificados push web, y se define en .env como
// VITE_FIREBASE_VAPID_KEY. Sin ella, getToken() falla en web (el push nativo no la usa).
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
if (!isNative && !VAPID_KEY) {
  console.warn('[FCM] VITE_FIREBASE_VAPID_KEY no configurada: las notificaciones web no funcionarán.');
}
