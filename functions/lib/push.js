/**
 * Construcción y envío de notificaciones push.
 *
 * El payload (iconos web, canal de Android, cabeceras de APNs) estaba COPIADO
 * literalmente en las tres funciones que envían push. Cualquier arreglo —como el
 * del dominio de los iconos o el de `apns-push-type: alert`— había que acordarse
 * de aplicarlo tres veces. Aquí vive una sola vez.
 */
const { admin, db } = require("./firebase");

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

/** Vuelca en un Set los tokens de todos los docs de usuario de un QuerySnapshot. */
const collectTokens = (snap, into) => {
  snap.forEach((d) => tokensFromProfile(d.data().profile).forEach((t) => into.add(t)));
  return into;
};

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
 * Códigos de FCM que significan "este token ya NO existe", frente a un fallo
 * pasajero (red, cuota, servicio caído) que NO debe borrar nada.
 *
 * Es la ÚNICA señal de desinstalación que existe: ni Google ni Apple avisan
 * cuando alguien borra la app. El token se queda guardado como si nada, y solo se
 * descubre que está muerto al INTENTAR enviarle algo. Ojo: también sale al
 * reinstalar (el token cambia) o tras meses de inactividad (Google los caduca
 * solos), así que "token muerto" no es sinónimo exacto de "desinstalada".
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

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
    const update = {
      "profile.fcmTokens": vivos,
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
        // El orden de `responses` es el de los tokens enviados: así se sabe QUÉ
        // token concreto ha muerto, no solo cuántos fallaron.
        r.value.responses.forEach((resp, j) => {
          if (!resp.success && DEAD_TOKEN_CODES.has(resp.error && resp.error.code)) {
            muertos.push(wave[idx][j]);
          }
        });
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
      .select(...TOKEN_FIELDS)
      .get())
  );

  const tokens = new Set();
  snaps.forEach((snap) => collectTokens(snap, tokens));
  return tokens;
}

module.exports = {
  NEWS_TOPIC, TOKEN_FIELDS, buildMessage, sendToNewsTopic, sendToTokens,
  tokensForStores, tokensFromProfile, collectTokens, purgeDeadTokens,
  DEAD_TOKEN_CODES,
};
