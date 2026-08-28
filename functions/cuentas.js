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
const { NEWS_TOPIC, tokensFromProfile } = require("./lib/push");
const { isAdminToken, requireAuth, getDelegadoDoc, isUserActive } = require("./lib/auth");
const { isValidStore, isAngedCompany, storeBelongsToCompany } = require("./lib/validStores");

/**
 * purgeUserData — Borra de Firestore TODO lo asociado a un uid (perfil + subcolecciones,
 * peticiones y noticias de delegado) y da de baja su token del topic de noticias. NO toca
 * la cuenta de Auth. Idempotente: si los datos ya no existen, es un no-op (por eso da
 * igual que los dos caminos se solapen).
 */
async function purgeUserData(uid) {
  // Tokens FCM antes de borrar nada, para dar de baja del topic de noticias TODOS sus
  // dispositivos (no solo uno: una misma cuenta puede estar en el móvil y en la tablet).
  const userSnap = await db().collection("users").doc(uid).get();
  const fcmTokens = userSnap.exists ? tokensFromProfile(userSnap.data().profile) : [];

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

  // 4) Su alta como delegado, si la tuviera. Sin esto quedaba un doc HUÉRFANO en
  //    `delegados/{uidViejo}`: el admin lo seguía viendo en su lista, y "retirar" no
  //    lo podía borrar porque adminSetDelegado resuelve el email al uid ACTUAL — que
  //    tras recrear la cuenta es otro. Borrar es idempotente si no existe.
  await db().collection("delegados").doc(uid).delete()
    .catch((e) => console.warn("No se pudo borrar el doc de delegado:", e.message));

  // 5) Baja del topic de noticias (mejor esfuerzo: si falla, no aborta el borrado).
  if (fcmTokens.length > 0) {
    await admin.messaging().unsubscribeFromTopic(fcmTokens, NEWS_TOPIC)
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
 *
 * ── CAMBIO DE EMPRESA EN LOS DOS SENTIDOS (28-ago-2026) ──────────────────────
 * Antes esta función RECHAZABA en seco a las cuentas de fuera de ANGED
 * (companyVerified === false): quien se registraba en "Otra empresa" se quedaba
 * ahí para siempre, y nadie —ni el delegado, pese a lo que decía el aviso de
 * Ajustes— tenía forma de sacarle. Ahora se permiten los dos caminos:
 *
 *   Otra empresa → ANGED: se marca companyVerified = true y la cuenta VUELVE A
 *     PENDIENTE en cuanto elige una tienda real. Esto es lo que impide que el
 *     camino sea un atajo para saltarse al delegado: esas cuentas nacen activas
 *     porque nadie puede verificarlas, así que al entrar en una tienda concreta
 *     —que es lo que da acceso a las noticias del delegado y le mete en su
 *     censo— hay que pasar por la verificación como cualquier alta.
 *
 *   ANGED → Otra empresa: se marca companyVerified = false y se vacían tienda y
 *     rango EN LA MISMA ESCRITURA. Vaciar la tienda es imprescindible: si se
 *     quedara puesta, el usuario seguiría leyendo las noticias de su antiguo
 *     delegado y contando en su censo mientras declara trabajar en otro sitio.
 *     La cuenta SE QUEDA ACTIVA: fuera de ANGED no hay ningún delegado que
 *     pudiera reactivarla, así que degradarla sería encerrarla para siempre.
 *
 * La combinación empresa/tienda se valida contra el catálogo (storeBelongsToCompany):
 * sin eso, una llamada directa podía declarar "ECI" con una tienda de Exprés y
 * colarse en el censo de un delegado que no es el suyo.
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

  // ¿Se pide cambiar de empresa, o solo de tienda? Se distingue "no viene empresa"
  // de "viene una", porque no son lo mismo: un perfil antiguo puede no tener
  // `company` guardada, y tratar esa ausencia como "está fuera de ANGED" le
  // vaciaría la tienda sin que nadie lo hubiera pedido.
  const companyRaw = request.data?.company;
  const companyPedida = typeof companyRaw === "string" && companyRaw.trim()
    ? companyRaw.trim()
    : null;
  if (companyPedida && companyPedida.length > 80) {
    throw new HttpsError("invalid-argument", "Empresa no válida.");
  }

  const eraNoVerificada = profile.companyVerified === false;
  const company = companyPedida ?? String(profile.company || "");

  // `saleDeAnged` mira el DESTINO. Sin empresa pedida se conserva el estado actual:
  // esta llamada es entonces un simple cambio de tienda.
  const saleDeAnged = companyPedida ? !isAngedCompany(companyPedida) : eraNoVerificada;

  // Fuera de ANGED nadie tiene tienda: es lo que las reglas llaman
  // esAltaNoVerificada, y lo que impide leer las noticias de un delegado ajeno.
  const storeFinal = saleDeAnged ? "" : store;

  // La pertenencia SOLO se comprueba contra la empresa que llega en ESTA llamada,
  // nunca contra la que ya tuviera guardada.
  //
  // ⚠️ No es un matiz: hasta el 28-ago-2026 el desplegable ofrecía TODAS las tiendas
  // a quien elegía "Supercor" (ese era el fallo de Exprés), así que hay usuarios ya
  // registrados como Supercor trabajando en centros que ahora clasificamos como
  // Exprés. Validar contra su empresa guardada les dejaría sin poder cambiarse de
  // tienda nunca más — les romperíamos la app por corregir un dato nuestro.
  if (!saleDeAnged && companyPedida && !storeBelongsToCompany(storeFinal, companyPedida)) {
    throw new HttpsError("invalid-argument", "Esa tienda no es de esa empresa.");
  }

  // Un delegado que se marchara de ANGED conservaría su doc `delegados/{uid}` con
  // sus tiendas: seguiría gestionando el censo de una empresa en la que ya no dice
  // trabajar. Que el admin le retire primero.
  const esDelegado = !!(await getDelegadoDoc(uid));
  if (saleDeAnged && esDelegado) {
    throw new HttpsError(
      "failed-precondition",
      "Eres delegado: el administrador tiene que retirarte antes de cambiarte a una empresa de fuera."
    );
  }

  // Sin cambio real no se toca membership: así abrir Ajustes y reelegir lo mismo no
  // devuelve la cuenta a pendiente sin motivo. Se normaliza porque un perfil antiguo
  // puede no tener los campos, y `undefined === ""` sería un falso cambio.
  const mismaEmpresa = String(profile.company || "") === company &&
                       eraNoVerificada === saleDeAnged;
  if (String(profile.store || "") === storeFinal && mismaEmpresa) {
    return { success: true, store: storeFinal, pendiente: !isUserActive(data) };
  }

  const update = { profile: { store: storeFinal } };

  // La empresa solo se toca si se ha pedido cambiarla. Escribir `company` y
  // `companyVerified` en un simple cambio de tienda le pondría empresa a perfiles
  // antiguos que no la tenían, y eso decide su convenio.
  if (companyPedida) {
    update.profile.company = companyPedida;
    update.profile.companyVerified = !saleDeAnged;
  }

  // El rango es del convenio: fuera de ANGED no significa nada y se vacía.
  const rank = request.data?.rank;
  if (saleDeAnged) {
    update.profile.rank = "";
  } else if (typeof rank === "string" && rank.trim() && rank.length <= 80) {
    update.profile.rank = rank.trim();
  }

  // ¿Hay que devolver la cuenta a PENDIENTE?
  //   - Admin y delegados nunca: se quedarían sin acceso a su propia gestión.
  //   - Quien SALE de ANGED tampoco: ahí fuera no hay delegado que pueda
  //     reactivarle, así que degradarle sería encerrarle para siempre.
  //   - Solo cuando acaba en una tienda REAL. Con la tienda vacía (paso
  //     intermedio: se elige empresa y luego centro) la cuenta sería invisible
  //     para todo delegado —el censo va por tienda— y se quedaría atascada en
  //     pendiente sin que nadie pudiera verla para activarla.
  const exento = isAdminToken(request.auth.token) || esDelegado;
  const pasaAPendiente = !exento && !saleDeAnged && storeFinal !== "" &&
                         storeFinal !== "Centro sin definir";

  if (pasaAPendiente) {
    update.membership = {
      active: false,
      updatedAt: Date.now(),
      updatedBy: uid,
      reason: eraNoVerificada ? "alta-en-anged" : "cambio-de-tienda",
    };
  }

  await ref.set(update, { merge: true });

  return { success: true, store: storeFinal, pendiente: pasaAPendiente };
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
