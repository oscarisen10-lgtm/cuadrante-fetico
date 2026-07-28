/**
 * Construcción y envío de notificaciones push.
 *
 * El payload (iconos web, canal de Android, cabeceras de APNs) estaba COPIADO
 * literalmente en las tres funciones que envían push. Cualquier arreglo —como el
 * del dominio de los iconos o el de `apns-push-type: alert`— había que acordarse
 * de aplicarlo tres veces. Aquí vive una sola vez.
 */
const { admin } = require("./firebase");

// Topic de FCM para el broadcast de noticias. Enviar a un topic cuesta UNA llamada y
// CERO lecturas de Firestore (antes cada push leía TODA la colección de usuarios para
// recolectar tokens, y además había que limpiar los tokens muertos a mano — con topics
// FCM gestiona el fan-out y las bajas de dispositivos solo).
// Los clientes se suscriben: nativo con el plugin FCM, web vía la callable
// `subscribeToNewsTopic` (el SDK web no puede suscribirse a topics por sí mismo).
const NEWS_TOPIC = "noticias";

// ⚠️ DOMINIO: mi-calendario-fe.web.app es el hosting REAL de esta app.
// calendario-fetico.web.app (lo que había antes) es el proyecto ANTIGUO "Mi
// Calendario": sus iconos no existen allí y el link abría la app vieja.
const WEB_BASE = "https://mi-calendario-fe.web.app";

/**
 * Payload común a todos los envíos. Devuelve el mensaje SIN destinatario: quien
 * llama añade `topic` o `tokens`.
 *
 * Iconos web LIGEROS generados a medida (19 KB y 7 KB): antes ambos apuntaban a
 * app.PNG (568 KB), que cada dispositivo descargaba con CADA notificación.
 */
const buildMessage = (title, body) => ({
  notification: { title, body },
  webpush: {
    notification: {
      icon: `${WEB_BASE}/img/push-icon-192.png`,
      badge: `${WEB_BASE}/img/push-badge-96.png`,
    },
    fcmOptions: { link: WEB_BASE },
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
    // Notificación VISIBLE en iOS. Antes llevaba "content-available: 1" sin "alert",
    // lo que la convertía en push silencioso de fondo (apns-push-type: background) y
    // el iPhone no mostraba ningún aviso. Ahora es una alerta explícita.
    headers: {
      "apns-priority": "10",
      "apns-push-type": "alert",
    },
    payload: {
      aps: {
        alert: { title, body },
        sound: "default",
        badge: 1,
      },
    },
  },
});

/** Envía al topic de noticias (broadcast a toda la app). */
async function sendToNewsTopic(title, body) {
  return admin.messaging().send({ ...buildMessage(title, body), topic: NEWS_TOPIC });
}

/**
 * Envío dirigido por token. `sendEachForMulticast` admite 500 tokens por llamada,
 * así que trocea solo. Devuelve el recuento agregado.
 */
async function sendToTokens(tokens, title, body) {
  const all = [...tokens];
  const base = buildMessage(title, body);
  let ok = 0;
  let ko = 0;
  for (let i = 0; i < all.length; i += 500) {
    const res = await admin.messaging().sendEachForMulticast({
      ...base,
      tokens: all.slice(i, i + 500),
    });
    ok += res.successCount;
    ko += res.failureCount;
  }
  return { ok, ko };
}

/**
 * Recolecta los tokens FCM de los usuarios de unas tiendas concretas.
 * El operador "in" de Firestore admite 30 valores → se trocea.
 * Devuelve un Set (deduplica si un usuario apareciera dos veces).
 */
async function tokensForStores(db, stores) {
  const tokens = new Set();
  for (let i = 0; i < stores.length; i += 30) {
    const snap = await db().collection("users")
      .where("profile.store", "in", stores.slice(i, i + 30))
      .select("profile.fcmToken")
      .get();
    snap.forEach((d) => {
      const t = d.data().profile && d.data().profile.fcmToken;
      if (t) tokens.add(t);
    });
  }
  return tokens;
}

module.exports = { NEWS_TOPIC, buildMessage, sendToNewsTopic, sendToTokens, tokensForStores };
