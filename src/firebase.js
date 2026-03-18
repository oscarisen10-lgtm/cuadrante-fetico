import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD3Fy7gpaQ-a4i8vBMItmsmZH_kfZQnpG4",
  authDomain: "calendario-fetico.firebaseapp.com",
  projectId: "calendario-fetico",
  storageBucket: "calendario-fetico.firebasestorage.app",
  messagingSenderId: "1059161577815",
  appId: "1:1059161577815:web:4c4f4ac98d7c39f292c612",
  measurementId: "G-0LN23ZLESB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);