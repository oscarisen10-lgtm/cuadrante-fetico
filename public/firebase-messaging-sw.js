importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyCdsO08si23ZQDzgnRCqPEfUZp0TK-K5q8",
  authDomain: "mi-calendario-fe.firebaseapp.com",
  projectId: "mi-calendario-fe",
  storageBucket: "mi-calendario-fe.firebasestorage.app",
  messagingSenderId: "484679385374",
  appId: "1:484679385374:web:fc54045bde29b3cb7f890f",
  measurementId: "G-M133C7LHEF"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje en segundo plano:', payload);
});
