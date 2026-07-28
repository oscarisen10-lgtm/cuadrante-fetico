/**
 * Ciclo de vida de la cuenta: borrado voluntario y limpieza de huérfanos.
 *
 * Los DOS caminos comparten `purgeUserData`, que es idempotente:
 *   deleteMyAccount      — el usuario borra su cuenta desde la app.
 *   cleanupOnAuthDelete   — se elimina la cuenta de Auth desde CUALQUIER sitio
 *                           (app, Admin SDK o la consola de Firebase).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
// v1: los triggers de ciclo de vida de Auth (onDelete) son de 1ª generación. Convive sin
// problema con las funciones v2 del resto del backend.
const functionsV1 = require("firebase-functions/v1");
const { admin, db, ENFORCE_APP_CHECK } = require("./lib/firebase");
const { NEWS_TOPIC } = require("./lib/push");

/**
 * purgeUserData — Borra de Firestore TODO lo asociado a un uid (perfil + subcolecciones,
 * peticiones y noticias de delegado) y da de baja su token del topic de noticias. NO toca
 * la cuenta de Auth. Idempotente: si los datos ya no existen, es un no-op (por eso da
 * igual que los dos caminos se solapen).
 */
async function purgeUserData(uid) {
  // Token FCM antes de borrar nada, para dar de baja el dispositivo del topic de noticias.
  const userSnap = await db().collection("users").doc(uid).get();
  const fcmToken = (userSnap.exists && userSnap.data().profile && userSnap.data().profile.fcmToken) || null;

  // 1) Documento de usuario + subcolecciones (shifts, shiftMonths, usage) en una pasada.
  await db().recursiveDelete(db().collection("users").doc(uid));

  // 2) Peticiones del usuario (colección de nivel superior). Se conserva la colección
  //    `requests` solo por las peticiones que dejaran las builds antiguas.
  const reqSnap = await db().collection("requests").where("uid", "==", uid).get();
  for (let i = 0; i < reqSnap.docs.length; i += 400) {
    const batch = db().batch();
    reqSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 3) Sus noticias de delegado, si las tuviera (llevan su nombre → RGPD).
  const newsSnap = await db().collection("noticiasTienda").where("authorUid", "==", uid).get();
  for (let i = 0; i < newsSnap.docs.length; i += 400) {
    const batch = db().batch();
    newsSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 4) Baja del topic de noticias (mejor esfuerzo: si falla, no aborta el borrado).
  if (fcmToken) {
    await admin.messaging().unsubscribeFromTopic(fcmToken, NEWS_TOPIC)
      .catch((e) => console.warn("No se pudo desuscribir del topic:", e.message));
  }
}

/**
 * deleteMyAccount — Borra la cuenta del usuario que llama, ENTERA y desde el servidor.
 * Antes el borrado era en el cliente y tenía dos problemas:
 *   1) deleteUser() de Auth falla con "requires-recent-login" muy a menudo → quedaba la
 *      cuenta de Auth viva con los datos ya borrados y, al reloguear, se recreaba un
 *      perfil por defecto (borrado fantasma).
 *   2) No limpiaba huérfanos: la subcolección `usage` ni las `requests` (relevante para RGPD).
 * El Admin SDK ignora "requires-recent-login" y borra todo de forma consistente.
 */
exports.deleteMyAccount = onCall({ maxInstances: 5, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const uid = request.auth.uid;

  try {
    // 1) Datos de Firestore + baja del topic (helper compartido con cleanupOnAuthDelete).
    await purgeUserData(uid);

    // 2) La cuenta de Auth, al final (el Admin SDK no exige login reciente). Esto dispara
    // además cleanupOnAuthDelete, pero los datos ya no están → repaso idempotente inofensivo.
    await admin.auth().deleteUser(uid);

    return { success: true };
  } catch (error) {
    console.error("Error borrando la cuenta:", error);
    throw new HttpsError("internal", "No se pudo borrar la cuenta por completo. Inténtalo de nuevo.");
  }
});

/**
 * cleanupOnAuthDelete — Trigger de Auth (1ª gen): salta cuando se ELIMINA cualquier cuenta de
 * Authentication, venga de donde venga (app, Admin SDK o la consola de Firebase). Limpia los
 * datos de Firestore para que NUNCA quede un perfil huérfano — que si no, seguiría apareciendo
 * en las listas de admin/delegado, porque esas se leen de la colección `users` (no de Auth).
 * Región europe-west1 como el resto del backend. Nunca lanza: registra el error y sigue.
 */
exports.cleanupOnAuthDelete = functionsV1
  .region("europe-west1")
  .auth.user()
  .onDelete(async (user) => {
    try {
      await purgeUserData(user.uid);
      console.log(`cleanupOnAuthDelete → datos de ${user.uid} eliminados de Firestore.`);
    } catch (e) {
      console.error("cleanupOnAuthDelete error:", e);
    }
  });
