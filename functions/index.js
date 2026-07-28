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
 *   lib/prompt.js       instrucción de sistema del asistente
 *   noticias.js         push de noticias globales, de tienda y altas pendientes
 *   delegados.js        gestión de usuarios/afiliación y paneles de admin
 *   asistente.js        askFeticoAssistant (Gemini)
 *   cuentas.js          borrado de cuenta y limpieza de huérfanos
 *   mantenimiento.js    tareas programadas
 */
const noticias = require("./noticias");
const delegados = require("./delegados");
const asistente = require("./asistente");
const cuentas = require("./cuentas");
const mantenimiento = require("./mantenimiento");

// --- Noticias y push ---
exports.sendPushNotification = noticias.sendPushNotification;
exports.sendStoreNews = noticias.sendStoreNews;
exports.notifyDelegadoNewUser = noticias.notifyDelegadoNewUser;
exports.subscribeToNewsTopic = noticias.subscribeToNewsTopic;

// --- Delegados y administración ---
exports.adminStats = delegados.adminStats;
exports.adminOverview = delegados.adminOverview;
exports.adminSetDelegado = delegados.adminSetDelegado;
exports.delegadoListUsers = delegados.delegadoListUsers;
exports.delegadoSetActive = delegados.delegadoSetActive;
exports.delegadoExpelUser = delegados.delegadoExpelUser;
exports.delegadoCensusCounts = delegados.delegadoCensusCounts;

// --- Asistente de IA ---
exports.askFeticoAssistant = asistente.askFeticoAssistant;

// --- Cuentas ---
exports.deleteMyAccount = cuentas.deleteMyAccount;
exports.cleanupOnAuthDelete = cuentas.cleanupOnAuthDelete;

// --- Mantenimiento ---
exports.dailyCleanup = mantenimiento.dailyCleanup;

// La Arena/Competición (submitArenaScore + leaderboards) se ELIMINÓ el 17-jul-2026.
// El flujo de "pedir día libre" y la callable teamStatus se eliminaron el 28-jul-2026.
// Ver historial git para el código anterior.
