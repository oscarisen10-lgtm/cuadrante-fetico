importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyD3Fy7gpaQ-a4i8vBMItmsmZH_kfzQnpG4",
  authDomain: "calendario-fetico.firebaseapp.com",
  projectId: "calendario-fetico",
  storageBucket: "calendario-fetico.firebasestorage.app",
  messagingSenderId: "1059161577815",
  appId: "1:1059161577815:web:4e4f4ac98d7c39f292c612",
  measurementId: "G-0LN23ZLESB"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje en segundo plano:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/img/app.PNG'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
