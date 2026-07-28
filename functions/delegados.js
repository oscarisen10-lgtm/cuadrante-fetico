/**
 * DELEGADOS y ADMINISTRACIÓN — activación de cuentas de afiliados por tienda.
 *
 * Modelo: users/{uid}.membership.active gobierna si la cuenta está activada.
 *   - membership AUSENTE  → cuenta anterior al sistema de delegados → ACTIVA
 *     (así los usuarios existentes quedan activados sin migración).
 *   - Los registros nuevos nacen con membership.active == false (lo exigen las
 *     reglas de Firestore) y un delegado/admin los activa desde la app.
 * La colección delegados/{uid} guarda qué tiendas puede gestionar cada delegado;
 * la administra solo el admin (vía adminSetDelegado).
 *
 * Todo pasa por callables con Admin SDK: las reglas impiden que un cliente lea
 * perfiles ajenos o toque membership.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, ENFORCE_APP_CHECK } = require("./lib/firebase");
const { ADMIN_EMAIL, isAdminToken, requireAuth, getDelegadoDoc, isUserActive } = require("./lib/auth");

/** Lanza si quien llama no es el admin. */
const requireAdmin = (request, mensaje) => {
  if (!isAdminToken(request.auth && request.auth.token)) {
    throw new HttpsError("permission-denied", mensaje);
  }
};

/**
 * adminStats — Recuentos agregados para el panel de administración (SOLO admin).
 * Devuelve cuántos usuarios hay en total y por plataforma (iOS / Android / web / sin
 * determinar), cuántos han usado "Fichar" y cuántos tienen push activo. No expone ningún
 * dato personal, solo cifras. Los campos profile.platform y profile.hasFichado los escribe
 * el cliente (ver recordDeviceMeta / markFichado).
 */
exports.adminStats = onCall({ maxInstances: 5, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAdmin(request, "Solo el administrador puede ver las estadísticas.");

  // .select() proyecta solo los campos necesarios (menos ancho de banda al crecer).
  const snap = await db().collection("users")
    .select("profile.platform", "profile.hasFichado", "profile.fcmToken")
    .get();

  let total = 0, ios = 0, android = 0, web = 0, desconocido = 0, fichadores = 0, conPush = 0;
  snap.forEach((d) => {
    total += 1;
    const p = d.data().profile || {};
    if (p.platform === "ios") ios += 1;
    else if (p.platform === "android") android += 1;
    else if (p.platform === "web") web += 1;
    else desconocido += 1;
    if (p.hasFichado) fichadores += 1;
    if (p.fcmToken) conPush += 1;
  });

  return { total, ios, android, web, desconocido, fichadores, conPush };
});

/**
 * delegadoListUsers — Lista los usuarios de UNA tienda para el delegado que la
 * tenga autorizada (o el admin, que puede ver cualquiera). Devuelve los datos
 * que el delegado necesita para cotejar el censo: nombre, sección, teléfono,
 * email, plataforma, si tiene push y su estado de activación.
 *
 * store == "__ALL__" (opción "Total" de la app): el admin recibe TODOS los
 * usuarios (un solo escaneo, como adminOverview) y el delegado los de todas
 * sus tiendas autorizadas juntas — en una llamada, no una por tienda.
 */
const LIST_USERS_FIELDS = [
  "profile.fullName", "profile.email", "profile.phone", "profile.section",
  "profile.store", "profile.fcmToken", "profile.platform", "membership",
];

exports.delegadoListUsers = onCall({ maxInstances: 10, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = requireAuth(request, HttpsError);
  const store = request.data?.store;
  if (typeof store !== "string" || !store.trim() || store.length > 80) {
    throw new HttpsError("invalid-argument", "Tienda no válida.");
  }

  const isAdminCaller = isAdminToken(request.auth.token);
  let docs = [];

  if (store === "__ALL__") {
    if (isAdminCaller) {
      const snap = await db().collection("users").select(...LIST_USERS_FIELDS).get();
      docs = snap.docs;
    } else {
      const delegado = await getDelegadoDoc(uid);
      const stores = delegado && Array.isArray(delegado.stores) ? delegado.stores : [];
      if (stores.length === 0) {
        throw new HttpsError("permission-denied", "No tienes tiendas autorizadas.");
      }
      // El operador "in" admite 30 valores por consulta → troceamos por si acaso.
      for (let i = 0; i < stores.length; i += 30) {
        const snap = await db().collection("users")
          .where("profile.store", "in", stores.slice(i, i + 30))
          .select(...LIST_USERS_FIELDS)
          .get();
        docs.push(...snap.docs);
      }
    }
  } else {
    if (!isAdminCaller) {
      const delegado = await getDelegadoDoc(uid);
      if (!delegado || !Array.isArray(delegado.stores) || !delegado.stores.includes(store)) {
        throw new HttpsError("permission-denied", "No tienes autorizada esta tienda.");
      }
    }
    const snap = await db().collection("users")
      .where("profile.store", "==", store)
      .select(...LIST_USERS_FIELDS)
      .get();
    docs = snap.docs;
  }

  const users = docs.map((d) => {
    const data = d.data();
    const p = data.profile || {};
    return {
      uid: d.id,
      fullName: p.fullName || "(sin nombre)",
      email: p.email || "",
      phone: p.phone || "",
      section: p.section || "Sin especificar",
      store: p.store || "Sin tienda",
      platform: p.platform || "",
      hasPush: !!p.fcmToken,
      active: isUserActive(data),
      expelled: !!(data.membership && data.membership.expelled),
    };
  })
    // Los EXPULSADOS (se fueron de la empresa) desaparecen para el delegado;
    // el admin sí los ve (con etiqueta), para poder readmitirlos si hace falta.
    .filter((u) => isAdminCaller || !u.expelled)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));

  return { users };
});

/**
 * Comprueba que quien llama puede gestionar al usuario objetivo: o es admin, o es
 * delegado de la tienda de ese usuario. Además, un delegado NUNCA puede tocar la
 * cuenta del admin. Devuelve el snapshot del usuario para no releerlo.
 */
async function requireCanManageUser(request, targetUid) {
  const userRef = db().collection("users").doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "El usuario no existe.");
  }

  if (!isAdminToken(request.auth.token)) {
    const delegado = await getDelegadoDoc(request.auth.uid);
    const targetStore = (userSnap.data().profile || {}).store || "";
    if (!delegado || !Array.isArray(delegado.stores) || !delegado.stores.includes(targetStore)) {
      throw new HttpsError("permission-denied", "Ese usuario no pertenece a tus tiendas autorizadas.");
    }
    if ((userSnap.data().profile || {}).email === ADMIN_EMAIL) {
      throw new HttpsError("permission-denied", "No puedes modificar esa cuenta.");
    }
  }

  return userRef;
}

/**
 * delegadoExpelUser — "Expulsa" a un usuario que se fue de la empresa: NO borra
 * nada ni le bloquea la app (su cuenta queda ACTIVA por si quiere seguir
 * usándola); solo lo marca para que desaparezca de las listas y del censo del
 * delegado. Con { expelled: false } se readmite (lo usa el admin).
 */
exports.delegadoExpelUser = onCall({ maxInstances: 10, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAuth(request, HttpsError);
  const targetUid = request.data?.uid;
  const expelled = request.data?.expelled;
  if (typeof targetUid !== "string" || !targetUid || typeof expelled !== "boolean") {
    throw new HttpsError("invalid-argument", "Parámetros no válidos.");
  }

  const userRef = await requireCanManageUser(request, targetUid);

  await userRef.set({
    membership: {
      // La cuenta queda ACTIVA a propósito: expulsar solo la oculta al delegado.
      active: true,
      expelled,
      expelledAt: expelled ? Date.now() : null,
      updatedAt: Date.now(),
      updatedBy: request.auth.uid,
    },
  }, { merge: true });

  return { success: true, uid: targetUid, expelled };
});

/**
 * delegadoCensusCounts — Recuentos para el CENSO del delegado: cuántos usuarios
 * (y cuántos activos) hay en cada una de sus tiendas autorizadas.
 *
 * COSTE MÍNIMO a propósito: usa consultas de AGREGACIÓN count(), que cuestan
 * 1 lectura por cada 1000 documentos contados (mínimo 1) — es decir, 2 lecturas
 * por tienda aunque tenga cientos de usuarios, en vez de leer doc a doc.
 */
exports.delegadoCensusCounts = onCall({ maxInstances: 10, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = requireAuth(request, HttpsError);
  const delegado = await getDelegadoDoc(uid);
  const stores = delegado && Array.isArray(delegado.stores) ? delegado.stores : [];
  if (stores.length === 0) {
    throw new HttpsError("permission-denied", "No tienes tiendas autorizadas.");
  }

  const counts = {};
  await Promise.all(stores.map(async (store) => {
    const base = db().collection("users").where("profile.store", "==", store);
    // membership AUSENTE = activo, así que contamos el total y los explícitamente
    // desactivados (membership.active == false): activos = total - desactivados.
    // Los EXPULSADOS (se fueron de la empresa, siempre quedan con active==true)
    // se descuentan de ambos: para el delegado no existen.
    const [totalSnap, inactiveSnap, expelledSnap] = await Promise.all([
      base.count().get(),
      base.where("membership.active", "==", false).count().get(),
      base.where("membership.expelled", "==", true).count().get(),
    ]);
    const total = totalSnap.data().count;
    const expelled = expelledSnap.data().count;
    counts[store] = {
      users: Math.max(0, total - expelled),
      activos: Math.max(0, total - inactiveSnap.data().count - expelled),
    };
  }));

  return { counts };
});

/**
 * delegadoSetActive — Activa o desactiva la cuenta de un usuario. Puede hacerlo
 * el admin (cualquier usuario) o un delegado cuya lista de tiendas incluya la
 * tienda del usuario objetivo. No borra nada: solo cambia membership.active,
 * dejando rastro de quién y cuándo.
 */
exports.delegadoSetActive = onCall({ maxInstances: 10, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAuth(request, HttpsError);
  const targetUid = request.data?.uid;
  const active = request.data?.active;
  if (typeof targetUid !== "string" || !targetUid || typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "Parámetros no válidos.");
  }

  const userRef = await requireCanManageUser(request, targetUid);

  await userRef.set({
    membership: {
      active,
      updatedAt: Date.now(),
      updatedBy: request.auth.uid,
    },
  }, { merge: true });

  return { success: true, uid: targetUid, active };
});

/**
 * adminSetDelegado — SOLO admin. Nombra un delegado (por email) con su lista de
 * tiendas autorizadas, o lo retira ({ remove: true }). El doc vive en
 * delegados/{uid}; la app del delegado lo lee para mostrar su pestaña.
 */
exports.adminSetDelegado = onCall({ maxInstances: 5, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAdmin(request, "Solo el administrador puede gestionar delegados.");
  const email = String(request.data?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "Email no válido.");
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    throw new HttpsError("not-found", "No existe ninguna cuenta con ese email.");
  }
  const uid = userRecord.uid;
  const ref = db().collection("delegados").doc(uid);

  if (request.data?.remove === true) {
    await ref.delete();
    return { success: true, uid, removed: true };
  }

  const stores = request.data?.stores;
  if (!Array.isArray(stores) || stores.length === 0 ||
      !stores.every((s) => typeof s === "string" && s.trim() && s.length <= 80)) {
    throw new HttpsError("invalid-argument", "Debes indicar al menos una tienda.");
  }

  const userSnap = await db().collection("users").doc(uid).get();
  const fullName = (userSnap.exists && userSnap.data().profile && userSnap.data().profile.fullName) || email;

  await ref.set({
    email,
    fullName,
    stores,
    active: true,
    updatedAt: Date.now(),
    updatedBy: request.auth.uid,
  });

  // El delegado siempre queda con su propia cuenta activada.
  await db().collection("users").doc(uid).set({
    membership: { active: true, updatedAt: Date.now(), updatedBy: request.auth.uid },
  }, { merge: true });

  return { success: true, uid, fullName, stores };
});

/**
 * adminOverview — SOLO admin. Panel de Gestión: totales de usuarios (activos,
 * pendientes, con push) y la lista de delegados con cuántos usuarios/afiliados
 * activos tiene cada uno en sus tiendas (desglose por tienda incluido).
 */
exports.adminOverview = onCall({ maxInstances: 5, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAdmin(request, "Solo el administrador puede ver el panel de gestión.");

  const usersSnap = await db().collection("users")
    .select("profile.store", "profile.fcmToken", "membership")
    .get();

  let total = 0, activos = 0, conPush = 0, expulsados = 0;
  const byStore = {}; // { tienda: { total, activos } } — sin expulsados (no cuentan para los delegados)
  usersSnap.forEach((d) => {
    const data = d.data();
    const p = data.profile || {};
    total += 1;
    if (p.fcmToken) conPush += 1;
    const expelled = !!(data.membership && data.membership.expelled);
    if (expelled) { expulsados += 1; return; }
    const active = isUserActive(data);
    if (active) activos += 1;
    const store = p.store || "Sin tienda";
    if (!byStore[store]) byStore[store] = { total: 0, activos: 0 };
    byStore[store].total += 1;
    if (active) byStore[store].activos += 1;
  });

  const delegadosSnap = await db().collection("delegados").get();
  const delegados = delegadosSnap.docs.map((d) => {
    const data = d.data();
    const stores = Array.isArray(data.stores) ? data.stores : [];
    const perStore = stores.map((s) => ({
      store: s,
      users: (byStore[s] && byStore[s].total) || 0,
      activos: (byStore[s] && byStore[s].activos) || 0,
    }));
    return {
      uid: d.id,
      fullName: data.fullName || data.email || "(delegado)",
      email: data.email || "",
      active: data.active !== false,
      stores,
      userCount: perStore.reduce((acc, s) => acc + s.users, 0),
      activeCount: perStore.reduce((acc, s) => acc + s.activos, 0),
      perStore,
    };
  }).sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));

  return {
    totals: { total, activos, pendientes: total - activos - expulsados, expulsados, conPush },
    delegados,
  };
});
