const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendPushNotification = functions.region("europe-west1").firestore
  .document("noticias/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();

    // Solo reaccionar si es una petición de PUSH
    if (data.isPushRequest !== true) {
      return null;
    }

    const title = data.title || "Nueva notificación";
    const body = data.desc || "";

    // 1. Obtener todos los tokens de los usuarios
    const usersSnapshot = await admin.firestore().collection("users").get();
    const tokens = [];
    
    usersSnapshot.forEach((doc) => {
      const profile = doc.data().profile;
      if (profile && profile.fcmToken) {
        tokens.push(profile.fcmToken);
      }
    });

    // Eliminar tokens duplicados
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log("No hay tokens registrados para enviar la notificación.");
      return null;
    }

    // 2. Construir el mensaje V1
    const message = {
      notification: {
        title: title,
        body: body,
        icon: "/img/app.PNG",
      },
      tokens: uniqueTokens,
    };

    // 3. Enviar a través de Firebase Admin (Usa la API V1 de forma segura)
    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(response.successCount + " mensajes enviados con éxito.");
      
      // Opcional: Eliminar tokens que ya no son válidos
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(uniqueTokens[idx]);
          }
        });
        console.log("Tokens fallidos (para limpiar):", failedTokens);
      }
    } catch (error) {
      console.error("Error enviando notificaciones:", error);
    }

    return null;
  });
