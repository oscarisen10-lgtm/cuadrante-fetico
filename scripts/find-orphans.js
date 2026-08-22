/**
 * find-orphans.js
 * ------------------------------------------------------------------
 * Cruza Firebase Authentication ↔ Firestore (colección `users`) y detecta:
 *   • "Huérfanos de Auth"      → cuentas en Authentication SIN documento en Firestore.
 *                                (la causa de que Auth (>50) > Firestore (37))
 *   • "Huérfanos de Firestore" → documentos en `users` SIN cuenta de Auth (raro).
 *
 * USO
 * ------------------------------------------------------------------
 * 1) Genera una clave de administrador (service account):
 *      Firebase Console → ⚙ Configuración del proyecto → "Cuentas de servicio"
 *      → "Generar nueva clave privada" → guarda el JSON como:
 *          scripts/serviceAccount.json
 *      (está en .gitignore: NO se sube al repositorio)
 *
 * 2) Instala la librería de admin (una sola vez):
 *      npm install firebase-admin
 *
 * 3) Ejecuta:
 *      node scripts/find-orphans.js            → solo INFORME (no borra nada)
 *      node scripts/find-orphans.js --delete   → ADEMÁS borra las cuentas de Auth huérfanas
 *
 * ⚠️  --delete es destructivo: elimina cuentas de Authentication que no tienen
 *     documento en Firestore. Nunca borra la cuenta admin. Revisa el informe antes.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const ADMIN_EMAIL = 'oscarisen10@gmail.com'; // nunca se borra

const KEY_PATH = path.join(__dirname, 'serviceAccount.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('\n❌ No encuentro scripts/serviceAccount.json');
  console.error('   Genera la clave en Firebase Console → Cuentas de servicio → Generar nueva clave privada,');
  console.error('   y guárdala como scripts/serviceAccount.json\n');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const doDelete = process.argv.includes('--delete');
  const db = admin.firestore();

  const [authUsers, fsSnap] = await Promise.all([
    listAllAuthUsers(),
    db.collection('users').select().get(), // .select() = solo IDs, sin descargar perfiles
  ]);

  const fsIds = new Set(fsSnap.docs.map((d) => d.id));
  const authIds = new Set(authUsers.map((u) => u.uid));

  const authOrphans = authUsers.filter((u) => !fsIds.has(u.uid)); // Auth sin doc
  const fsOrphans = [...fsIds].filter((id) => !authIds.has(id));   // doc sin Auth

  console.log('\n=========== RESUMEN ===========');
  console.log(`Cuentas en Authentication        : ${authUsers.length}`);
  console.log(`Documentos en Firestore (users)  : ${fsIds.size}`);
  console.log(`Huérfanos de Auth (sin documento): ${authOrphans.length}`);
  console.log(`Huérfanos de Firestore (sin Auth): ${fsOrphans.length}`);

  if (authOrphans.length) {
    console.log('\n--- Cuentas de AUTH sin documento en Firestore ---');
    authOrphans
      .sort((a, b) => (a.metadata.creationTime || '').localeCompare(b.metadata.creationTime || ''))
      .forEach((u) => {
        const providers = u.providerData.map((p) => p.providerId).join(',') || 'email/password';
        console.log(
          `${u.uid}  ${(u.email || '(sin email)').padEnd(34)}  [${providers}]  ` +
          `creada: ${u.metadata.creationTime || '-'}  últ.acceso: ${u.metadata.lastSignInTime || 'nunca'}`
        );
      });
  }

  if (fsOrphans.length) {
    console.log('\n--- Documentos en FIRESTORE sin cuenta de Auth (revisar a mano) ---');
    fsOrphans.forEach((id) => console.log(id));
  }

  if (doDelete) {
    const toDelete = authOrphans.filter(
      (u) => (u.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()
    );
    console.log(`\n⚠️  Borrando ${toDelete.length} cuentas de Auth huérfanas (admin excluido)...`);
    for (const u of toDelete) {
      try {
        await admin.auth().deleteUser(u.uid);
        console.log(`  ✓ borrada  ${u.email || u.uid}`);
      } catch (e) {
        console.error(`  ✗ ERROR borrando ${u.uid}: ${e.message}`);
      }
    }
    console.log('Hecho.');
  } else if (authOrphans.length) {
    console.log('\n(Solo informe. Para BORRAR las cuentas de Auth huérfanas: node scripts/find-orphans.js --delete)');
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
