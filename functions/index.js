const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

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

  // 1. Collect all FCM tokens from registered users.
  // .select() proyecta SOLO el token: evita descargar el perfil completo de cada
  // usuario (mucho menos ancho de banda y memoria al crecer la plantilla).
  const usersSnapshot = await admin.firestore()
    .collection("users")
    .select("profile.fcmToken")
    .get();
  const tokenToUidMap = new Map(); // Map token -> uid for cleanup

  usersSnapshot.forEach((doc) => {
    const profile = doc.data().profile;
    if (profile && profile.fcmToken) {
      tokenToUidMap.set(profile.fcmToken, doc.id);
    }
  });

  const uniqueTokens = [...tokenToUidMap.keys()];

  if (uniqueTokens.length === 0) {
    console.log("No hay tokens registrados para enviar la notificación.");
    return null;
  }

  console.log(`Enviando push a ${uniqueTokens.length} dispositivos...`);

  // 2. Build the multicast message
  const message = {
    notification: {
      title: title,
      body: body,
    },
    webpush: {
      notification: {
        icon: "https://calendario-fetico.web.app/img/app.PNG",
        badge: "https://calendario-fetico.web.app/img/app.PNG",
      },
      fcmOptions: {
        link: "https://calendario-fetico.web.app",
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
    tokens: uniqueTokens,
  };

  // 3. Send via Firebase Admin SDK
  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`${response.successCount} mensajes enviados con éxito.`);

    // 4. Clean up invalid/expired tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          console.error(`Token fallido [${idx}]:`, errorCode, resp.error?.message);

          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            tokensToRemove.push(uniqueTokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        console.log(`Limpiando ${tokensToRemove.length} tokens inválidos...`);
        const batch = admin.firestore().batch();
        tokensToRemove.forEach((deadToken) => {
          const uid = tokenToUidMap.get(deadToken);
          if (uid) {
            batch.update(admin.firestore().doc(`users/${uid}`), {
              "profile.fcmToken": admin.firestore.FieldValue.delete(),
            });
          }
        });
        await batch.commit();
        console.log("Tokens inválidos eliminados correctamente.");
      }
    }
  } catch (error) {
    console.error("Error enviando notificaciones:", error);
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

  const isAdmin = request.auth.token && request.auth.token.email === "oscargarcia@fetico.es";

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

/**
 * submitArenaScore — Guarda la puntuación de un minijuego (modelo "por diversión").
 * - Límite de partidas/día por usuario (el admin está exento, como en la IA).
 * - Tope de cordura en la puntuación (anti-trampa básico; nada de premios reales).
 * - El nombre y la tienda se leen del perfil en el SERVIDOR (el cliente no los puede falsear).
 * - Guarda la MEJOR marca del día y mantiene un agregado por tienda (suma de mejores marcas).
 */
const ARENA_MAX_SCORE = 5000;     // tope de cordura por partida
const ARENA_DAILY_PLAYS = 3;      // partidas puntuables por usuario y día
const ADMIN_EMAIL_FN = "oscargarcia@fetico.es";

exports.submitArenaScore = onCall({ enforceAppCheck: false, maxInstances: 10 }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para competir.");
  }
  const uid = request.auth.uid;

  let { gameId, score } = request.data || {};
  if (typeof gameId !== "string" || gameId.length === 0 || gameId.length > 30) {
    throw new HttpsError("invalid-argument", "Juego no válido.");
  }
  // Tope de cordura: entero entre 0 y ARENA_MAX_SCORE.
  score = Math.max(0, Math.min(ARENA_MAX_SCORE, Math.floor(Number(score) || 0)));

  const db = admin.firestore();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const isAdmin = request.auth.token && (request.auth.token.admin === true || request.auth.token.email === ADMIN_EMAIL_FN);

  // Perfil (servidor): nombre y tienda reales, no manipulables por el cliente.
  const userSnap = await db.collection("users").doc(uid).get();
  const profile = (userSnap.exists && userSnap.data().profile) || {};
  const name = profile.fullName || "Compañero/a";
  const company = profile.company || "—";
  const store = profile.store || "—";
  const storeKey = `${company}__${store}`;

  const usageRef = db.collection("users").doc(uid).collection("usage").doc(`arena_${today}`);
  const playerRef = db.collection("leaderboards").doc(today).collection("players").doc(uid);
  const storeRef = db.collection("leaderboards").doc(today).collection("stores").doc(storeKey);

  const result = await db.runTransaction(async (tx) => {
    const usageDoc = await tx.get(usageRef);
    const playerDoc = await tx.get(playerRef);
    const storeDoc = await tx.get(storeRef);

    const used = usageDoc.exists ? (usageDoc.data().count || 0) : 0;
    if (!isAdmin && used >= ARENA_DAILY_PLAYS) {
      return { allowed: false };
    }

    const oldBest = playerDoc.exists ? (playerDoc.data().score || 0) : 0;
    const newBest = Math.max(oldBest, score);

    tx.set(playerRef, {
      uid, name, company, store, storeKey, gameId,
      score: newBest, date: today,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const delta = newBest - oldBest;
    if (delta > 0) {
      const prevTotal = storeDoc.exists ? (storeDoc.data().total || 0) : 0;
      tx.set(storeRef, { company, store, storeKey, date: today, total: prevTotal + delta }, { merge: true });
    }

    if (!isAdmin) tx.set(usageRef, { count: used + 1 }, { merge: true });

    return {
      allowed: true,
      best: newBest,
      improved: delta > 0,
      attemptsLeft: isAdmin ? 999 : Math.max(0, ARENA_DAILY_PLAYS - (used + 1)),
    };
  });

  if (!result.allowed) {
    throw new HttpsError("resource-exhausted", "Has agotado tus partidas de hoy. ¡Vuelve mañana!");
  }
  return { success: true, ...result };
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

exports.teamStatus = onCall({ maxInstances: 10 }, async (request) => {
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
 * Borra rankings y caché de IA con más de 30 días para que esas colecciones no
 * crezcan indefinidamente. Se ejecuta de madrugada (hora de Madrid).
 */
exports.dailyCleanup = onSchedule(
  { schedule: "every day 04:30", timeZone: "Europe/Madrid", maxInstances: 1 },
  async () => {
    const db = admin.firestore();
    const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs);
    const cutoffStr = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // 1) leaderboards/{YYYY-MM-DD} (con subcolecciones) más antiguos que el corte.
    let removedLb = 0;
    const lbSnap = await db.collection("leaderboards").get();
    for (const d of lbSnap.docs) {
      if (d.id < cutoffStr) {
        await db.recursiveDelete(d.ref);
        removedLb += 1;
      }
    }

    // 2) ai_cache con timestamp anterior al corte (en lotes de 400).
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

    console.log(`Limpieza: ${removedLb} rankings y ${removedCache} cachés de IA eliminados.`);
    return null;
  }
);
