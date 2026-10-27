/**
 * Borra el SINDICATO de los futuros usuarios del censo que no tengan su consentimiento
 * registrado (auditoría 25-oct-2026, H-03).
 *
 * Desde el 25-oct-2026 la app solo deja apuntar el sindicato de alguien si el delegado
 * marca que esa persona le ha dado su consentimiento expreso, y guarda cuándo y quién
 * lo registró (src/utils/censo.js). Lo apuntado ANTES no tiene ese registro: la app se
 * lo señala al delegado para que lo confirme o lo quite. Este script es el último paso:
 * lo que siga sin confirmar en la fecha que decida Óscar, se borra.
 *
 * Solo quita el campo sindicato. La persona sigue apuntada con su nombre y su sección.
 *
 * Credenciales: las mismas dos vías que scripts/set-admin-claim.js (ADC de gcloud,
 * recomendado, o scripts/serviceAccount.json, que está en .gitignore).
 *
 *   node scripts/limpiar-sindicatos-sin-consentimiento.js            (solo cuenta)
 *   node scripts/limpiar-sindicatos-sin-consentimiento.js --aplicar  (borra)
 *
 * Por defecto NO escribe nada: hace falta --aplicar a propósito. No imprime nombres
 * (son datos de terceros): solo el uid del delegado y cuántas entradas tiene.
 */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sindicatoPendiente, quitarSindicato } from '../src/utils/censo.js';

const aplicar = process.argv.includes('--aplicar');

const projectId = JSON.parse(readFileSync('./.firebaserc', 'utf8')).projects.default;
const KEY_PATH = './scripts/serviceAccount.json';
if (existsSync(KEY_PATH)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))), projectId });
} else {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

console.log(`Proyecto: ${projectId}. Modo: ${aplicar ? 'APLICAR (borra)' : 'solo contar (no toca nada)'}\n`);

const snap = await db.collection('censos').get();
let total = 0;

for (const doc of snap.docs) {
  const prospects = doc.data().prospects || {};
  let delDelegado = 0;
  const limpio = {};
  for (const [tienda, lista] of Object.entries(prospects)) {
    limpio[tienda] = (Array.isArray(lista) ? lista : []).map((p) => {
      if (!sindicatoPendiente(p)) return p;
      delDelegado += 1;
      return quitarSindicato(p);
    });
  }
  if (delDelegado === 0) continue;
  total += delDelegado;
  console.log(`· delegado ${doc.id}: ${delDelegado} sindicato(s) sin consentimiento`);
  if (aplicar) {
    // Solo se reescribe `prospects`; updatedAt deja constancia de cuándo.
    await doc.ref.update({ prospects: limpio, updatedAt: Date.now() });
  }
}

if (total === 0) {
  console.log('No queda ningún sindicato sin consentimiento. Nada que hacer.');
} else if (aplicar) {
  console.log(`\n✅ Borrados ${total} sindicatos sin consentimiento.`);
} else {
  console.log(`\nSe borrarían ${total}. Para hacerlo: añade --aplicar.`);
}
process.exit(0);
