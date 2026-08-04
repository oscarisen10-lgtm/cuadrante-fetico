/**
 * Noticias y notificaciones push.
 *
 *   sendPushNotification  — broadcast al topic cuando el admin publica en `noticias`.
 *   sendStoreNews         — push DIRIGIDO de las noticias de delegado (`noticiasTienda`).
 *   notifyDelegadoNewUser — avisa a delegados + admin de una cuenta nueva por activar.
 *   subscribeToNewsTopic  — suscribe un token al topic (lo necesita el cliente web).
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, ENFORCE_APP_CHECK } = require("./lib/firebase");
const { ADMIN_EMAIL, requireAuth } = require("./lib/auth");
const { NEWS_TOPIC, sendToNewsTopic, sendToTokens, tokensForStores } = require("./lib/push");

/**
 * Migración ÚNICA a topics: suscribe al topic los tokens que ya estaban guardados en
 * los perfiles (usuarios con la app ANTIGUA, que aún no se auto-suscriben). Sin esto,
 * el primer push tras el despliegue no llegaría a nadie que no hubiera actualizado.
 * Se ejecuta una sola vez (doc marcador system/topicMigration); las apps nuevas se
 * suscriben solas en cada arranque. subscribeToTopic es idempotente, así que una
 * carrera entre dos pushes simultáneos es inofensiva.
 */
async function ensureTopicMigration() {
  const markerRef = db().collection("system").doc("topicMigration");
  const marker = await markerRef.get();
  if (marker.exists) return;

  const usersSnapshot = await db().collection("users").select("profile.fcmToken").get();
  const tokens = [];
  usersSnapshot.forEach((doc) => {
    const profile = doc.data().profile;
    if (profile && profile.fcmToken) tokens.push(profile.fcmToken);
  });

  // subscribeToTopic admite hasta 1000 tokens por llamada.
  for (let i = 0; i < tokens.length; i += 1000) {
    const chunk = tokens.slice(i, i + 1000);
    try {
      const res = await admin.messaging().subscribeToTopic(chunk, NEWS_TOPIC);
      console.log(`Migración a topic: lote ${i / 1000}: ${res.successCount} ok, ${res.failureCount} fallos (tokens muertos, ignorables).`);
    } catch (e) {
      console.error("Error suscribiendo lote a topic:", e);
    }
  }

  await markerRef.set({
    done: true,
    migratedTokens: tokens.length,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`Migración a topic completada: ${tokens.length} tokens.`);
}

/**
 * sendPushNotification — se dispara al crear un documento en `noticias`.
 * maxInstances acota el coste/concurrencia ante picos.
 */
exports.sendPushNotification = onDocumentCreated(
  { document: "noticias/{docId}", maxInstances: 5, timeoutSeconds: 300, memory: "256MiB" },
  async (event) => {
    const data = event.data.data();

    // Only react to explicit PUSH requests from admin
    if (data.isPushRequest !== true) {
      return null;
    }

    const title = data.title || "Nueva notificación";
    const body = data.desc || "";

    // Una sola vez tras el despliegue: pasa los tokens antiguos al topic.
    // Con try/catch propio: si la migración falla (fallo transitorio de Firestore),
    // el push al topic debe intentarse igualmente en vez de morir aquí sin log útil.
    try {
      await ensureTopicMigration();
    } catch (error) {
      console.error("ensureTopicMigration falló (se continúa con el envío):", error);
    }

    try {
      const messageId = await sendToNewsTopic(title, body);
      console.log(`Push enviado al topic "${NEWS_TOPIC}":`, messageId);
    } catch (error) {
      console.error("Error enviando push al topic:", error);
    }

    return null;
  }
);

/**
 * sendStoreNews — Push DIRIGIDO de las noticias de delegado (noticiasTienda).
 * Se dispara al crear una noticia de tienda con sendPush == true y la envía SOLO
 * a los usuarios de las tiendas destino, por TOKEN directo (multicast):
 *   - Funciona con las builds antiguas instaladas (no dependen de suscribirse a
 *     ningún topic nuevo): reciben el aviso aunque su app no muestre aún el feed.
 *   - El servidor RE-VALIDA que el autor es un delegado activo con esas tiendas
 *     autorizadas (las reglas ya lo exigen al crear el doc; doble cinturón).
 * Coste: una lectura por usuario de las tiendas destino (decenas) + el envío.
 */
exports.sendStoreNews = onDocumentCreated(
  { document: "noticiasTienda/{docId}", maxInstances: 5, timeoutSeconds: 300, memory: "256MiB" },
  async (event) => {
    const data = event.data.data();
    if (data.sendPush !== true) return null;

    const stores = Array.isArray(data.stores) ? data.stores.filter((s) => typeof s === "string" && s) : [];
    if (stores.length === 0) return null;

    // try/catch en todo el cuerpo: era la única de las tres funciones de push sin él,
    // así que un fallo transitorio de Firestore o FCM se propagaba sin ningún log
    // propio que dijera en qué fase murió.
    try {
      // Re-validación de autoría en servidor (defensa en profundidad).
      const delegadoSnap = await db().collection("delegados").doc(String(data.authorUid || "")).get();
      const delegado = delegadoSnap.exists ? delegadoSnap.data() : null;
      const authorized = delegado && delegado.active !== false &&
        Array.isArray(delegado.stores) && stores.every((s) => delegado.stores.includes(s));
      if (!authorized) {
        console.error(`sendStoreNews: autor ${data.authorUid} sin autorización para [${stores.join(", ")}]. No se envía.`);
        return null;
      }

      const tokens = await tokensForStores(db, stores);
      if (tokens.size === 0) {
        console.log(`sendStoreNews: sin dispositivos con push en [${stores.join(", ")}].`);
        return null;
      }

      const { ok, ko, total } = await sendToTokens(tokens, data.title || "Aviso de tu delegado", data.desc || "");
      console.log(`sendStoreNews → [${stores.join(", ")}]: ${ok} entregados, ${ko} fallos (tokens muertos, ignorables).`);
      // ok + ko < total ⇒ el envío se quedó a medias (p.ej. timeout). Sin este aviso,
      // el delegado creería que llegó a toda su plantilla.
      if (ok + ko < total) {
        console.error(`sendStoreNews: ENVÍO INCOMPLETO — ${ok + ko} de ${total} tokens procesados.`);
      }
    } catch (error) {
      console.error("sendStoreNews falló:", error);
    }
    return null;
  }
);

/**
 * notifyDelegadoNewUser — Al CREARSE una cuenta nueva PENDIENTE de activar, avisa por push
 * al/los delegado(s) de la tienda del nuevo usuario Y al admin (siempre), para que la
 * activen desde la app. Así ninguna cuenta pendiente se queda sin que nadie la active.
 * Solo dispara si:
 *   - membership.active === false (cuenta nueva pendiente), y
 *   - hay una tienda concreta (las auto-reparaciones nacen "Centro sin definir" y se ignoran).
 * Coste: 1 query a delegados + 1 query de sus tokens + 1 envío. Los registros son escasos.
 */
exports.notifyDelegadoNewUser = onDocumentCreated(
  { document: "users/{uid}", maxInstances: 5, timeoutSeconds: 120, memory: "256MiB" },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return null;

    // Solo cuentas nuevas pendientes de activar.
    if (!data.membership || data.membership.active !== false) return null;

    const profile = data.profile || {};
    const store = profile.store;
    // Sin tienda concreta no hay delegado a quien avisar.
    if (!store || store === "Centro sin definir") return null;

    try {
      const tokens = new Set(); // Set: dedup por si el admin es además delegado de la tienda.

      // Delegados ACTIVOS cuya lista de tiendas incluye la del nuevo usuario.
      const delegadosSnap = await db().collection("delegados")
        .where("stores", "array-contains", store)
        .get();
      const delegadoUids = delegadosSnap.docs
        .filter((d) => d.data().active !== false)
        .map((d) => d.id);

      // Tokens FCM de esos delegados (users/{uid}.profile.fcmToken; "in" admite 30).
      // Los trozos y la consulta del admin son independientes → todo en paralelo.
      const uidChunks = [];
      for (let i = 0; i < delegadoUids.length; i += 30) {
        uidChunks.push(delegadoUids.slice(i, i + 30));
      }
      const [delegadoSnaps, adminSnap] = await Promise.all([
        Promise.all(uidChunks.map((chunk) => db().collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .select("profile.fcmToken")
          .get())),
        // Avisar TAMBIÉN al admin (siempre, por su email fijo), sea delegado o no.
        db().collection("users")
          .where("profile.email", "==", ADMIN_EMAIL)
          .select("profile.fcmToken")
          .limit(1)
          .get(),
      ]);

      const collect = (snap) => snap.forEach((d) => {
        const t = d.data().profile && d.data().profile.fcmToken;
        if (t) tokens.add(t);
      });
      delegadoSnaps.forEach(collect);
      collect(adminSnap);

      if (tokens.size === 0) return null;

      const nombre = profile.fullName || "Un compañero/a";
      const title = "Nueva cuenta por activar";
      const body = `${nombre} se ha registrado en ${store}. Ábrela para activar su cuenta.`;

      const { ok, ko } = await sendToTokens(tokens, title, body);
      console.log(`notifyDelegadoNewUser → ${store}: ${ok} avisados, ${ko} fallos.`);
    } catch (e) {
      console.error("notifyDelegadoNewUser error:", e);
    }
    return null;
  }
);

/**
 * subscribeToNewsTopic — Suscribe un token FCM al topic de noticias.
 * La usan los clientes WEB: el SDK web de FCM no puede suscribirse a topics por sí
 * mismo (requiere la API de servidor). Los clientes nativos usan el plugin FCM
 * directamente. Idempotente: re-suscribirse en cada arranque es gratis e inofensivo.
 */
exports.subscribeToNewsTopic = onCall({ maxInstances: 10, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAuth(request, HttpsError);
  const token = request.data?.token;
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) {
    throw new HttpsError("invalid-argument", "Token no válido.");
  }
  try {
    await admin.messaging().subscribeToTopic(token, NEWS_TOPIC);
    return { success: true };
  } catch (error) {
    console.error("Error suscribiendo al topic:", error);
    throw new HttpsError("internal", "No se pudieron activar las notificaciones.");
  }
});
