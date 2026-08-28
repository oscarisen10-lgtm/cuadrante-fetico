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
const { isAdminToken, isProtectedAdminAccount, requireAuth, getDelegadoDoc, isUserActive } = require("./lib/auth");
const { VALID_STORES } = require("./lib/validStores");
const { TOKEN_FIELDS, tokensFromProfile } = require("./lib/push");

/** Lanza si quien llama no es el admin. */
const requireAdmin = (request, mensaje) => {
  if (!isAdminToken(request.auth && request.auth.token)) {
    throw new HttpsError("permission-denied", mensaje);
  }
};

// ── Caché de los paneles agregados (adminStats / adminOverview) ───────────────
// Ambos recorren la colección `users` ENTERA para devolver cifras. Con cientos de
// usuarios es instantáneo; a decenas de miles, cada apertura del panel costaría una
// lectura por usuario, y abrirlo tres veces seguidas costaría el triple sin que los
// números hubieran cambiado apenas.
//
// Se guarda el resultado en `system/{docId}` durante unos minutos. El panel tiene su
// propio botón de recargar, que envía { refresh: true } y fuerza el recálculo — así
// la caché nunca impide ver el dato recién actualizado cuando de verdad hace falta.
const PANEL_CACHE_TTL_MS = 5 * 60 * 1000;

async function withPanelCache(docId, wantsFresh, compute) {
  const ref = db().collection("system").doc(docId);

  if (!wantsFresh) {
    try {
      const snap = await ref.get();
      const cached = snap.exists ? snap.data() : null;
      if (cached && typeof cached.computedAt === "number" &&
          Date.now() - cached.computedAt < PANEL_CACHE_TTL_MS) {
        return { ...cached.payload, cachedAt: cached.computedAt };
      }
    } catch (e) {
      // La caché es una optimización, no una dependencia: si falla, se recalcula.
      console.warn(`Caché de ${docId} no disponible, se recalcula:`, e.message);
    }
  }

  const payload = await compute();
  // Mejor esfuerzo: no dejar sin respuesta al admin porque no se pudiera cachear.
  ref.set({ payload, computedAt: Date.now() })
    .catch((e) => console.warn(`No se pudo guardar la caché de ${docId}:`, e.message));
  return payload;
}

// Ventana de "usuarios activos": días hacia atrás desde hoy. La app sella
// profile.lastActiveAt al arrancar (ver recordActivity en el cliente).
const ACTIVOS_VENTANA_DIAS = 7;

// Ventanas de ABANDONO. No existe ninguna señal fiable de "ha desinstalado la
// app": ni Google ni Apple la mandan. Lo más cercano es cruzar dos indicios:
//   - lleva mucho sin abrir la app (lastActiveAt viejo), y
//   - su push está muerto (profile.pushMuerto, que pone purgeDeadTokens cuando
//     FCM responde que sus tokens ya no existen).
// Ninguno de los dos es prueba: se puede tener la app instalada y no abrirla en
// dos meses. Por eso se dan por separado y NO se llaman "desinstalaciones".
const INACTIVOS_VENTANAS_DIAS = [30, 60];
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Actividad de cada delegado: cuántas noticias ha publicado y cuántos push ha
 * lanzado. Ambos viven en `noticiasTienda`; los push son los docs con
 * sendPush == true (y van marcados isPushRequest, por eso no salen en el feed).
 * Se recorre la colección entera, pero solo la escriben los delegados, así que
 * es de un orden mucho menor que `users`.
 *
 * Se cruza con los delegados VIGENTES: retirar a un delegado (adminSetDelegado
 * con remove:true) borra su doc en `delegados` pero no sus noticias antiguas, así
 * que sin este cruce un ex-delegado seguiría contando aquí para siempre (y podía
 * salir "más delegados con noticia que delegados totales").
 */
async function contarDelegadosConActividad() {
  const delegadosSnap = await db().collection("delegados").select("fullName", "email").get();
  const delegadosVigentes = new Map(
    delegadosSnap.docs.map((d) => [d.id, d.data().fullName || d.data().email || "Delegado/a"])
  );

  const porDelegado = new Map();

  const stream = db().collection("noticiasTienda")
    .select("authorUid", "sendPush")
    .stream();

  for await (const d of stream) {
    const n = d.data();
    const uid = typeof n.authorUid === "string" ? n.authorUid : null;
    // Ignora noticias de quien ya no es delegado: sus cifras históricas ya no
    // representan a nadie actual del panel.
    if (!uid || !delegadosVigentes.has(uid)) continue;
    const acc = porDelegado.get(uid) || { uid, nombre: delegadosVigentes.get(uid), noticias: 0, pushes: 0 };
    if (n.sendPush === true) acc.pushes += 1;
    else acc.noticias += 1;
    porDelegado.set(uid, acc);
  }

  const actividad = [...porDelegado.values()]
    .sort((a, b) => (b.noticias + b.pushes) - (a.noticias + a.pushes));

  return {
    totalDelegados: delegadosVigentes.size,
    delegadosConNoticia: actividad.filter((d) => d.noticias > 0).length,
    delegadosConPush: actividad.filter((d) => d.pushes > 0).length,
    // El panel solo lista un puñado: con muchos delegados, la respuesta entera
    // no aporta nada frente a los que más publican.
    delegadosActividad: actividad.slice(0, 25),
  };
}

/**
 * adminStats — Recuentos agregados para el panel de administración (SOLO admin).
 * Devuelve cuántos usuarios hay en total y por plataforma (iOS / Android / web / sin
 * determinar), cuántos han usado "Fichar", cuántos tienen push activo, cuántos han
 * abierto la app en los últimos días y la actividad de publicación de los delegados.
 * Salvo el nombre del delegado (que ya firma sus propias noticias) no expone datos
 * personales. profile.platform, profile.hasFichado y profile.lastActiveAt los escribe
 * el cliente (ver recordAppOpen / markFichado).
 */
exports.adminStats = onCall({
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
  timeoutSeconds: 120,
  memory: "512MiB",
}, async (request) => {
  requireAdmin(request, "Solo el administrador puede ver las estadísticas.");

  return withPanelCache("panelAdminStats", request.data?.refresh === true, async () => {
    // .select() proyecta solo los campos necesarios (menos ancho de banda al crecer).
    // .stream() en vez de .get(): no materializa la colección entera en memoria de
    // una vez, así el consumo no crece con el nº de usuarios.
    let total = 0, ios = 0, android = 0, web = 0, desconocido = 0, fichadores = 0, conPush = 0;
    // Desglose de push por plataforma: saber que hay 300 con push no dice si el
    // problema de entrega está en iOS o en Android.
    let pushIos = 0, pushAndroid = 0;
    let activos7d = 0, activos7dIos = 0, activos7dAndroid = 0;
    // Abandono: inactivos por ventana, sin sello de actividad, y push muerto.
    const inactivos = {};       // { 30: {total, ios, android}, 60: {...} }
    INACTIVOS_VENTANAS_DIAS.forEach((dias) => { inactivos[dias] = { total: 0, ios: 0, android: 0 }; });
    let sinActividad = 0, pushMuerto = 0, pushMuertoIos = 0, pushMuertoAndroid = 0;

    const ahora = Date.now();
    const desde7d = ahora - ACTIVOS_VENTANA_DIAS * DIA_MS;

    const stream = db().collection("users")
      .select(
        "profile.platform", "profile.hasFichado", ...TOKEN_FIELDS,
        "profile.lastActiveAt", "profile.pushMuerto",
      )
      .stream();

    for await (const d of stream) {
      total += 1;
      const p = d.data().profile || {};
      if (p.platform === "ios") ios += 1;
      else if (p.platform === "android") android += 1;
      else if (p.platform === "web") web += 1;
      else desconocido += 1;
      if (p.hasFichado) fichadores += 1;
      if (tokensFromProfile(p).length > 0) {
        conPush += 1;
        if (p.platform === "ios") pushIos += 1;
        else if (p.platform === "android") pushAndroid += 1;
      }

      // Push muerto: FCM confirmó que sus tokens ya no existen (ver purgeDeadTokens).
      // Es el indicio MÁS fuerte de app desinstalada, aunque tampoco es prueba:
      // también sale al reinstalar o tras meses sin abrirla.
      if (p.pushMuerto === true) {
        pushMuerto += 1;
        if (p.platform === "ios") pushMuertoIos += 1;
        else if (p.platform === "android") pushMuertoAndroid += 1;
      }

      // lastActiveAt lo empezó a escribir la app el 05-ago-2026. Quien no lo tenga
      // NO es un inactivo: es un desconocido (app vieja). Mezclarlos inflaría el
      // recuento de abandono con gente que quizá entra a diario.
      if (typeof p.lastActiveAt !== "number") {
        sinActividad += 1;
        continue;
      }
      if (p.lastActiveAt >= desde7d) {
        activos7d += 1;
        if (p.platform === "ios") activos7dIos += 1;
        else if (p.platform === "android") activos7dAndroid += 1;
      }
      // Ventanas acumulativas: quien lleva 70 días cuenta en la de 30 y en la de 60.
      INACTIVOS_VENTANAS_DIAS.forEach((dias) => {
        if (p.lastActiveAt < ahora - dias * DIA_MS) {
          inactivos[dias].total += 1;
          if (p.platform === "ios") inactivos[dias].ios += 1;
          else if (p.platform === "android") inactivos[dias].android += 1;
        }
      });
    }

    const delegados = await contarDelegadosConActividad();

    return {
      total, ios, android, web, desconocido, fichadores,
      conPush, pushIos, pushAndroid,
      activos7d, activos7dIos, activos7dAndroid,
      ventanaDias: ACTIVOS_VENTANA_DIAS,
      inactivos, ventanasInactividad: INACTIVOS_VENTANAS_DIAS, sinActividad,
      pushMuerto, pushMuertoIos, pushMuertoAndroid,
      ...delegados,
    };
  });
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
  "profile.store", ...TOKEN_FIELDS, "profile.platform", "membership",
  // Para distinguir a quien sigue usando la app de quien la tiene abandonada o
  // desinstalada. Un recuento dice cuántos son; esto dice QUIÉNES.
  "profile.lastActiveAt", "profile.pushMuerto",
];

// timeout/memoria por encima del global: la opción "Total" del admin recorre todos
// los usuarios en una sola llamada y devuelve la lista completa.
exports.delegadoListUsers = onCall({
  maxInstances: 10,
  enforceAppCheck: ENFORCE_APP_CHECK,
  timeoutSeconds: 120,
  memory: "512MiB",
}, async (request) => {
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
      hasPush: tokensFromProfile(p).length > 0,
      // null = app anterior a agosto de 2026, que no sellaba actividad. NO es lo
      // mismo que "lleva mucho sin entrar", y la app lo distingue al pintarlo.
      lastActiveAt: typeof p.lastActiveAt === "number" ? p.lastActiveAt : null,
      pushMuerto: p.pushMuerto === true,
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
    // Se comprueba por CLAIM y por email de AUTH (ver isProtectedAdminAccount): así
    // la cuenta del admin sigue protegida aunque el claim y ADMIN_EMAIL estén
    // temporalmente en cuentas distintas durante un cambio de administrador. El email
    // ya NO se le pasa desde el perfil de Firestore: ese campo lo controla el propio
    // usuario y servía para hacerse pasar por el admin (auditoría 22-ago-2026).
    if (await isProtectedAdminAccount(targetUid)) {
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

  // Retirar va POR EMAIL, sin pasar por Auth. El doc se guarda en delegados/{uid},
  // así que si la persona borró su cuenta y se hizo otra, el uid cambió y su doc
  // viejo quedó huérfano: buscarlo por uid no lo encontraba nunca y "retirar" decía
  // que sí sin borrar nada, mientras el admin lo seguía viendo en la lista.
  if (request.data?.remove === true) {
    const porEmail = await db().collection("delegados").where("email", "==", email).get();
    const refs = porEmail.docs.map((d) => d.ref);
    // Y el del uid actual aunque su doc no llevara email (docs antiguos).
    const actual = await admin.auth().getUserByEmail(email).catch(() => null);
    if (actual && !porEmail.docs.some((d) => d.id === actual.uid)) {
      refs.push(db().collection("delegados").doc(actual.uid));
    }
    await Promise.all(refs.map((r) => r.delete()));
    return { success: true, uid: actual ? actual.uid : null, removed: refs.length };
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    throw new HttpsError("not-found", "No existe ninguna cuenta con ese email.");
  }
  const uid = userRecord.uid;
  const ref = db().collection("delegados").doc(uid);

  // Validado contra el catálogo real (auditoría 22-ago-2026, F-04): antes solo se
  // comprobaba tipo/longitud, y solo el desplegable del cliente restringía a tiendas
  // que existen de verdad. Aquí SÍ tiene que ser una tienda real (a diferencia de
  // cambiarMiTienda, "" no tiene sentido en la lista de tiendas de un delegado).
  const stores = request.data?.stores;
  if (!Array.isArray(stores) || stores.length === 0 ||
      !stores.every((s) => typeof s === "string" && VALID_STORES.includes(s))) {
    throw new HttpsError("invalid-argument", "Debes indicar al menos una tienda válida.");
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
exports.adminOverview = onCall({
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
  timeoutSeconds: 120,
  memory: "512MiB",
}, async (request) => {
  requireAdmin(request, "Solo el administrador puede ver el panel de gestión.");

  return withPanelCache("panelAdminOverview", request.data?.refresh === true, async () => {
  let total = 0, activos = 0, conPush = 0, expulsados = 0;
  const byStore = {}; // { tienda: { total, activos } } — sin expulsados (no cuentan para los delegados)

  // .stream(): recuento incremental, memoria acotada aunque la colección crezca.
  const usersStream = db().collection("users")
    .select("profile.store", ...TOKEN_FIELDS, "membership")
    .stream();

  for await (const d of usersStream) {
    const data = d.data();
    const p = data.profile || {};
    total += 1;
    if (tokensFromProfile(p).length > 0) conPush += 1;
    const expelled = !!(data.membership && data.membership.expelled);
    if (expelled) { expulsados += 1; continue; }
    const active = isUserActive(data);
    if (active) activos += 1;
    const store = p.store || "Sin tienda";
    if (!byStore[store]) byStore[store] = { total: 0, activos: 0 };
    byStore[store].total += 1;
    if (active) byStore[store].activos += 1;
  }

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
});
