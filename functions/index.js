const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendPushNotification = functions.region("europe-west1").firestore
  .document("noticias/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();

    // Solo reaccionar si es una peticion de PUSH
    if (data.isPushRequest !== true) {
      return null;
    }

    const title = data.title || "Nueva notificacion";
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
      console.log("No hay tokens registrados para enviar la notificacion.");
      return null;
    }

    // 2. Construir el mensaje V1 (icon va en webpush, NO en notification)
    const message = {
      notification: {
        title: title,
        body: body,
      },
      webpush: {
        notification: {
          icon: "https://calendario-fetico.web.app/img/app.PNG",
        },
      },
      tokens: uniqueTokens,
    };

    // 3. Enviar a traves de Firebase Admin (Usa la API V1 de forma segura)
    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(response.successCount + " mensajes enviados con exito.");
      
      // Registrar errores detallados de tokens fallidos
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error("Token fallido [" + idx + "]:", resp.error?.code, resp.error?.message);
          }
        });
      }
    } catch (error) {
      console.error("Error enviando notificaciones:", error);
    }

    return null;
  });
