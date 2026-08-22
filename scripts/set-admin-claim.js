/**
 * Mueve el ADMIN de la app mediante un "custom claim" ({ admin: true }).
 * Las firestore.rules y storage.rules reconocen ese claim (función isAdmin()),
 * y las Cloud Functions lo comprueban con isAdminToken().
 *
 * IMPORTANTE: el claim va por UID, no por email. Cambiar de administrador no es
 * solo dárselo al nuevo: si no se le RETIRA al anterior, quedan dos admins. Por
 * eso este script hace las dos cosas de una vez.
 *
 * CÓMO USARLO — hacen falta credenciales de administrador del proyecto. Hay dos
 * vías; la primera es preferible porque NO deja en el disco ninguna credencial
 * permanente que luego haya que custodiar y rotar:
 *
 *   a) Credenciales por defecto (recomendado):
 *        gcloud auth application-default login
 *   b) Clave de servicio: Firebase Console > Configuración del proyecto >
 *      Cuentas de servicio > "Generar nueva clave privada", y guardarla como
 *      scripts/serviceAccount.json  (NO subirla a git; ya está en .gitignore).
 *
 * Después:
 *   npm i -D firebase-admin                    (si no lo tienes)
 *   node scripts/set-admin-claim.js --dry-run  (comprueba sin tocar nada)
 *   node scripts/set-admin-claim.js            (aplícalo)
 *
 * El nuevo admin tendrá que CERRAR Y VOLVER A INICIAR SESIÓN para que el claim
 * entre en su token. Al anterior se le revocan las sesiones, así que se le caerá
 * el acceso de admin en cuanto su token caduque (como mucho, una hora).
 *
 * Este email debe coincidir con:
 *   - functions/lib/auth.js  → ADMIN_EMAIL  (protege su perfil y le manda push)
 *   - .env                   → VITE_ADMIN_EMAIL  (solo pinta los botones de admin)
 *   - Codemagic, grupo firebase_config → VITE_ADMIN_EMAIL  (builds de release)
 */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/** Quién pasa a ser admin. */
const ADMIN_EMAIL = 'oscarisen10@gmail.com';

/** A quién se le RETIRA el admin. Deja la lista vacía si no hay que quitárselo a nadie. */
const REVOKE_EMAILS = ['oscargarcia@fetico.es'];

const dryRun = process.argv.includes('--dry-run');

// El proyecto sale de .firebaserc para no repetirlo aquí (ADC con credenciales de
// usuario no siempre trae proyecto asociado, y el SDK lo necesita).
const projectId = JSON.parse(readFileSync('./.firebaserc', 'utf8')).projects.default;

const KEY_PATH = './scripts/serviceAccount.json';
if (existsSync(KEY_PATH)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))), projectId });
  console.log(`Credenciales: clave de servicio (${KEY_PATH}). Proyecto: ${projectId}`);
} else {
  // ADC: lo que deja `gcloud auth application-default login`.
  initializeApp({ credential: applicationDefault(), projectId });
  console.log(`Credenciales: por defecto (ADC, gcloud). Proyecto: ${projectId}`);
}
const auth = getAuth();

/** Busca al usuario por email. Devuelve null si esa cuenta no existe todavía. */
const buscar = async (email) => {
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  }
};

const nuevo = await buscar(ADMIN_EMAIL);
if (!nuevo) {
  console.error(`\n❌ No existe ninguna cuenta con el email ${ADMIN_EMAIL}.`);
  console.error('   Regístrate primero en la app con ese correo y vuelve a ejecutar esto.');
  console.error('   No se ha tocado nada.\n');
  process.exit(1);
}

// Se le quita el admin al anterior ANTES de dárselo al nuevo: si algo falla a
// mitad, es preferible quedarse sin admin un momento que con dos.
for (const email of REVOKE_EMAILS) {
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) continue;
  const user = await buscar(email);
  if (!user) {
    console.log(`· ${email}: no existe esa cuenta, nada que revocar.`);
    continue;
  }
  if (!user.customClaims || user.customClaims.admin !== true) {
    console.log(`· ${email}: no era admin, se deja como está.`);
    continue;
  }
  if (dryRun) {
    console.log(`· [dry-run] se le RETIRARÍA el admin a ${email} (uid ${user.uid}).`);
    continue;
  }
  // Solo se borra la clave `admin`, respetando cualquier otro claim que tenga.
  const resto = { ...user.customClaims };
  delete resto.admin;
  await auth.setCustomUserClaims(user.uid, resto);
  // Sin esto conservaría el admin hasta que su token caducase por su cuenta.
  await auth.revokeRefreshTokens(user.uid);
  console.log(`· ${email} (uid ${user.uid}): admin RETIRADO y sesiones revocadas.`);
}

if (dryRun) {
  console.log(`\n[dry-run] ${ADMIN_EMAIL} (uid ${nuevo.uid}) pasaría a ser admin. No se ha tocado nada.\n`);
  process.exit(0);
}

await auth.setCustomUserClaims(nuevo.uid, { ...(nuevo.customClaims || {}), admin: true });
console.log(`\n✅ ${ADMIN_EMAIL} (uid ${nuevo.uid}) es ahora admin.`);
console.log('   Tiene que cerrar sesión y volver a entrar para que le funcione.\n');
