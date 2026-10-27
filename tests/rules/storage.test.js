// Tests de las REGLAS DE STORAGE (storage.rules).
//
// Hasta el 25-oct-2026 no había ninguno: las reglas de Storage solo se subían a mano y
// nada comprobaba que hicieran lo que dicen sus comentarios. Estas reglas leen Firestore
// (quién es delegado, de qué tienda es cada usuario, a qué tiendas va cada noticia), así
// que el test levanta los DOS emuladores y siembra los dos.
//
// Se ejecuta con: npm run test:rules  (necesita Java 21, como los de Firestore).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leer = (f) => readFileSync(join(__dirname, '..', '..', f), 'utf8');

let testEnv;

// --- Personajes ---
const DELEGADO = 'delegado1';   // delegado ACTIVO de la tienda Centro
const BASE = 'base1';           // usuario activo de Centro (sin membership = cuenta antigua = activa)
const PENDIENTE = 'pendiente1'; // usuario de Centro SIN verificar
const BARNA = 'barna1';         // usuario activo de otra tienda
const ADMIN = 'admin1';

const CARTEL = `noticias-delegado/${DELEGADO}/nt1/cartel.jpg`;

const bytes = (n = 16) => new Uint8Array(n);
const subir = (storage, ruta, contentType = 'image/jpeg', n = 16) =>
  Promise.resolve(storage.ref(ruta).put(bytes(n), { contentType }));
const mirar = (storage, ruta) => storage.ref(ruta).getMetadata();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-cuadrante',
    firestore: { rules: leer('firestore.rules'), host: '127.0.0.1', port: 8080 },
    storage: { rules: leer('storage.rules'), host: '127.0.0.1', port: 9199 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'delegados', DELEGADO), { stores: ['Centro'], active: true });
    await setDoc(doc(db, 'users', BASE), { profile: { store: 'Centro' } });
    await setDoc(doc(db, 'users', PENDIENTE), {
      profile: { store: 'Centro' }, membership: { active: false, createdAt: 1 },
    });
    await setDoc(doc(db, 'users', BARNA), { profile: { store: 'Barcelona' } });
    await setDoc(doc(db, 'noticiasTienda', 'nt1'), {
      title: 'Asamblea', desc: 'Viernes', stores: ['Centro'], authorUid: DELEGADO, createdAt: 1,
    });
    const st = ctx.storage();
    await subir(st, CARTEL);
    await subir(st, 'noticias/global.jpg');
    await subir(st, 'noticias-delegado/1720000000_cartel.jpg'); // ruta plana heredada
  });
});

const como = (uid, claims = {}) => testEnv.authenticatedContext(uid, claims).storage();
const anonimo = () => testEnv.unauthenticatedContext().storage();

describe('Subir carteles de delegado', () => {
  test('el delegado SÍ sube un JPEG a su carpeta', async () => {
    await assertSucceeds(subir(como(DELEGADO), `noticias-delegado/${DELEGADO}/nt2/cartel.jpg`));
  });

  test('y un WebP', async () => {
    await assertSucceeds(subir(como(DELEGADO), `noticias-delegado/${DELEGADO}/nt2/cartel.webp`, 'image/webp'));
  });

  // Auditoría 25-oct-2026: SVG es XML y puede llevar scripts.
  test('NO puede subir un SVG', async () => {
    await assertFails(subir(como(DELEGADO), `noticias-delegado/${DELEGADO}/nt2/x.svg`, 'image/svg+xml'));
  });

  test('NO puede subir algo que no es una imagen', async () => {
    await assertFails(subir(como(DELEGADO), `noticias-delegado/${DELEGADO}/nt2/x.html`, 'text/html'));
  });

  test('NO puede pasar de 5 MB', async () => {
    await assertFails(subir(como(DELEGADO), `noticias-delegado/${DELEGADO}/nt2/grande.jpg`, 'image/jpeg', 5 * 1024 * 1024));
  });

  test('NO puede subir a la carpeta de OTRO delegado', async () => {
    await assertFails(subir(como(DELEGADO), 'noticias-delegado/otroDelegado/nt2/cartel.jpg'));
  });

  test('un usuario que no es delegado NO puede subir a su propia carpeta', async () => {
    await assertFails(subir(como(BASE), `noticias-delegado/${BASE}/nt2/cartel.jpg`));
  });

  test('nadie sube ya a la ruta plana heredada', async () => {
    await assertFails(subir(como(DELEGADO), 'noticias-delegado/nuevo_cartel.jpg'));
  });
});

describe('Leer carteles de delegado', () => {
  test('un usuario ACTIVO de la tienda destino SÍ puede', async () => {
    await assertSucceeds(mirar(como(BASE), CARTEL));
  });

  // Auditoría 25-oct-2026: igual que en Firestore, una cuenta sin verificar no ve las
  // noticias de su tienda; tampoco el cartel.
  test('una cuenta PENDIENTE de la tienda destino NO puede', async () => {
    await assertFails(mirar(como(PENDIENTE), CARTEL));
  });

  test('un usuario de OTRA tienda NO puede', async () => {
    await assertFails(mirar(como(BARNA), CARTEL));
  });

  test('el autor y el admin SÍ pueden', async () => {
    await assertSucceeds(mirar(como(DELEGADO), CARTEL));
    await assertSucceeds(mirar(como(ADMIN, { admin: true }), CARTEL));
  });

  test('sin sesión NO', async () => {
    await assertFails(mirar(anonimo(), CARTEL));
  });

  test('los carteles de la ruta plana heredada se siguen viendo con sesión', async () => {
    await assertSucceeds(mirar(como(BARNA), 'noticias-delegado/1720000000_cartel.jpg'));
  });
});

describe('Noticias globales del admin', () => {
  test('solo el admin sube', async () => {
    await assertSucceeds(subir(como(ADMIN, { admin: true }), 'noticias/nueva.webp', 'image/webp'));
    await assertFails(subir(como(DELEGADO), 'noticias/nueva.webp', 'image/webp'));
    await assertFails(subir(como(BASE), 'noticias/nueva.webp', 'image/webp'));
  });

  test('cualquiera con sesión las ve; sin sesión, no', async () => {
    await assertSucceeds(mirar(como(PENDIENTE), 'noticias/global.jpg'));
    await assertFails(mirar(anonimo(), 'noticias/global.jpg'));
  });
});

describe('Todo lo demás', () => {
  test('cerrado incluso para leer', async () => {
    await assertFails(mirar(como(ADMIN, { admin: true }), 'otra-cosa/fichero.jpg'));
    await assertFails(subir(como(BASE), 'otra-cosa/fichero.jpg'));
  });
});
