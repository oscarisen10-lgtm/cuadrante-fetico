import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD3Fy7gpaQ-a4i8vBMItmsmZH_kfzQnpG4",
  authDomain: "calendario-fetico.firebaseapp.com",
  projectId: "calendario-fetico",
  storageBucket: "calendario-fetico.firebasestorage.app",
  messagingSenderId: "1059161577815",
  appId: "1:1059161577815:web:4e4f4ac98d7c39f292c612",
  measurementId: "G-0LN23ZLESB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

let messagingInstance = null;
try {
  messagingInstance = getMessaging(app);
} catch (e) {
  console.warn("Firebase Messaging no soportado en este entorno");
}
export const messaging = messagingInstance;

export const VAPID_KEY = "SLUM2BX7U3d3MXsmQZAi93UZQ4wUmukSgIqJaoSjnnA";