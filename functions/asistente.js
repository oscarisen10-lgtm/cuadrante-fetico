/**
 * askFeticoAssistant — Asistente laboral (Gemini) sobre el convenio de ANGED y los
 * acuerdos internos de empresa.
 *
 * Tres capas de control de coste, de más barata a más cara:
 *   1. Caché de respuestas en Firestore (`ai_cache`): pregunta repetida = 0 tokens.
 *   2. Context caching de Gemini: el bloque de ~60.000 tokens del convenio se sube
 *      UNA vez y las preguntas siguientes pagan una fracción por reutilizarlo.
 *   3. Cuota diaria por usuario (10 preguntas), en una transacción de Firestore.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const { admin, db, ENFORCE_APP_CHECK } = require("./lib/firebase");
const { buildSystemInstruction } = require("./lib/prompt");

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

// Modelo configurable sin tocar código (variable de entorno GEMINI_MODEL).
// OJO: "gemini-3.5-flash" no es un ID de modelo válido en la API de Gemini y haría
// fallar TODAS las consultas; el valor por defecto es un modelo flash vigente.
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

/**
 * Cuota diaria por usuario. Transacción para que dos peticiones simultáneas no
 * puedan colarse por encima del límite. Devuelve si se permite la consulta.
 */
async function consumeDailyQuota(uid) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const usageRef = db().collection("users").doc(uid).collection("usage").doc(`chat_${today}`);

  return db().runTransaction(async (transaction) => {
    const doc = await transaction.get(usageRef);
    const count = doc.exists ? (doc.data().count || 0) : 0;

    if (count >= MAX_QUESTIONS_PER_DAY) {
      return { allowed: false, currentCount: count };
    }

    transaction.set(usageRef, { count: count + 1 }, { merge: true });
    return { allowed: true, currentCount: count + 1 };
  });
}

exports.askFeticoAssistant = onCall({
  secrets: [geminiApiKey],
  enforceAppCheck: ENFORCE_APP_CHECK,
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
    try {
      const usageResult = await consumeDailyQuota(uid);
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
  // Prefijo de versión: cámbialo (v3, v4...) para invalidar TODA la caché anterior
  // tras editar el system prompt (lib/prompt.js), sin borrar la colección a mano.
  const cacheRef = db().collection("ai_cache").doc("v2-" + safeKey);

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
    const systemInstruction = buildSystemInstruction(acuerdoText, convenioText);

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
