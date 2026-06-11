// Tests de REGLAS DE SEGURIDAD de Firestore.
// Arrancan un Firestore de mentira (el "emulador"), cargan tus firestore.rules,
// y comprueban quién PUEDE y quién NO PUEDE hacer cada cosa.
// Se ejecuta con: npm run test:rules  (necesita Java + firebase-tools).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

let testEnv;

// --- Personajes de prueba ---
const JEFE = 'jefe1';   // Jefe de sección en Supercor / Centro / Frescos
const BASE = 'base1';   // Personal base en la MISMA sección
const BASE2 = 'base2';  // Otro personal base de la misma sección (no es jefe)
const BARNA = 'barna1'; // Personal base en OTRA tienda (Barcelona)

const STOREKEY_CENTRO = 'Supercor_Centro_Frescos';
const STOREKEY_BARNA = 'Supercor_Barcelona_Frescos';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-cuadrante',
    firestore: {
      rules: readFileSync(join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// Antes de cada test: BD limpia + datos sembrados (saltándose las reglas, como haría el backend).
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', JEFE), {
      profile: { company: 'Supercor', store: 'Centro', section: 'Frescos', rank: 'Jefe de sección', fullName: 'Jefa Centro' },
    });
    await setDoc(doc(db, 'users', BASE), {
      profile: { company: 'Supercor', store: 'Centro', section: 'Frescos', rank: 'Personal base', fullName: 'Base Uno' },
    });
    await setDoc(doc(db, 'users', BASE2), {
      profile: { company: 'Supercor', store: 'Centro', section: 'Frescos', rank: 'Personal base', fullName: 'Base Dos' },
    });
    await setDoc(doc(db, 'users', BARNA), {
      profile: { company: 'Supercor', store: 'Barcelona', section: 'Frescos', rank: 'Personal base', fullName: 'Barna' },
    });
    // Un turno propio de base1 y una petición pendiente suya.
    await setDoc(doc(db, 'users', BASE, 'shifts', '2026-06-10'), { date: '2026-06-10', type: 'work', hours: 8 });
    await setDoc(doc(db, 'requests', 'req1'), { uid: BASE, storeKey: STOREKEY_CENTRO, status: 'pending', date: '2026-06-15' });
    // Una noticia.
    await setDoc(doc(db, 'noticias', 'n1'), { title: 'Aviso', createdAt: 1 });
  });
});

// Atajo: BD autenticada como cierto usuario (con claims opcionales).
const as = (uid, claims = {}) => testEnv.authenticatedContext(uid, claims).firestore();

describe('Perfiles de usuario (lectura acotada)', () => {
  test('un empleado SÍ puede leer un perfil de su MISMA tienda', async () => {
    await assertSucceeds(getDoc(doc(as(BASE), 'users', JEFE)));
  });

  test('un empleado NO puede leer un perfil de OTRA tienda', async () => {
    await assertFails(getDoc(doc(as(BASE), 'users', BARNA)));
  });

  test('cada usuario puede leer su propio perfil', async () => {
    await assertSucceeds(getDoc(doc(as(BARNA), 'users', BARNA)));
  });
});

describe('Turnos', () => {
  test('el jefe SÍ puede escribir el turno de descanso de su subordinado (aprobar día libre)', async () => {
    await assertSucceeds(
      setDoc(doc(as(JEFE), 'users', BASE, 'shifts', '2026-06-15'), { date: '2026-06-15', type: 'rest', hours: 0 })
    );
  });

  test('un compañero (no jefe) NO puede escribir el turno de otro', async () => {
    await assertFails(
      setDoc(doc(as(BASE2), 'users', BASE, 'shifts', '2026-06-15'), { date: '2026-06-15', type: 'rest', hours: 0 })
    );
  });

  test('un compañero (no jefe) NO puede leer los turnos de otro', async () => {
    await assertFails(getDoc(doc(as(BASE2), 'users', BASE, 'shifts', '2026-06-10')));
  });

  test('cada uno SÍ puede leer sus propios turnos', async () => {
    await assertSucceeds(getDoc(doc(as(BASE), 'users', BASE, 'shifts', '2026-06-10')));
  });
});

describe('Peticiones (días libres)', () => {
  test('el jefe SÍ puede aprobar la petición de su subordinado', async () => {
    await assertSucceeds(updateDoc(doc(as(JEFE), 'requests', 'req1'), { status: 'approved' }));
  });

  test('un compañero (no jefe, no dueño) NO puede aprobar la petición de otro', async () => {
    await assertFails(updateDoc(doc(as(BASE2), 'requests', 'req1'), { status: 'approved' }));
  });

  test('el dueño SÍ puede modificar su propia petición (p.ej. cancelarla)', async () => {
    await assertSucceeds(updateDoc(doc(as(BASE), 'requests', 'req1'), { status: 'cancelled' }));
  });

  test('alguien de OTRA tienda NO puede leer la petición', async () => {
    await assertFails(getDoc(doc(as(BARNA), 'requests', 'req1')));
  });

  test('un usuario SÍ puede crear su propia petición con su storeKey real', async () => {
    await assertSucceeds(
      setDoc(doc(as(BASE), 'requests', 'nueva'), { uid: BASE, storeKey: STOREKEY_CENTRO, status: 'pending', date: '2026-06-20' })
    );
  });

  test('un usuario NO puede falsear el storeKey (enrutar a otra sección)', async () => {
    await assertFails(
      setDoc(doc(as(BASE), 'requests', 'falsa'), { uid: BASE, storeKey: STOREKEY_BARNA, status: 'pending', date: '2026-06-20' })
    );
  });

  test('un usuario NO puede crear una petición a nombre de OTRO', async () => {
    await assertFails(
      setDoc(doc(as(BASE), 'requests', 'suplantada'), { uid: BASE2, storeKey: STOREKEY_CENTRO, status: 'pending', date: '2026-06-20' })
    );
  });
});

describe('Noticias', () => {
  test('un usuario autenticado SÍ puede leer las noticias', async () => {
    await assertSucceeds(getDoc(doc(as(BASE), 'noticias', 'n1')));
  });

  test('alguien SIN sesión NO puede leer las noticias', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'noticias', 'n1')));
  });

  test('un usuario normal NO puede publicar noticias', async () => {
    await assertFails(setDoc(doc(as(BASE), 'noticias', 'hack'), { title: 'spam', createdAt: 2 }));
  });
});

describe('Admin (custom claim)', () => {
  test('un admin (token.admin) puede leer cualquier perfil, incluso de otra tienda', async () => {
    await assertSucceeds(getDoc(doc(as('admin1', { admin: true }), 'users', BARNA)));
  });

  test('un admin (token.admin) SÍ puede publicar noticias', async () => {
    await assertSucceeds(setDoc(doc(as('admin1', { admin: true }), 'noticias', 'oficial'), { title: 'Comunicado', createdAt: 3 }));
  });
});
