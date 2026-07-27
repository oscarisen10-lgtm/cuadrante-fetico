const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
// v1: los triggers de ciclo de vida de Auth (onDelete) son de 1ª generación. Convive sin
// problema con las funciones v2 de este mismo fichero.
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

// REGIÓN: europe-west1 (Bélgica), pegada a Firestore (eur3) y a los usuarios (España).
// Antes todo corría en us-central1: cada llamada cruzaba el Atlántico dos veces y las
// consultas a Firestore pagaban latencia cross-region (cara en el recursiveDelete de
// deleteMyAccount, por ejemplo).
// EXCEPCIÓN: teamStatus se queda en us-central1 (ver su comentario) hasta que las
// builds nativas antiguas dejen de usarse.
setGlobalOptions({ region: "europe-west1" });

// Topic de FCM para el broadcast de noticias. Enviar a un topic cuesta UNA llamada y
// CERO lecturas de Firestore (antes cada push leía TODA la colección de usuarios para
// recolectar tokens, y además había que limpiar los tokens muertos a mano — con topics
// FCM gestiona el fan-out y las bajas de dispositivos solo).
// Los clientes se suscriben: nativo con el plugin FCM, web vía la callable
// `subscribeToNewsTopic` (el SDK web no puede suscribirse a topics por sí mismo).
const NEWS_TOPIC = "noticias";

/**
 * Migración ÚNICA a topics: suscribe al topic los tokens que ya estaban guardados en
 * los perfiles (usuarios con la app ANTIGUA, que aún no se auto-suscriben). Sin esto,
 * el primer push tras el despliegue no llegaría a nadie que no hubiera actualizado.
 * Se ejecuta una sola vez (doc marcador system/topicMigration); las apps nuevas se
 * suscriben solas en cada arranque. subscribeToTopic es idempotente, así que una
 * carrera entre dos pushes simultáneos es inofensiva.
 */
async function ensureTopicMigration() {
  const db = admin.firestore();
  const markerRef = db.collection("system").doc("topicMigration");
  const marker = await markerRef.get();
  if (marker.exists) return;

  const usersSnapshot = await db.collection("users").select("profile.fcmToken").get();
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
 * Cloud Function (Gen 2): sendPushNotification
 * Triggers when a new document is created in the 'noticias' collection.
 * maxInstances acota el coste/concurrencia ante picos.
 */
exports.sendPushNotification = onDocumentCreated({ document: "noticias/{docId}", maxInstances: 5 }, async (event) => {
  const data = event.data.data();

  // Only react to explicit PUSH requests from admin
  if (data.isPushRequest !== true) {
    return null;
  }

  const title = data.title || "Nueva notificación";
  const body = data.desc || "";

  // Una sola vez tras el despliegue: pasa los tokens antiguos al topic.
  await ensureTopicMigration();

  const message = {
    topic: NEWS_TOPIC,
    notification: {
      title: title,
      body: body,
    },
    webpush: {
      // Iconos LIGEROS generados a medida (19 KB y 7 KB): antes ambos apuntaban a
      // app.PNG (568 KB), que cada dispositivo descargaba con CADA notificación.
      // ⚠️ DOMINIO: mi-calendario-fe.web.app es el hosting REAL de esta app.
      // calendario-fetico.web.app (lo que había antes aquí) es el proyecto ANTIGUO
      // "Mi Calendario": sus iconos no existen allí y el link abría la app vieja.
      notification: {
        icon: "https://mi-calendario-fe.web.app/img/push-icon-192.png",
        badge: "https://mi-calendario-fe.web.app/img/push-badge-96.png",
      },
      fcmOptions: {
        link: "https://mi-calendario-fe.web.app",
      },
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
          alert: { title: title, body: body },
          sound: "default",
          badge: 1,
        },
      },
    },
  };

  try {
    const messageId = await admin.messaging().send(message);
    console.log(`Push enviado al topic "${NEWS_TOPIC}":`, messageId);
  } catch (error) {
    console.error("Error enviando push al topic:", error);
  }

  return null;
});

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
exports.sendStoreNews = onDocumentCreated({ document: "noticiasTienda/{docId}", maxInstances: 5 }, async (event) => {
  const data = event.data.data();
  if (data.sendPush !== true) return null;

  const db = admin.firestore();
  const stores = Array.isArray(data.stores) ? data.stores.filter((s) => typeof s === "string" && s) : [];
  if (stores.length === 0) return null;

  // Re-validación de autoría en servidor (defensa en profundidad).
  const delegadoSnap = await db.collection("delegados").doc(String(data.authorUid || "")).get();
  const delegado = delegadoSnap.exists ? delegadoSnap.data() : null;
  const authorized = delegado && delegado.active !== false &&
    Array.isArray(delegado.stores) && stores.every((s) => delegado.stores.includes(s));
  if (!authorized) {
    console.error(`sendStoreNews: autor ${data.authorUid} sin autorización para [${stores.join(", ")}]. No se envía.`);
    return null;
  }

  // Tokens de los usuarios de las tiendas destino ("in" admite 30 valores).
  const tokens = new Set();
  for (let i = 0; i < stores.length; i += 30) {
    const snap = await db.collection("users")
      .where("profile.store", "in", stores.slice(i, i + 30))
      .select("profile.fcmToken")
      .get();
    snap.forEach((d) => {
      const t = d.data().profile && d.data().profile.fcmToken;
      if (t) tokens.add(t);
    });
  }
  if (tokens.size === 0) {
    console.log(`sendStoreNews: sin dispositivos con push en [${stores.join(", ")}].`);
    return null;
  }

  const title = data.title || "Aviso de tu delegado";
  const body = data.desc || "";
  const base = {
    notification: { title, body },
    webpush: {
      notification: {
        icon: "https://mi-calendario-fe.web.app/img/push-icon-192.png",
        badge: "https://mi-calendario-fe.web.app/img/push-badge-96.png",
      },
      fcmOptions: { link: "https://mi-calendario-fe.web.app" },
    },
    android: {
      priority: "high",
      notification: { channelId: "default", icon: "ic_launcher", color: "#059669", sound: "default" },
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: { aps: { alert: { title, body }, sound: "default", badge: 1 } },
    },
  };

  // sendEachForMulticast admite 500 tokens por llamada.
  const all = [...tokens];
  let ok = 0, ko = 0;
  for (let i = 0; i < all.length; i += 500) {
    const res = await admin.messaging().sendEachForMulticast({ ...base, tokens: all.slice(i, i + 500) });
    ok += res.successCount;
    ko += res.failureCount;
  }
  console.log(`sendStoreNews → [${stores.join(", ")}]: ${ok} entregados, ${ko} fallos (tokens muertos, ignorables).`);
  return null;
});

/**
 * notifyDelegadoNewUser — Al CREARSE una cuenta nueva PENDIENTE de activar, avisa por push
 * al/los delegado(s) de la tienda del nuevo usuario Y al admin (siempre), para que la
 * activen desde la app. Así ninguna cuenta pendiente se queda sin que nadie la active.
 * Solo dispara si:
 *   - membership.active === false (cuenta nueva pendiente), y
 *   - hay una tienda concreta (las auto-reparaciones nacen "Centro sin definir" y se ignoran).
 * Coste: 1 query a delegados + 1 query de sus tokens + 1 envío. Los registros son escasos.
 */
exports.notifyDelegadoNewUser = onDocumentCreated({ document: "users/{uid}", maxInstances: 5 }, async (event) => {
  const data = event.data && event.data.data();
  if (!data) return null;

  // Solo cuentas nuevas pendientes de activar.
  if (!data.membership || data.membership.active !== false) return null;

  const profile = data.profile || {};
  const store = profile.store;
  // Sin tienda concreta no hay delegado a quien avisar.
  if (!store || store === "Centro sin definir") return null;

  const db = admin.firestore();
  const tokens = new Set(); // Set: dedup por si el admin es además delegado de la tienda.

  // Delegados ACTIVOS cuya lista de tiendas incluye la del nuevo usuario.
  const delegadosSnap = await db.collection("delegados")
    .where("stores", "array-contains", store)
    .get();
  const delegadoUids = delegadosSnap.docs
    .filter((d) => d.data().active !== false)
    .map((d) => d.id);

  // Tokens FCM de esos delegados (users/{uid}.profile.fcmToken; "in" admite 30).
  for (let i = 0; i < delegadoUids.length; i += 30) {
    const snap = await db.collection("users")
      .where(admin.firestore.FieldPath.documentId(), "in", delegadoUids.slice(i, i + 30))
      .select("profile.fcmToken")
      .get();
    snap.forEach((d) => {
      const t = d.data().profile && d.data().profile.fcmToken;
      if (t) tokens.add(t);
    });
  }

  // Avisar TAMBIÉN al admin (siempre, por su email fijo), tenga la tienda delegado o no.
  const adminSnap = await db.collection("users")
    .where("profile.email", "==", ADMIN_EMAIL_FN)
    .select("profile.fcmToken")
    .limit(1)
    .get();
  adminSnap.forEach((d) => {
    const t = d.data().profile && d.data().profile.fcmToken;
    if (t) tokens.add(t);
  });

  if (tokens.size === 0) return null;

  const nombre = profile.fullName || "Un compañero/a";
  const title = "Nueva cuenta por activar";
  const body = `${nombre} se ha registrado en ${store}. Ábrela para activar su cuenta.`;
  const base = {
    notification: { title, body },
    webpush: {
      notification: {
        icon: "https://mi-calendario-fe.web.app/img/push-icon-192.png",
        badge: "https://mi-calendario-fe.web.app/img/push-badge-96.png",
      },
      fcmOptions: { link: "https://mi-calendario-fe.web.app" },
    },
    android: {
      priority: "high",
      notification: { channelId: "default", icon: "ic_launcher", color: "#059669", sound: "default" },
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: { aps: { alert: { title, body }, sound: "default", badge: 1 } },
    },
  };

  try {
    const res = await admin.messaging().sendEachForMulticast({ ...base, tokens: [...tokens] });
    console.log(`notifyDelegadoNewUser → ${store}: ${res.successCount} avisados, ${res.failureCount} fallos.`);
  } catch (e) {
    console.error("notifyDelegadoNewUser error:", e);
  }
  return null;
});

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

let convenioText = "";
try {
  convenioText = fs.readFileSync(path.join(__dirname, "convenio_anged.txt"), "utf8");
} catch (error) {
  console.error("Error cargando el convenio:", error);
}

let acuerdoText = "";
try {
  acuerdoText = fs.readFileSync(path.join(__dirname, "acuerdo_supercor.txt"), "utf8");
} catch (error) {
  console.error("Error cargando el acuerdo interno:", error);
}

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Modelo configurable sin tocar código (firebase functions:config / variable de entorno
// GEMINI_MODEL). OJO: "gemini-3.5-flash" no es un ID de modelo válido en la API de Gemini
// y haría fallar TODAS las consultas; el valor por defecto es un modelo flash vigente.
const geminiModel = defineString("GEMINI_MODEL", { default: "gemini-2.5-flash" });

const MAX_QUESTIONS_PER_DAY = 10;
const MAX_MESSAGE_LENGTH = 1000; // Tope de longitud para acotar el coste de tokens.

// ── Caché de contexto de Gemini (optimización de coste F-1) ──────────────────
// El convenio + acuerdo ocupan ~60.000 tokens. Reenviarlos en CADA pregunta no
// cacheada es la mayor fuente de gasto. Con "context caching" ese bloque enorme
// se sube UNA vez y las preguntas siguientes pagan una fracción por reutilizarlo.
// Si la API de caché no estuviera disponible, se cae con elegancia al modo
// clásico (systemInstruction en línea) para NO romper nunca el asistente.
let convenioCache = null; // { name, expireAt }
const CACHE_TTL_SECONDS = 3600;

async function getOrCreateConvenioCache(ai, model, systemInstruction) {
  const now = Date.now();
  if (convenioCache && convenioCache.expireAt > now + 60000) {
    return convenioCache.name;
  }
  try {
    const cache = await ai.caches.create({
      model,
      config: { systemInstruction, ttl: `${CACHE_TTL_SECONDS}s` },
    });
    convenioCache = { name: cache.name, expireAt: now + CACHE_TTL_SECONDS * 1000 };
    console.log("Context cache creada:", cache.name);
    return convenioCache.name;
  } catch (e) {
    console.warn("Context caching no disponible, uso systemInstruction inline:", e.message);
    convenioCache = null;
    return null;
  }
}

exports.askFeticoAssistant = onCall({
  secrets: [geminiApiKey],
  enforceAppCheck: false,
  maxInstances: 10,
}, async (request) => {
  // 1. Validate Authentication
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado para usar el asistente.");
  }
  const uid = request.auth.uid;
  const userMessage = request.data.message;

  if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
    throw new HttpsError("invalid-argument", "El mensaje no puede estar vacío.");
  }

  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError("invalid-argument", `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_LENGTH} caracteres).`);
  }

  // Admin SOLO por custom-claim (el fallback por email se eliminó el 17-jul-2026).
  const isAdmin = !!(request.auth.token && request.auth.token.admin === true);

  // 2. Rate Limiting Check (Firestore)
  if (!isAdmin) {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const usageRef = admin.firestore().collection("users").doc(uid).collection("usage").doc(`chat_${today}`);
    
    try {
      const usageResult = await admin.firestore().runTransaction(async (transaction) => {
        const doc = await transaction.get(usageRef);
        let count = 0;
        if (doc.exists) {
          count = doc.data().count || 0;
        }
        
        if (count >= MAX_QUESTIONS_PER_DAY) {
          return { allowed: false, currentCount: count };
        }
        
        transaction.set(usageRef, { count: count + 1 }, { merge: true });
        return { allowed: true, currentCount: count + 1 };
      });

      if (!usageResult.allowed) {
        throw new HttpsError("resource-exhausted", "Has alcanzado el límite de 10 preguntas por día. Por favor, vuelve mañana.");
      }

    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("Transaction Error:", error);
      throw new HttpsError("internal", "Error al procesar la solicitud de cuota.");
    }
  }

  // 3. Normalized Query for Caching
  const cleanMessage = userMessage.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!.,]/g, '').replace(/\s+/g, ' ');
  // Las barras (/ y \) rompen los IDs de documento de Firestore y la longitud está
  // acotada; saneamos antes de usar el texto como clave de caché.
  const safeKey = cleanMessage.replace(/[/\\]/g, '').slice(0, 400) || 'empty';
  // Prefijo de versión: cámbialo (v2, v3...) para invalidar TODA la caché anterior
  // tras editar el system prompt, sin tener que borrar la colección a mano.
  const cacheRef = admin.firestore().collection("ai_cache").doc("v2-" + safeKey);

  try {
    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      return {
        text: cacheDoc.data().response,
        success: true,
        cached: true
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    
    const systemInstruction = `Eres un asistente virtual experto en derecho laboral para los trabajadores del grupo (Supercor, S. Romero, S. Express).
REGLAS ESTRICTAS:
1. SOLO puedes responder a preguntas relacionadas EXCLUSIVAMENTE con el Convenio Colectivo de ANGED (Grandes Almacenes), licencias, turnos, vacaciones, festivos y derechos laborales.
2. Si preguntan sobre otros temas, DEBES negarte educadamente.
3. Sé amable, directo y profesional. NUNCA empieces con saludos ni te presentes (nada de "¡Hola!", "Soy...", "Como tu asesor..."): ve DIRECTO a la respuesta. NUNCA menciones la palabra "Fetico" ni ningún sindicato.
4. Basa TUS RESPUESTAS EXCLUSIVAMENTE en el TEXTO COMPLETO DEL CONVENIO y en los ACUERDOS INTERNOS DE EMPRESA proporcionados al final de este mensaje. IMPORTANTE: Los Acuerdos Internos de Empresa tienen PRIORIDAD ABSOLUTA sobre el Convenio. Si hay una discrepancia, siempre manda el Acuerdo Interno. Utiliza la "Chuleta Rápida" para los permisos más comunes. Siempre que el usuario pregunte por un permiso, debes indicarle también la Documentación Requerida.

CHULETA RÁPIDA:
- Matrimonio o Pareja de Hecho: 15 días naturales. Documentación: Certificado de matrimonio o inscripción en el registro.
- Accidente, Enfermedad Grave u Hospitalización: 5 días hábiles (aplica a cónyuge, pareja de hecho, parientes hasta 2º grado y convivientes). Documentación: Justificante médico o parte de hospitalización/intervención donde conste la gravedad o necesidad de reposo domiciliario.
- Fallecimiento de Familiar: 2 días (ampliables a 4 días si requiere desplazamiento). Aplica hasta 2º grado. Documentación: Certificado de defunción o esquela. Para ampliación, billetes de transporte o prueba de residencia.
- Fuerza Mayor Familiar (Urgencia Imprevista): Hasta 4 días laborables al año (se disfruta por horas). Documentación: Justificante posterior que acredite la urgencia (informe urgencias, colegio, siniestro hogar).
- Bolsa de 20 horas: Para acompañamiento médico de 1er grado (padres o hijos) dependientes o mayores de 70 años, o asistencia a exámenes prenatales. Documentación: Justificante de asistencia a consulta con visado del facultativo.
- Cuidado del Lactante: 1 hora diaria hasta 9 meses, o acumulado en jornadas (aprox. 14-16 días). Documentación: Libro de familia o certificado de nacimiento.
- Traslado de Domicilio Habitual: 1 día. Documentación: Certificado de empadronamiento, contrato alquiler o factura de mudanza.
- Matrimonio de Parientes: 1 día hábil (hasta 2º grado). Documentación: Certificado o invitación oficial.
- Examen de Conducir: 1 día. Documentación: Justificante de asistencia de DGT o autoescuela.
- Firmas Notariales: 1 día al año. Documentación: Justificante expedido por notaría.
- Deberes públicos / Exámenes Oficiales: Tiempo indispensable. Documentación: Citación oficial o certificado de examen sellado.
- Consanguinidad/Afinidad: 1er grado (Padres, hijos, cónyuge, suegros, yernos/nueras). 2º grado (Abuelos, nietos, hermanos, cuñados).
- Fines de semana de calidad: SIEMPRE QUE PREGUNTEN SOBRE ESTO, RESPONDE EXACTAMENTE Y LITERALMENTE CON ESTE TEXTO:
"Según el acuerdo para la adaptación de los sistemas de distribución de la jornada del convenio colectivo sectorial estatal de grandes almacenes en la empresa SUPERCOR, los fines de semana de calidad (que comprenden el sábado y el domingo completos) a los que tienes derecho son 10 al año

Aquí tienes el calendario de lo que te corresponde en Supercor y S.Romero:

Encargados y Mandos
  - 8 Sábado/Domingo/Lunes/Martes
  - 2 Sábados/Domingos
Personal de Frescos Cobro e Implantación
  - 4 Sábados/Domingos/Lunes
  - 6 Sábados/Domingos

Aquí tienes el calendario de lo que te corresponde en S.Express

Personal cobro e implantación 
  - 16 Sábados/Domingos/Lunes/Martes
Coordinador y Auxiliar
  - 12 Sábados/Domingos
  -  4 Viernes/Sábados/Domingos

Si necesitas que revisemos tu cuadrante o tienes cualquier otra duda, ¡aquí me tienes, compañero/a!"

--- ACUERDOS INTERNOS DE EMPRESA (SUPERCOR) - PRIORIDAD ABSOLUTA ---
${acuerdoText}

--- TEXTO COMPLETO DEL CONVENIO COLECTIVO DE ANGED ---
${convenioText}`;
    
    const modelId = geminiModel.value();
    const cacheName = await getOrCreateConvenioCache(ai, modelId, systemInstruction);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: userMessage,
      config: cacheName
        ? { cachedContent: cacheName, temperature: 0.1 }
        : { systemInstruction: systemInstruction, temperature: 0.1 }, // fallback factual
    });

    const textResponse = response.text;

    // Save to cache
    await cacheRef.set({
      response: textResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      text: textResponse,
      success: true,
      cached: false
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    throw new HttpsError("internal", "Error al conectar con la Inteligencia Artificial. Inténtalo más tarde.");
  }
});

// La Arena/Competición (submitArenaScore + leaderboards) se ELIMINÓ del
// proyecto el 17-jul-2026 para recortar lecturas/escrituras: la función se
// borró del despliegue y la colección leaderboards se purgó.

// Email del admin: SOLO se usa para PROTEGER su perfil (que un delegado no
// pueda desactivar/expulsar esa cuenta). La AUTORIZACIÓN de admin va por
// custom-claim exclusivamente desde el 17-jul-2026 (incidente de borrado).
const ADMIN_EMAIL_FN = "oscargarcia@fetico.es";

/**
 * adminStats — Recuentos agregados para el panel de administración (SOLO admin).
 * Devuelve cuántos usuarios hay en total y por plataforma (iOS / Android / web / sin
 * determinar), cuántos han usado "Fichar" y cuántos tienen push activo. No expone ningún
 * dato personal, solo cifras. Los campos profile.platform y profile.hasFichado los escribe
 * el cliente (ver recordDeviceMeta / markFichado).
 */
exports.adminStats = onCall({ maxInstances: 5 }, async (request) => {
  const token = request.auth && request.auth.token;
  const isAdmin = !!(token && token.admin === true); // solo claim (17-jul-2026)
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Solo el administrador puede ver las estadísticas.");
  }

  const db = admin.firestore();
  // .select() proyecta solo los campos necesarios (menos ancho de banda al crecer).
  const snap = await db.collection("users")
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

// ---------------------------------------------------------------------------
// DELEGADOS — activación de cuentas de afiliados por tienda.
//
// Modelo: users/{uid}.membership.active gobierna si la cuenta está activada.
//   - membership AUSENTE  → cuenta anterior al sistema de delegados → ACTIVA
//     (así los usuarios existentes quedan activados sin migración).
//   - Los registros nuevos nacen con membership.active == false (lo exigen las
//     reglas de Firestore) y un delegado/admin los activa desde la app.
// La colección delegados/{uid} guarda qué tiendas puede gestionar cada delegado;
// la administra solo el admin (vía adminSetDelegado).
//
// Todo pasa por callables con Admin SDK: las reglas impiden que un cliente lea
// perfiles ajenos o toque membership, igual que ya ocurre con teamStatus.
// ---------------------------------------------------------------------------

// Admin SOLO por custom-claim (fallback por email eliminado el 17-jul-2026).
const isAdminToken = (token) => !!(token && token.admin === true);

/** Doc del delegado que llama, o null si no es delegado (o está desactivado). */
async function getDelegadoDoc(uid) {
  const snap = await admin.firestore().collection("delegados").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return data.active === false ? null : data;
}

/** membership ausente = usuario anterior al sistema de delegados → activo. */
const isUserActive = (data) => !data.membership || data.membership.active === true;

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

exports.delegadoListUsers = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const store = request.data?.store;
  if (typeof store !== "string" || !store.trim() || store.length > 80) {
    throw new HttpsError("invalid-argument", "Tienda no válida.");
  }

  const db = admin.firestore();
  const isAdminCaller = isAdminToken(request.auth.token);
  let docs = [];

  if (store === "__ALL__") {
    if (isAdminCaller) {
      const snap = await db.collection("users").select(...LIST_USERS_FIELDS).get();
      docs = snap.docs;
    } else {
      const delegado = await getDelegadoDoc(request.auth.uid);
      const stores = delegado && Array.isArray(delegado.stores) ? delegado.stores : [];
      if (stores.length === 0) {
        throw new HttpsError("permission-denied", "No tienes tiendas autorizadas.");
      }
      // El operador "in" admite 30 valores por consulta → troceamos por si acaso.
      for (let i = 0; i < stores.length; i += 30) {
        const snap = await db.collection("users")
          .where("profile.store", "in", stores.slice(i, i + 30))
          .select(...LIST_USERS_FIELDS)
          .get();
        docs.push(...snap.docs);
      }
    }
  } else {
    if (!isAdminCaller) {
      const delegado = await getDelegadoDoc(request.auth.uid);
      if (!delegado || !Array.isArray(delegado.stores) || !delegado.stores.includes(store)) {
        throw new HttpsError("permission-denied", "No tienes autorizada esta tienda.");
      }
    }
    const snap = await db.collection("users")
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
 * delegadoExpelUser — "Expulsa" a un usuario que se fue de la empresa: NO borra
 * nada ni le bloquea la app (su cuenta queda ACTIVA por si quiere seguir
 * usándola); solo lo marca para que desaparezca de las listas y del censo del
 * delegado. Con { expelled: false } se readmite (lo usa el admin).
 */
exports.delegadoExpelUser = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const targetUid = request.data?.uid;
  const expelled = request.data?.expelled;
  if (typeof targetUid !== "string" || !targetUid || typeof expelled !== "boolean") {
    throw new HttpsError("invalid-argument", "Parámetros no válidos.");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(targetUid);
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
    if ((userSnap.data().profile || {}).email === ADMIN_EMAIL_FN) {
      throw new HttpsError("permission-denied", "No puedes modificar esa cuenta.");
    }
  }

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
exports.delegadoCensusCounts = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const delegado = await getDelegadoDoc(request.auth.uid);
  const stores = delegado && Array.isArray(delegado.stores) ? delegado.stores : [];
  if (stores.length === 0) {
    throw new HttpsError("permission-denied", "No tienes tiendas autorizadas.");
  }

  const db = admin.firestore();
  const counts = {};
  await Promise.all(stores.map(async (store) => {
    const base = db.collection("users").where("profile.store", "==", store);
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
exports.delegadoSetActive = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const targetUid = request.data?.uid;
  const active = request.data?.active;
  if (typeof targetUid !== "string" || !targetUid || typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "Parámetros no válidos.");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(targetUid);
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
    // Un delegado no puede desactivar la cuenta del admin.
    if ((userSnap.data().profile || {}).email === ADMIN_EMAIL_FN) {
      throw new HttpsError("permission-denied", "No puedes modificar esa cuenta.");
    }
  }

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
exports.adminSetDelegado = onCall({ maxInstances: 5 }, async (request) => {
  if (!isAdminToken(request.auth && request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo el administrador puede gestionar delegados.");
  }
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
  const db = admin.firestore();
  const ref = db.collection("delegados").doc(uid);

  if (request.data?.remove === true) {
    await ref.delete();
    return { success: true, uid, removed: true };
  }

  const stores = request.data?.stores;
  if (!Array.isArray(stores) || stores.length === 0 ||
      !stores.every((s) => typeof s === "string" && s.trim() && s.length <= 80)) {
    throw new HttpsError("invalid-argument", "Debes indicar al menos una tienda.");
  }

  const userSnap = await db.collection("users").doc(uid).get();
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
  await db.collection("users").doc(uid).set({
    membership: { active: true, updatedAt: Date.now(), updatedBy: request.auth.uid },
  }, { merge: true });

  return { success: true, uid, fullName, stores };
});

/**
 * adminOverview — SOLO admin. Panel de Gestión: totales de usuarios (activos,
 * pendientes, con push) y la lista de delegados con cuántos usuarios/afiliados
 * activos tiene cada uno en sus tiendas (desglose por tienda incluido).
 */
exports.adminOverview = onCall({ maxInstances: 5 }, async (request) => {
  if (!isAdminToken(request.auth && request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo el administrador puede ver el panel de gestión.");
  }
  const db = admin.firestore();

  const usersSnap = await db.collection("users")
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

  const delegadosSnap = await db.collection("delegados").get();
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

/**
 * subscribeToNewsTopic — Suscribe un token FCM al topic de noticias.
 * La usan los clientes WEB: el SDK web de FCM no puede suscribirse a topics por sí
 * mismo (requiere la API de servidor). Los clientes nativos usan el plugin FCM
 * directamente. Idempotente: re-suscribirse en cada arranque es gratis e inofensivo.
 */
exports.subscribeToNewsTopic = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
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

/**
 * purgeUserData — Borra de Firestore TODO lo asociado a un uid (perfil + subcolecciones,
 * peticiones y noticias de delegado) y da de baja su token del topic de noticias. NO toca
 * la cuenta de Auth. Lo comparten DOS caminos: el borrado voluntario desde la app
 * (deleteMyAccount) y el trigger que salta al eliminarse la cuenta de Auth desde CUALQUIER
 * sitio, incluida la consola de Firebase (cleanupOnAuthDelete). Idempotente: si los datos
 * ya no existen, es un no-op (por eso da igual que ambos caminos se solapen).
 */
async function purgeUserData(uid) {
  const db = admin.firestore();

  // Token FCM antes de borrar nada, para dar de baja el dispositivo del topic de noticias.
  const userSnap = await db.collection("users").doc(uid).get();
  const fcmToken = (userSnap.exists && userSnap.data().profile && userSnap.data().profile.fcmToken) || null;

  // 1) Documento de usuario + subcolecciones (shifts, usage) en una sola pasada.
  await db.recursiveDelete(db.collection("users").doc(uid));

  // 2) Peticiones del usuario (colección de nivel superior).
  const reqSnap = await db.collection("requests").where("uid", "==", uid).get();
  for (let i = 0; i < reqSnap.docs.length; i += 400) {
    const batch = db.batch();
    reqSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 3) Sus noticias de delegado, si las tuviera (llevan su nombre → RGPD).
  const newsSnap = await db.collection("noticiasTienda").where("authorUid", "==", uid).get();
  for (let i = 0; i < newsSnap.docs.length; i += 400) {
    const batch = db.batch();
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
 *   2) No limpiaba huérfanos: la subcolección `usage`, las `requests` ni las entradas de
 *      `leaderboards` (relevante para RGPD).
 * El Admin SDK ignora "requires-recent-login" y borra todo de forma consistente.
 */
exports.deleteMyAccount = onCall({ maxInstances: 5 }, async (request) => {
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

/**
 * teamStatus — Devuelve SOLO RECUENTOS del equipo (sin nombres ni emails).
 * Sustituye a la lectura de perfiles ajenos desde el cliente (privacidad, S-3):
 * ahora las reglas impiden que un compañero lea el perfil de otro, y estos
 * agregados los calcula el servidor con el Admin SDK.
 *  - canRequestOff: ¿hay alguien más y al menos un responsable en la sección?
 *  - rank: bossCountExcludingMe permite limitar a 3 responsables por sección.
 * Acepta company/store/section opcionales (al cambiarlos en Ajustes se valida el
 * equipo de DESTINO); por defecto usa el perfil real del que llama.
 */
const BOSS_RE = /.*(jefe|segundo|gestor|coordinador).*/i;

// ⚠️ TRANSICIÓN DE REGIÓN: teamStatus se queda en us-central1 A PROPÓSITO. Las builds
// nativas ya instaladas (App Store / Play) la invocan por nombre+región us-central1;
// si se moviera hoy, esos usuarios perderían el botón "pedir día libre" hasta
// actualizar la app. Es la ÚNICA callable que usan las builds antiguas (IA y Arena van
// tras el flag de admin, y deleteMyAccount/subscribeToNewsTopic no existían aún).
// TODO: cuando la próxima release lleve un tiempo desplegada en las tiendas, cambiar
// esta región a "europe-west1" Y a la vez usar `functions` (no `functionsUsCentral`)
// en fetchTeamStatus (src/services/firebaseService.js).
exports.teamStatus = onCall({ region: "us-central1", maxInstances: 10 }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const uid = request.auth.uid;
  const db = admin.firestore();

  const meSnap = await db.collection("users").doc(uid).get();
  const myProfile = (meSnap.exists && meSnap.data().profile) || {};

  const company = String(request.data?.company || myProfile.company || "").trim();
  const store = String(request.data?.store || myProfile.store || "").trim();
  const section = String(request.data?.section || myProfile.section || "").trim();

  if (!company || !store || !section || section === "Sin especificar") {
    return { memberCount: 0, bossCount: 0, bossCountExcludingMe: 0, canRequestOff: false };
  }

  // Igualdad por empresa+tienda (sin índice compuesto); la sección se filtra en memoria.
  const snap = await db.collection("users")
    .where("profile.company", "==", company)
    .where("profile.store", "==", store)
    .get();

  let memberCount = 0;
  let bossCount = 0;
  let bossCountExcludingMe = 0;
  snap.forEach((d) => {
    const p = d.data().profile || {};
    if (p.section !== section) return;
    memberCount += 1;
    if (p.rank && BOSS_RE.test(p.rank)) {
      bossCount += 1;
      if (d.id !== uid) bossCountExcludingMe += 1;
    }
  });

  return {
    memberCount,
    bossCount,
    bossCountExcludingMe,
    canRequestOff: memberCount > 1 && bossCount >= 1,
  };
});

/**
 * dailyCleanup — Limpieza programada (optimización de almacenamiento F-4).
 * Borra la caché de IA con más de 30 días para que no crezca indefinidamente.
 * Se ejecuta de madrugada (hora de Madrid). (La limpieza de leaderboards se
 * retiró junto con la Arena: la colección se purgó y ya nadie escribe en ella.)
 */
exports.dailyCleanup = onSchedule(
  { schedule: "every day 04:30", timeZone: "Europe/Madrid", maxInstances: 1 },
  async () => {
    const db = admin.firestore();
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ai_cache con timestamp anterior al corte (en lotes de 400).
    let removedCache = 0;
    while (true) {
      const old = await db.collection("ai_cache")
        .where("timestamp", "<", cutoffDate)
        .limit(400)
        .get();
      if (old.empty) break;
      const batch = db.batch();
      old.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      removedCache += old.size;
      if (old.size < 400) break;
    }

    console.log(`Limpieza: ${removedCache} cachés de IA eliminados.`);
    return null;
  }
);
