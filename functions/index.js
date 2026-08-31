/**
 * Punto de entrada del backend (Cloud Functions).
 *
 * Este fichero SOLO reexporta: antes eran ~1.070 líneas con todo mezclado (push,
 * delegados, IA, borrado de cuentas y limpieza programada). Ahora cada dominio
 * vive en su módulo y lo compartido en lib/.
 *
 * ⚠️ Los NOMBRES exportados aquí son los nombres desplegados en Firebase. Cambiar
 * uno equivale a BORRAR esa función y crear otra nueva (con su URL/trigger). No
 * renombrar sin querer hacer exactamente eso.
 *
 * Mapa:
 *   lib/firebase.js     región global, Admin SDK y el flag de App Check
 *   lib/auth.js         admin por custom-claim, delegados y cuentas activas
 *   lib/push.js         payload único de FCM (antes copiado en 3 sitios) y envíos
 *   noticias.js         push de noticias globales, de tienda y altas pendientes
 *   delegados.js        gestión de usuarios/afiliación y paneles de admin
 *   cuentas.js          borrado de cuenta y limpieza de huérfanos
 */
const noticias = require("./noticias");
const delegados = require("./delegados");
const cuentas = require("./cuentas");

// --- Noticias y push ---
exports.sendPushNotification = noticias.sendPushNotification;
exports.sendStoreNews = noticias.sendStoreNews;
exports.notifyDelegadoNewUser = noticias.notifyDelegadoNewUser;
exports.subscribeToNewsTopic = noticias.subscribeToNewsTopic;

// --- Delegados y administración ---
exports.adminStats = delegados.adminStats;
exports.adminOverview = delegados.adminOverview;
exports.adminSetDelegado = delegados.adminSetDelegado;
exports.adminSetNoticias = delegados.adminSetNoticias;
exports.delegadoListUsers = delegados.delegadoListUsers;
exports.delegadoSetActive = delegados.delegadoSetActive;
exports.delegadoExpelUser = delegados.delegadoExpelUser;
exports.delegadoCensusCounts = delegados.delegadoCensusCounts;

// --- Cuentas ---
exports.deleteMyAccount = cuentas.deleteMyAccount;
exports.cleanupOnAuthDelete = cuentas.cleanupOnAuthDelete;
// Única vía para cambiar de tienda: las reglas ya no dejan tocar profile.store desde
// el cliente, porque de ese campo dependen las noticias de delegado y el censo.
exports.cambiarMiTienda = cuentas.cambiarMiTienda;

// La Arena/Competición (submitArenaScore + leaderboards) se ELIMINÓ el 17-jul-2026.
// El flujo de "pedir día libre" y la callable teamStatus se eliminaron el 28-jul-2026.
// El asistente de IA (askFeticoAssistant + Gemini) se eliminó el 28-jul-2026: se
// retomará más adelante desde cero. Ver historial git para el código anterior.
//
// dailyCleanup (mantenimiento.js) se ELIMINÓ el 05-ago-2026: purgaba los restos de
// `ai_cache` (confirmado vacío, 8 días seguidos en 0) y de `usage`, pero se borró
// justo tras desplegar el chequeo de `usage` — antes de que llegara a ejecutarse ni
// una vez. Si queda algún doc suelto en `users/{uid}/usage/chat_YYYY-MM-DD`, hay que
// purgarlo a mano (Admin SDK; las reglas deniegan el acceso desde el cliente).
//
// ⚠️ Al desplegar, `firebase deploy --only functions` NO borra una función que ya
// no se exporta: hay que retirarla explícitamente una vez:
//     firebase functions:delete askFeticoAssistant --region europe-west1
// Y revocar el secreto que ya nadie usa:
//     firebase functions:secrets:destroy GEMINI_API_KEY
