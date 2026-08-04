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

// Lotes de envío simultáneos. Los lotes se mandaban de uno en uno con `await`, así
// que el tiempo total crecía linealmente con el nº de destinatarios: con miles de
// tokens se podía agotar el timeout de la función y los lotes restantes NO se
// enviaban nunca, sin reintento y sin que nadie se enterara. En paralelo cabe mucho
// más dentro del mismo tiempo; el tope evita saturar la API de FCM.
const SEND_CONCURRENCY = 5;
const TOKENS_PER_MULTICAST = 500; // máximo que admite sendEachForMulticast

/**
 * Envío dirigido por token, en lotes paralelos.
 * Devuelve { ok, ko, total } — si `ok + ko < total`, el envío quedó INCOMPLETO y
 * quien llama debe registrarlo (no es lo mismo que un token muerto).
 */
async function sendToTokens(tokens, title, body) {
  const all = [...tokens];
  const base = buildMessage(title, body);

  const chunks = [];
  for (let i = 0; i < all.length; i += TOKENS_PER_MULTICAST) {
    chunks.push(all.slice(i, i + TOKENS_PER_MULTICAST));
  }

  let ok = 0;
  let ko = 0;
  for (let i = 0; i < chunks.length; i += SEND_CONCURRENCY) {
    const wave = chunks.slice(i, i + SEND_CONCURRENCY);
    // allSettled: que un lote falle entero no debe impedir el envío de los demás.
    const results = await Promise.allSettled(
      wave.map((batch) => admin.messaging().sendEachForMulticast({ ...base, tokens: batch }))
    );
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        ok += r.value.successCount;
        ko += r.value.failureCount;
      } else {
        ko += wave[idx].length;
        console.error("sendToTokens: un lote completo falló:", r.reason && r.reason.message);
      }
    });
  }
  return { ok, ko, total: all.length };
}

/**
 * Recolecta los tokens FCM de los usuarios de unas tiendas concretas.
 * El operador "in" de Firestore admite 30 valores → se trocea, y los trozos se
 * consultan en paralelo (son independientes entre sí).
 * Devuelve un Set (deduplica si un usuario apareciera dos veces).
 */
async function tokensForStores(db, stores) {
  const chunks = [];
  for (let i = 0; i < stores.length; i += 30) {
    chunks.push(stores.slice(i, i + 30));
  }

  const snaps = await Promise.all(
    chunks.map((chunk) => db().collection("users")
      .where("profile.store", "in", chunk)
      .select("profile.fcmToken")
      .get())
  );

  const tokens = new Set();
  snaps.forEach((snap) => snap.forEach((d) => {
    const t = d.data().profile && d.data().profile.fcmToken;
    if (t) tokens.add(t);
  }));
  return tokens;
}

module.exports = { NEWS_TOPIC, buildMessage, sendToNewsTopic, sendToTokens, tokensForStores };
