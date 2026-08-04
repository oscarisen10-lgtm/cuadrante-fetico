/**
 * Arranque compartido del backend: región global + Admin SDK.
 *
 * Lo requieren TODOS los módulos de funciones. Node cachea los módulos, así que
 * `setGlobalOptions` y `initializeApp` se ejecutan UNA sola vez por instancia,
 * y siempre ANTES de que se declare ninguna función (que es lo que exige la
 * región global).
 */
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// REGIÓN: europe-west1 (Bélgica), pegada a Firestore (eur3) y a los usuarios (España).
// Antes todo corría en us-central1: cada llamada cruzaba el Atlántico dos veces y las
// consultas a Firestore pagaban latencia cross-region (cara en el recursiveDelete de
// deleteMyAccount, por ejemplo).
//
// RECURSOS POR DEFECTO: antes ninguna función declaraba `memory` ni `timeoutSeconds`,
// así que todas heredaban los valores por defecto de 2ª gen (256 MiB / 60 s) sin que
// eso fuera una decisión de nadie. Fijarlos aquí los hace explícitos y revisables; las
// funciones que necesitan más (paneles agregados, envíos masivos, limpieza programada)
// lo declaran en su propia definición y ese valor manda sobre este.
setGlobalOptions({
  region: "europe-west1",
  memory: "256MiB",
  timeoutSeconds: 60,
});

admin.initializeApp();

/**
 * App Check: exigir un token de atestación en las callables.
 *
 * Hoy va DESACTIVADO porque App Check no está configurado en Firebase Console
 * (VITE_APPCHECK_SITE_KEY está vacía en el cliente). Activarlo sin esa
 * configuración dejaría la app inservible para todos los usuarios.
 *
 * CÓMO ACTIVARLO: ver docs/APP-CHECK.md. Resumen: se configura la consola, se
 * publica una release con la clave en el cliente y, cuando las métricas de App
 * Check muestren tráfico verificado, se pone APPCHECK_ENFORCE=true en el entorno
 * de las functions (functions/.env.mi-calendario-fe) y se redespliega.
 */
const ENFORCE_APP_CHECK = process.env.APPCHECK_ENFORCE === "true";

/** Atajo: Firestore. Se llama dentro de los handlers, nunca en la carga del módulo. */
const db = () => admin.firestore();

module.exports = { admin, db, ENFORCE_APP_CHECK };
