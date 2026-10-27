/**
 * Construcción y envío de notificaciones push.
 *
 * El payload (iconos web, canal de Android, cabeceras de APNs) estaba COPIADO
 * literalmente en las tres funciones que envían push. Cualquier arreglo —como el
 * del dominio de los iconos o el de `apns-push-type: alert`— había que acordarse
 * de aplicarlo tres veces. Aquí vive una sola vez.
 */
const { admin, db } = require("./firebase");
const { ADMIN_EMAIL } = require("./auth");

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

// Campos del perfil donde vive el token de este usuario. Hay que pedir LOS DOS en
// cualquier .select() que vaya a recolectar tokens (ver tokensFromProfile).
const TOKEN_FIELDS = ["profile.fcmToken", "profile.fcmTokens"];

/**
 * Todos los tokens FCM de un perfil, uno por dispositivo.
 *
 * ⚠️ Hasta el 28-ago-2026 esto era UN SOLO campo `fcmToken` (string): cada
 * dispositivo que arrancaba lo sobrescribía, así que quien usaba la cuenta en el
 * móvil y en la tablet solo recibía los envíos DIRIGIDOS en el último que la
 * hubiera abierto (el topic de noticias nunca sufrió esto: FCM hace el fan-out).
 * Ahora se guarda `fcmTokens` (array). Se leen los dos y se UNEN, no se elige uno:
 * durante la transición conviven dispositivos con la app vieja (escriben el string)
 * y con la nueva (escriben el array), y hay que llegar a todos.
 */
const tokensFromProfile = (profile) => {
  if (!profile) return [];
  const out = new Set();
  if (Array.isArray(profile.fcmTokens)) {
    profile.fcmTokens.forEach((t) => { if (typeof t === "string" && t) out.add(t); });
  }
  if (typeof profile.fcmToken === "string" && profile.fcmToken) out.add(profile.fcmToken);
  return [...out];
};

// Campos que deciden si a alguien se le mandan NOTICIAS. Van en `membership`, no
// en `profile`, a propósito: las reglas impiden que el cliente escriba membership,
// así que el propio usuario no puede rehabilitarse por su cuenta.
// Hay que pedirlos en cualquier .select() que alimente a recibeNoticias*.
const NEWS_FLAG_FIELDS = ["membership.expelled", "membership.noticias"];

const membershipDe = (data) => (data && data.membership) || {};

/**
 * ¿Le mandamos las noticias GLOBALES (las del admin, para toda la app)?
 *
 * `membership.noticias == false` es el interruptor del panel de admin
 * (adminSetNoticias): corta las noticias y sus push a esa persona sin tocarle la
 * cuenta. Campo AUSENTE = sí recibe: ningún perfil anterior a esto lo lleva, y el
 * valor por defecto tiene que ser "sí" para no dejar a nadie mudo.
 */
const recibeNoticias = (data) => membershipDe(data).noticias !== false;

/**
 * ¿Le mandamos las noticias DE SU TIENDA (las de su delegado)?
 *
 * Además del interruptor de arriba, quedan fuera los EXPULSADOS. Expulsar
 * (delegadoExpelUser) significa "se fue de la empresa", pero nunca tocó
 * `profile.store` — y el envío de tienda se resuelve por ese campo, así que hasta
 * ahora el expulsado seguía recibiendo los avisos del delegado de una tienda en la
 * que ya no trabaja.
 *
 * Las noticias GLOBALES sí las sigue recibiendo: su cuenta queda activa a
 * propósito (ver delegadoExpelUser) y son para toda la app. Si además se le
 * quieren cortar, el admin tiene el interruptor.
 */
const recibeNoticiasTienda = (data) => recibeNoticias(data) && membershipDe(data).expelled !== true;

/**
 * Vuelca en un Set los tokens de todos los docs de usuario de un QuerySnapshot.
 * Con `filtro` (recibeNoticias / recibeNoticiasTienda) se salta a quien no deba
 * recibir el envío. El .select() de la consulta tiene que traer los campos que ese
 * filtro lee, o no filtrará nada.
 */
const collectTokens = (snap, into, filtro) => {
  snap.forEach((d) => {
    const data = d.data();
    if (filtro && !filtro(data)) return;
    tokensFromProfile(data.profile).forEach((t) => into.add(t));
  });
  return into;
};

/**
 * Tope de tamaño del título y el cuerpo de un push, en BYTES (UTF-8), no en letras.
 *
 * ⚠️ Auditoría 25-oct-2026 (H-06). FCM rechaza un mensaje de más de 4 KB (2 KB si va
 * a un topic, según su documentación) con INVALID_ARGUMENT, y el texto viaja DOS
 * veces: en `notification` y en el `aps.alert` de iOS. Nada lo limitaba: las reglas
 * dejan al delegado escribir 5.000 caracteres y el compositor del admin no tiene
 * tope. Con 120 + 600 bytes, las dos copias y el resto del payload caben con margen
 * incluso en los 2 KB de un topic. 600 bytes son entre 300 y 600 letras, más de lo
 * que enseña cualquier móvil en un aviso; el texto completo sigue en la noticia.
 */
const PUSH_TITLE_MAX_BYTES = 120;
const PUSH_BODY_MAX_BYTES = 600;

/**
 * Recorta un texto a `maxBytes` bytes UTF-8 sin partir ningún carácter, y añade "…"
 * si ha tenido que cortar. El resultado (puntos suspensivos incluidos) nunca pasa
 * de `maxBytes`.
 */
const recortarBytes = (texto, maxBytes) => {
  const s = String(texto ?? "");
  if (Buffer.byteLength(s, "utf8") <= maxBytes) return s;
  const ELIPSIS = "…"; // 3 bytes en UTF-8
  let out = "";
  let usados = 0;
  for (const ch of s) { // por puntos de código: nunca deja medio emoji
    const b = Buffer.byteLength(ch, "utf8");
    if (usados + b > maxBytes - 3) break;
    out += ch;
    usados += b;
  }
  return out.trimEnd() + ELIPSIS;
};

/**
 * Payload común a todos los envíos. Devuelve el mensaje SIN destinatario: quien
 * llama añade `topic` o `tokens`.
 *
 * Iconos web LIGEROS generados a medida (19 KB y 7 KB): antes ambos apuntaban a
 * app.PNG (568 KB), que cada dispositivo descargaba con CADA notificación.
 */
const buildMessage = (tituloOriginal, cuerpoOriginal) => {
  const title = recortarBytes(tituloOriginal, PUSH_TITLE_MAX_BYTES);
  const body = recortarBytes(cuerpoOriginal, PUSH_BODY_MAX_BYTES);
  return {
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
  };
};

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
 * Códigos de FCM que significan "este token ya NO existe", frente a un fallo
 * pasajero (red, cuota, servicio caído) que NO debe borrar nada.
 *
 * Es la ÚNICA señal de desinstalación que existe: ni Google ni Apple avisan
 * cuando alguien borra la app. El token se queda guardado como si nada, y solo se
 * descubre que está muerto al INTENTAR enviarle algo. Ojo: también sale al
 * reinstalar (el token cambia) o tras meses de inactividad (Google los caduca
 * solos), así que "token muerto" no es sinónimo exacto de "desinstalada".
 *
 * ⚠️ `messaging/invalid-argument` NO está a propósito (auditoría 25-oct-2026, H-06).
 * Es el INVALID_ARGUMENT genérico de FCM: sale con un token mal formado, pero también
 * cuando el MENSAJE es demasiado grande o tiene un campo no válido. En ese caso falla
 * igual para todos los destinatarios, y con este código en la lista un solo aviso
 * largo borraba los tokens de toda una tienda y marcaba `pushMuerto` a todo el mundo.
 * Un token que de verdad ya no existe vuelve como `registration-token-not-registered`.
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Si un lote ENTERO de este tamaño o más vuelve "muerto", no se cree: es mucho más
 * probable un fallo del propio envío (credenciales, proyecto, payload) que cientos de
 * desinstalaciones a la vez. Se registra y no se borra nada; si de verdad estaban
 * muertos, volverán a salir en el siguiente envío.
 */
const LOTE_SOSPECHOSO = 20;

/**
 * Borra de los perfiles los tokens que FCM ha dado por muertos, y marca
 * `profile.pushMuerto` en quien se queda SIN ningún dispositivo.
 *
 * Mejor esfuerzo: es limpieza, nunca debe tumbar un envío que ya salió bien.
 * `array-contains-any` e `in` admiten 30 valores, así que localizar a los dueños
 * cuesta una consulta por cada 30 tokens en vez de una por token.
 */
async function purgeDeadTokens(deadTokens) {
  const muertos = [...new Set(deadTokens)].filter(Boolean);
  if (muertos.length === 0) return 0;

  const porUsuario = new Map(); // uid -> { ref, muertos:Set }
  const anota = (doc, token) => {
    const acc = porUsuario.get(doc.id) || { ref: doc.ref, data: doc.data(), muertos: new Set() };
    acc.muertos.add(token);
    porUsuario.set(doc.id, acc);
  };

  for (let i = 0; i < muertos.length; i += 30) {
    const lote = muertos.slice(i, i + 30);
    // Los dos modelos a la vez: `fcmTokens` (array, actual) y `fcmToken` (string,
    // apps anteriores al 28-ago-2026), que aún conviven.
    const [porArray, porString] = await Promise.all([
      db().collection("users").where("profile.fcmTokens", "array-contains-any", lote).select(...TOKEN_FIELDS).get(),
      db().collection("users").where("profile.fcmToken", "in", lote).select(...TOKEN_FIELDS).get(),
    ]);
    const enLote = new Set(lote);
    [porArray, porString].forEach((snap) => snap.forEach((doc) => {
      tokensFromProfile(doc.data().profile)
        .filter((t) => enLote.has(t))
        .forEach((t) => anota(doc, t));
    }));
  }

  let limpiados = 0;
  for (const { ref, data, muertos: suyos } of porUsuario.values()) {
    const vivos = tokensFromProfile(data.profile).filter((t) => !suyos.has(t));
    // arrayRemove y no el array calculado (auditoría 25-oct-2026, H-18): entre la
    // lectura de arriba y esta escritura, otro móvil de la misma cuenta puede haber
    // registrado su token con arrayUnion. Reescribir el array entero lo borraba.
    const update = {
      "profile.fcmTokens": admin.firestore.FieldValue.arrayRemove(...suyos),
      "profile.fcmToken": admin.firestore.FieldValue.delete(),
    };
    // Sin ningún dispositivo vivo: la app no está instalada en ninguna parte. Lo
    // apaga el propio cliente en cuanto vuelva a registrar un token (ver
    // saveDeviceToken), así que una reinstalación se corrige sola.
    if (vivos.length === 0) {
      update["profile.pushMuerto"] = true;
      update["profile.pushMuertoAt"] = Date.now();
    }
    await ref.update(update).catch((e) => console.warn("purgeDeadTokens:", e.message));
    limpiados += suyos.size;
  }
  return limpiados;
}

/**
 * Qué tokens de UN lote ha dado FCM por muertos. `responses` va en el mismo orden
 * que `batch`, así se sabe qué token concreto es, no solo cuántos fallaron.
 *
 * Si el lote es grande y TODOS vuelven muertos, no se devuelve ninguno (ver
 * LOTE_SOSPECHOSO): es la firma de un envío que ha fallado entero, no de cientos de
 * personas que han desinstalado la app en el mismo minuto.
 */
function tokensMuertosDelLote(batch, responses) {
  const muertos = [];
  responses.forEach((resp, j) => {
    if (!resp.success && DEAD_TOKEN_CODES.has(resp.error && resp.error.code)) {
      muertos.push(batch[j]);
    }
  });
  if (batch.length >= LOTE_SOSPECHOSO && muertos.length === batch.length) {
    const codigo = responses[0] && responses[0].error && responses[0].error.code;
    console.error(`sendToTokens: los ${batch.length} tokens de un lote vuelven muertos (${codigo}). Parece un fallo del envío: no se borra ninguno.`);
    return [];
  }
  return muertos;
}

/**
 * Envío dirigido por token, en lotes paralelos.
 * Devuelve { ok, ko, total, muertos } — si `ok + ko < total`, el envío quedó
 * INCOMPLETO (no es lo mismo que un token muerto) y quien llama debe registrarlo.
 *
 * De paso LIMPIA los tokens que FCM da por inexistentes: sin esto, un móvil que
 * desinstaló la app seguía en la lista para siempre, contaba como "con push
 * activo" en el panel de admin y se le reintentaba el envío en cada aviso.
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
  const muertos = [];
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
        muertos.push(...tokensMuertosDelLote(wave[idx], r.value.responses));
      } else {
        // Lote caído entero: es un fallo de transporte, NO prueba de que los
        // tokens estén muertos. No se borra ninguno.
        ko += wave[idx].length;
        console.error("sendToTokens: un lote completo falló:", r.reason && r.reason.message);
      }
    });
  }

  if (muertos.length > 0) {
    try {
      const limpiados = await purgeDeadTokens(muertos);
      console.log(`sendToTokens: ${limpiados} tokens muertos retirados de los perfiles.`);
    } catch (e) {
      console.error("sendToTokens: no se pudieron limpiar los tokens muertos:", e.message);
    }
  }

  return { ok, ko, total: all.length, muertos: muertos.length };
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
      .select(...TOKEN_FIELDS, ...NEWS_FLAG_FIELDS)
      .get())
  );

  // El filtro va en memoria, NO en la consulta: `where("membership.noticias",
  // "!=", false)` dejaría fuera a todo el que no tenga el campo — Firestore no
  // devuelve los documentos donde el campo NO EXISTE en las consultas de
  // desigualdad, que es justo el caso de todos los perfiles anteriores a esto.
  const tokens = new Set();
  snaps.forEach((snap) => collectTokens(snap, tokens, recibeNoticiasTienda));
  return tokens;
}

/**
 * ¿Hay alguien con las noticias cortadas por el admin?
 *
 * Consulta de AGREGACIÓN count(): cuesta 1 lectura por cada 1000 coincidencias
 * (mínimo 1), no una por usuario. Sirve para no pagar el recorrido de la
 * colección entera cuando no hay nadie silenciado, que es lo normal.
 */
async function haySilenciados(db) {
  const snap = await db().collection("users")
    .where("membership.noticias", "==", false)
    .count()
    .get();
  return snap.data().count > 0;
}

/**
 * Tokens de TODA la app menos los silenciados, para el broadcast del admin.
 *
 * Recorrer `users` es exactamente lo que el topic evita (ver NEWS_TOPIC), así que
 * esto SOLO se usa cuando hay alguien a quien saltarse: un envío al topic lo hace
 * FCM por su cuenta y no admite excepciones. .stream() para que la memoria no
 * crezca con el nº de usuarios; .select() para no traer el perfil entero.
 */
async function tokensForBroadcast(db) {
  const tokens = new Set();
  const stream = db().collection("users")
    .select(...TOKEN_FIELDS, ...NEWS_FLAG_FIELDS)
    .stream();
  for await (const d of stream) {
    const data = d.data();
    if (!recibeNoticias(data)) continue;
    tokensFromProfile(data.profile).forEach((t) => tokens.add(t));
  }
  return tokens;
}

/**
 * Tokens de los dispositivos del ADMIN, para avisarle de cada alta pendiente.
 *
 * ⚠️ SEGURIDAD (auditoría 25-oct-2026, H-08). Antes se buscaba el documento con
 * `profile.email == ADMIN_EMAIL`, y ese campo lo puede reescribir cualquier usuario
 * (es el mismo problema que se cerró en agosto en isProtectedAdminAccount). Quien se
 * pusiera ahí el email del admin recibía el aviso de cada alta —nombre y tienda del
 * compañero nuevo— y, por el `limit(1)`, podía quitarle el sitio al admin de verdad.
 * Ahora el email se resuelve en Firebase Auth, que solo cambia el dueño de la cuenta,
 * y se leen los tokens de ESE uid.
 */
async function tokensDelAdmin(db) {
  let uid;
  try {
    uid = (await admin.auth().getUserByEmail(ADMIN_EMAIL)).uid;
  } catch (e) {
    if (e && e.code === "auth/user-not-found") return [];
    throw e;
  }
  const snap = await db().collection("users").doc(uid).get();
  return snap.exists ? tokensFromProfile(snap.data().profile) : [];
}

module.exports = {
  NEWS_TOPIC, TOKEN_FIELDS, NEWS_FLAG_FIELDS, buildMessage, sendToNewsTopic, sendToTokens,
  tokensForStores, tokensForBroadcast, haySilenciados, tokensFromProfile, collectTokens,
  recibeNoticias, recibeNoticiasTienda, purgeDeadTokens, DEAD_TOKEN_CODES,
  recortarBytes, tokensMuertosDelLote, tokensDelAdmin,
  PUSH_TITLE_MAX_BYTES, PUSH_BODY_MAX_BYTES, LOTE_SOSPECHOSO,
};
