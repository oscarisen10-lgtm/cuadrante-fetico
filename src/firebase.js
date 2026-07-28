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
// - iOS (WKWebView): se INTENTA la caché persistente (igual que Android) con una
//   red de seguridad, porque históricamente IndexedDB + Firestore colgaba el
//   arranque en WKWebView (por eso antes iOS iba solo en memoria, pagando ~50
//   lecturas por CADA apertura). Los SDK modernos lo han ido arreglando; si en
//   este dispositivo volviera a colgarse, el mecanismo de abajo lo detecta,
//   desactiva la persistencia PARA SIEMPRE en ese dispositivo y recarga.
// - Android (WebView Chromium): caché PERSISTENTE en disco → en reaperturas sirve los
//   datos desde el móvil sin gastar lecturas de Firestore.
// - Web/escritorio: caché persistente multipestaña + transporte por defecto.

// ── Red de seguridad de la caché persistente en iOS ──────────────────────────
// 1. Marcador de arranque: se pone ANTES de iniciar Firestore y se quita cuando
//    llega la primera respuesta (markFirestoreAlive, lo llama useAuth). Si la app
//    se abre y el marcador de la vez anterior sigue puesto, aquel arranque murió
//    a medias: se suma un strike. Con 2 strikes seguidos (tolera un cierre
//    forzado inocente), la persistencia queda desactivada en este dispositivo.
// 2. Watchdog en vivo: si a los 20s la primera respuesta no ha llegado (el
//    cuelgue clásico deja promesas colgadas, no bloquea el hilo), se desactiva
//    la persistencia y se recarga la app sola — el usuario ve un reinicio, no
//    una pantalla congelada.
const IOS_CACHE_DISABLED_KEY = 'iosPersistentCacheDisabled';
const IOS_BOOT_PENDING_KEY = 'iosCacheBootPending';
const IOS_BOOT_STRIKES_KEY = 'iosCacheBootStrikes';

const iosPersistentAllowed = (() => {
  if (platform !== 'ios') return false;
  try {
    if (localStorage.getItem(IOS_CACHE_DISABLED_KEY) === '1') return false;
    if (localStorage.getItem(IOS_BOOT_PENDING_KEY) === '1') {
      // El arranque anterior nunca llegó a completarse.
      const strikes = (Number(localStorage.getItem(IOS_BOOT_STRIKES_KEY)) || 0) + 1;
      localStorage.setItem(IOS_BOOT_STRIKES_KEY, String(strikes));
      if (strikes >= 2) {
        localStorage.setItem(IOS_CACHE_DISABLED_KEY, '1');
        return false;
      }
    }
    localStorage.setItem(IOS_BOOT_PENDING_KEY, '1');
    return true;
  } catch {
    return false; // sin localStorage no hay red de seguridad → modo memoria
  }
})();

/** La llama useAuth cuando Firestore responde por primera vez (o no hace falta). */
export const markFirestoreAlive = () => {
  if (platform !== 'ios') return;
  try {
    localStorage.removeItem(IOS_BOOT_PENDING_KEY);
    localStorage.removeItem(IOS_BOOT_STRIKES_KEY);
  } catch { /* sin almacenamiento */ }
};

/** Para el panel de diagnóstico de Ajustes (admin): qué caché está activa. */
export const firestoreCacheMode =
  platform === 'ios'
    ? (iosPersistentAllowed ? 'persistente (iOS, en prueba)' : 'memoria (persistencia desactivada)')
    : 'persistente';

if (platform === 'ios' && iosPersistentAllowed) {
  setTimeout(() => {
    try {
      if (localStorage.getItem(IOS_BOOT_PENDING_KEY) === '1') {
        console.warn('[Firestore iOS] Sin respuesta en 20s con caché persistente: se desactiva y se recarga.');
        localStorage.setItem(IOS_CACHE_DISABLED_KEY, '1');
        window.location.reload();
      }
    } catch { /* sin almacenamiento */ }
  }, 20000);
}

export const db = (() => {
  if (platform === 'ios') {
    return initializeFirestore(app, {
      localCache: iosPersistentAllowed ? persistentLocalCache() : memoryLocalCache(),
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

// Clave VAPID para Web Push. Se obtiene en Firebase Console > Configuración del proyecto
// > Cloud Messaging > Certificados push web, y se define en .env como
// VITE_FIREBASE_VAPID_KEY. Sin ella, getToken() falla en web (el push nativo no la usa).
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
if (!isNative && !VAPID_KEY) {
  console.warn('[FCM] VITE_FIREBASE_VAPID_KEY no configurada: las notificaciones web no funcionarán.');
}
