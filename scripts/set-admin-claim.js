/**
 * Marca a un usuario como ADMIN mediante un "custom claim" ({ admin: true }).
 * Las firestore.rules ya reconocen ese claim (función isAdmin()).
 *
 * CÓMO USARLO (una sola vez):
 * 1) Firebase Console > Configuración del proyecto > Cuentas de servicio >
 *    "Generar nueva clave privada". Se descarga un .json.
 * 2) Guárdalo como  scripts/serviceAccount.json  (NO lo subas a git).
 * 3) Instala el SDK admin si no lo tienes:   npm i -D firebase-admin
 * 4) Ejecuta:   node scripts/set-admin-claim.js
 *
 * El usuario tendrá que cerrar y volver a iniciar sesión para que el claim
 * se refleje en su token.
 */
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_EMAIL = 'oscargarcia@fetico.es'; // <-- cámbialo si hace falta

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccount.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

const user = await getAuth().getUserByEmail(ADMIN_EMAIL);
await getAuth().setCustomUserClaims(user.uid, { admin: true });
console.log(`OK: ${ADMIN_EMAIL} (uid ${user.uid}) es ahora admin. Que cierre e inicie sesión de nuevo.`);
