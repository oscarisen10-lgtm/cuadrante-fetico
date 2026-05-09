const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * Cloud Function (Gen 2): sendPushNotification
 * Triggers when a new document is created in the 'noticias' collection.
 */
exports.sendPushNotification = onDocumentCreated("noticias/{docId}", async (event) => {
  const data = event.data.data();

  // Only react to explicit PUSH requests from admin
  if (data.isPushRequest !== true) {
    return null;
  }

  const title = data.title || "Nueva notificación";
  const body = data.desc || "";

  // 1. Collect all FCM tokens from registered users
  const usersSnapshot = await admin.firestore().collection("users").get();
  const tokenToUidMap = new Map(); // Map token -> uid for cleanup

  usersSnapshot.forEach((doc) => {
    const profile = doc.data().profile;
    if (profile && profile.fcmToken) {
      tokenToUidMap.set(profile.fcmToken, doc.id);
    }
  });

  const uniqueTokens = [...tokenToUidMap.keys()];

  if (uniqueTokens.length === 0) {
    console.log("No hay tokens registrados para enviar la notificación.");
    return null;
  }

  console.log(`Enviando push a ${uniqueTokens.length} dispositivos...`);

  // 2. Build the multicast message
  const message = {
    notification: {
      title: title,
      body: body,
    },
    webpush: {
      notification: {
        icon: "https://calendario-fetico.web.app/img/app.PNG",
        badge: "https://calendario-fetico.web.app/img/app.PNG",
      },
      fcmOptions: {
        link: "https://calendario-fetico.web.app",
      },
    },
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        icon: "ic_launcher",
        color: "#059669",
        sound: "default",
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: "default",
          "content-available": 1,
        },
      },
    },
    tokens: uniqueTokens,
  };

  // 3. Send via Firebase Admin SDK
  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`${response.successCount} mensajes enviados con éxito.`);

    // 4. Clean up invalid/expired tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          console.error(`Token fallido [${idx}]:`, errorCode, resp.error?.message);

          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            tokensToRemove.push(uniqueTokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        console.log(`Limpiando ${tokensToRemove.length} tokens inválidos...`);
        const batch = admin.firestore().batch();
        tokensToRemove.forEach((deadToken) => {
          const uid = tokenToUidMap.get(deadToken);
          if (uid) {
            batch.update(admin.firestore().doc(`users/${uid}`), {
              "profile.fcmToken": admin.firestore.FieldValue.delete(),
            });
          }
        });
        await batch.commit();
        console.log("Tokens inválidos eliminados correctamente.");
      }
    }
  } catch (error) {
    console.error("Error enviando notificaciones:", error);
  }

  return null;
});
