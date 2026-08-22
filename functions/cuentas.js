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
const { isAdminToken, requireAuth, getDelegadoDoc, isUserActive } = require("./lib/auth");
const { isValidStore } = require("./lib/validStores");

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
// timeout ampliado: purgeUserData hace un recursiveDelete de las subcolecciones del
// usuario (turnos mensuales, turnos diarios legacy, peticiones), y con años de
// historial eso no siempre cabe en los 60 s por defecto.
exports.deleteMyAccount = onCall({
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
  timeoutSeconds: 300,
}, async (request) => {
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
 * cambiarMiTienda — ÚNICA vía para que un usuario cambie su tienda (y, de paso, su
 * empresa/rango, porque en la app cambiar de empresa arrastra la tienda).
 *
 * ⚠️ POR QUÉ EXISTE (auditoría 22-ago-2026). `profile.store` no es un dato decorativo:
 * es la clave con la que
 *   - `firestore.rules` decide qué noticias de delegado puedes leer,
 *   - `delegadoListUsers` / `delegadoCensusCounts` construyen el censo del delegado,
 *   - `requireCanManageUser` decide qué delegado puede gestionarte.
 * Mientras el cliente pudo escribirlo directamente, cualquier empleado ya activado
 * podía cambiarse de tienda en Ajustes y aparecer en el censo del delegado nuevo como
 * si ese delegado le hubiera verificado, además de leerle las noticias internas.
 *
 * Ahora las reglas prohíben tocar `profile.store` desde el cliente y esta función es
 * el único camino: cambiar de tienda DEVUELVE LA CUENTA A PENDIENTE, para que el
 * delegado de la tienda nueva la verifique. Admin y delegados quedan exentos (si no,
 * un delegado se bloquearía a sí mismo su propia pestaña al corregir su tienda).
 */
exports.cambiarMiTienda = onCall({ maxInstances: 10, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = requireAuth(request, HttpsError);

  // "" es válido: en la app, cambiar de EMPRESA vacía la tienda (las listas de tiendas
  // son distintas por empresa) y obliga a reelegirla.
  //
  // Validado contra el catálogo real (auditoría 22-ago-2026, F-04): antes solo la
  // longitud se comprobaba aquí, y el desplegable del cliente era la única barrera
  // real. Una llamada directa a la callable podía dejar a un usuario con una tienda
  // inexistente, invisible para cualquier delegado y por tanto atascado en pendiente
  // para siempre (sin vía de auto-recuperación, solo el admin podía arreglarlo a mano).
  const store = String(request.data?.store ?? "").trim();
  if (store.length > 80 || !isValidStore(store)) {
    throw new HttpsError("invalid-argument", "Tienda no válida.");
  }

  const ref = db().collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Tu perfil todavía no existe.");
  }
  const data = snap.data();
  const profile = data.profile || {};

  // Las cuentas de fuera de ANGED nacen ACTIVAS sin que ningún delegado las verifique,
  // y a cambio quedan encerradas SIN tienda (ver esAltaNoVerificada en firestore.rules).
  // Dejarlas ponerse una tienda real sería saltarse al delegado por la puerta de atrás.
  if (profile.companyVerified === false) {
    throw new HttpsError(
      "permission-denied",
      "Tu cuenta es de una empresa de fuera de ANGED y no puede asignarse una tienda."
    );
  }

  // Sin cambio real no se toca membership: así abrir Ajustes y reelegir la misma
  // tienda no devuelve la cuenta a pendiente sin motivo. Se normaliza porque un perfil
  // antiguo puede no tener el campo, y `undefined === ""` sería un falso cambio.
  if (String(profile.store || "") === store) {
    return { success: true, store, pendiente: !isUserActive(data) };
  }

  // Admin y delegados no se degradan: se quedarían sin acceso a su propia gestión.
  const esDelegado = !!(await getDelegadoDoc(uid));
  const mantieneActiva = isAdminToken(request.auth.token) || esDelegado;

  const update = { profile: { store } };

  const company = request.data?.company;
  if (typeof company === "string" && company.trim() && company.length <= 80) {
    update.profile.company = company.trim();
  }
  const rank = request.data?.rank;
  if (typeof rank === "string" && rank.trim() && rank.length <= 80) {
    update.profile.rank = rank.trim();
  }

  if (!mantieneActiva) {
    update.membership = {
      active: false,
      updatedAt: Date.now(),
      updatedBy: uid,
      reason: "cambio-de-tienda",
    };
  }

  await ref.set(update, { merge: true });

  return { success: true, store, pendiente: !mantieneActiva };
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
