/**
 * Autorización compartida: quién es admin, quién es delegado y qué cuentas están
 * activas. Punto único de verdad para que las reglas de acceso no se dupliquen
 * (ni se desincronicen) entre módulos.
 */
const { admin, db } = require("./firebase");

/**
 * Email del admin: SOLO se usa para PROTEGER su perfil (que un delegado no
 * pueda desactivar/expulsar esa cuenta) y para avisarle por push. La
 * AUTORIZACIÓN de admin va por custom-claim exclusivamente desde el
 * 17-jul-2026 (incidente de borrado).
 *
 * OJO: cambiar este valor NO cambia quién es admin. El claim va por UID y se
 * mueve con scripts/set-admin-claim.js, que además se lo retira al anterior.
 * Los dos tienen que ir a la vez o el admin real y el protegido serán distintos.
 */
const ADMIN_EMAIL = "oscarisen10@gmail.com";

/** Admin SOLO por custom-claim (fallback por email eliminado el 17-jul-2026). */
const isAdminToken = (token) => !!(token && token.admin === true);

/**
 * ¿Es esta la cuenta del administrador, y por tanto intocable para un delegado?
 *
 * Comprueba DOS cosas: el custom-claim (que es lo que de verdad concede el admin)
 * y el email de ADMIN_EMAIL. Con las dos, la protección no se puede quedar
 * descolgada mientras se cambia de administrador: el claim va por UID y se mueve
 * con un script, y el email se toca aquí, así que entre un paso y el otro habría
 * una ventana en la que el admin de verdad no estaría protegido. Comprobando
 * ambas, durante el cambio quedan protegidos el saliente y el entrante.
 *
 * ⚠️ SEGURIDAD (22-ago-2026): el email se lee SIEMPRE de Firebase Auth, NUNCA del
 * perfil de Firestore. Antes se recibía por parámetro desde `profile.email`, que es
 * un campo que el propio usuario puede reescribir (las reglas solo blindan
 * `membership`). Como VITE_ADMIN_EMAIL viaja en el bundle público, cualquiera podía
 * copiarlo a su propio perfil y volverse inexpulsable para su delegado. El email de
 * Auth solo lo cambia el dueño de la cuenta contra el propio Firebase.
 *
 * @param {string} uid  UID del usuario objetivo.
 */
async function isProtectedAdminAccount(uid) {
  try {
    const user = await admin.auth().getUser(uid);
    if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
    return !!(user.customClaims && user.customClaims.admin === true);
  } catch (e) {
    // Sin cuenta en Auth no hay claim que proteger (p. ej. perfil huérfano).
    if (e && e.code === "auth/user-not-found") return false;
    throw e;
  }
}

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
  isProtectedAdminAccount,
  requireAuth,
  getDelegadoDoc,
  isUserActive,
};
