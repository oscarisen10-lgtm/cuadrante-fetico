/**
 * Autorización compartida: quién es admin, quién es delegado y qué cuentas están
 * activas. Punto único de verdad para que las reglas de acceso no se dupliquen
 * (ni se desincronicen) entre módulos.
 */
const { admin, db } = require("./firebase");

/**
 * Email del admin: SOLO se usa para PROTEGER su perfil (que un delegado no
 * pueda desactivar/expulsar esa cuenta). La AUTORIZACIÓN de admin va por
 * custom-claim exclusivamente desde el 17-jul-2026 (incidente de borrado).
 */
const ADMIN_EMAIL = "oscargarcia@fetico.es";

/** Admin SOLO por custom-claim (fallback por email eliminado el 17-jul-2026). */
const isAdminToken = (token) => !!(token && token.admin === true);

/** Lanza si la petición no viene de un usuario autenticado. Devuelve su uid. */
const requireAuth = (request, HttpsError) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  return request.auth.uid;
};

/** Doc del delegado que llama, o null si no es delegado (o está desactivado). */
async function getDelegadoDoc(uid) {
  const snap = await db().collection("delegados").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return data.active === false ? null : data;
}

/** membership ausente = usuario anterior al sistema de delegados → activo. */
const isUserActive = (data) => !data.membership || data.membership.active === true;

module.exports = {
  admin,
  db,
  ADMIN_EMAIL,
  isAdminToken,
  requireAuth,
  getDelegadoDoc,
  isUserActive,
};
