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
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

let testEnv;

// --- Personajes de prueba ---
const JEFE = 'jefe1';   // Jefe de sección en Supercor / Centro / Frescos
const BASE = 'base1';   // Personal base en la MISMA sección
const BASE2 = 'base2';  // Otro personal base de la misma sección (no es jefe)
const BARNA = 'barna1'; // Personal base en OTRA tienda (Barcelona)
const PENDIENTE = 'pendiente1'; // Cuenta nueva SIN activar (membership.active == false)
const DELEGADO = 'delegado1';   // Delegado con doc en delegados/{uid}

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
    // Cuenta nueva PENDIENTE de activar por un delegado (sistema de delegados).
    await setDoc(doc(db, 'users', PENDIENTE), {
      profile: { company: 'Supercor', store: 'Centro', section: 'Frescos', rank: 'Personal base', fullName: 'Nuevo Sin Activar' },
      membership: { active: false, createdAt: 1 },
    });
    // Un delegado con su doc de tiendas autorizadas.
    await setDoc(doc(db, 'delegados', DELEGADO), { stores: ['Centro'], active: true });
    // Una noticia de delegado dirigida a la tienda Centro.
    await setDoc(doc(db, 'noticiasTienda', 'nt1'), {
      title: 'Asamblea', desc: 'Reunión el viernes', stores: ['Centro'],
      authorUid: DELEGADO, createdAt: 1,
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

describe('Perfiles de usuario (lectura PRIVADA)', () => {
  test('un compañero (no jefe) NO puede leer el perfil de otro de su tienda (privacidad: email/fcmToken)', async () => {
    await assertFails(getDoc(doc(as(BASE), 'users', BASE2)));
  });

  // SEGURIDAD (escalada de privilegios): el rango lo autoelige el usuario y NO está
  // verificado, así que ni siquiera un "Jefe de sección" puede leer perfiles ajenos
  // desde el cliente. Si esto pasara, cualquiera se autoproclamaría jefe y filtraría PII.
  test('un "jefe" (rango autodeclarado) NO puede leer el perfil de su supuesto subordinado', async () => {
    await assertFails(getDoc(doc(as(JEFE), 'users', BASE)));
  });

  test('un empleado NO puede leer un perfil de OTRA tienda', async () => {
    await assertFails(getDoc(doc(as(BASE), 'users', BARNA)));
  });

  test('cada usuario puede leer su propio perfil', async () => {
    await assertSucceeds(getDoc(doc(as(BARNA), 'users', BARNA)));
  });
});

describe('Turnos', () => {
  // El rango autodeclarado tampoco permite tocar los turnos de otro (anti-escalada).
  test('un "jefe" (rango autodeclarado) NO puede escribir el turno de su supuesto subordinado', async () => {
    await assertFails(
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

  test('NO se puede guardar un turno con tipo inválido (validación de forma)', async () => {
    await assertFails(
      setDoc(doc(as(BASE), 'users', BASE, 'shifts', '2026-06-11'), { date: '2026-06-11', type: 'hackeo', hours: 0 })
    );
  });

  test('SÍ se puede guardar un turno propio con forma válida', async () => {
    await assertSucceeds(
      setDoc(doc(as(BASE), 'users', BASE, 'shifts', '2026-06-12'), { date: '2026-06-12', type: 'work', hours: 8 })
    );
  });
});

describe('Turnos mensuales (shiftMonths, modelo v2)', () => {
  const MES = { month: '2026-06', days: { '10': { type: 'work', hours: 8, isHA: false } } };

  test('el dueño SÍ puede escribir su doc mensual con forma válida', async () => {
    await assertSucceeds(
      setDoc(doc(as(BASE), 'users', BASE, 'shiftMonths', '2026-06'), MES)
    );
  });

  test('el dueño SÍ puede leer sus docs mensuales', async () => {
    await assertSucceeds(getDoc(doc(as(BASE), 'users', BASE, 'shiftMonths', '2026-06')));
  });

  test('un compañero NO puede leer los turnos mensuales de otro', async () => {
    await assertFails(getDoc(doc(as(BASE2), 'users', BASE, 'shiftMonths', '2026-06')));
  });

  test('un compañero NO puede escribir los turnos mensuales de otro', async () => {
    await assertFails(
      setDoc(doc(as(BASE2), 'users', BASE, 'shiftMonths', '2026-06'), MES)
    );
  });

  test('NO se puede escribir un doc mensual con campos extra (forma controlada)', async () => {
    await assertFails(
      setDoc(doc(as(BASE), 'users', BASE, 'shiftMonths', '2026-06'), { ...MES, hacked: true })
    );
  });

  test('NO se puede escribir un doc mensual con month inválido', async () => {
    await assertFails(
      setDoc(doc(as(BASE), 'users', BASE, 'shiftMonths', 'x'), { month: 'x', days: {} })
    );
  });

  // La migración y Fichar deben funcionar también para cuentas pendientes
  // (el detalle por día lo controla la interfaz; ver comentario en las reglas).
  test('una cuenta pendiente SÍ puede escribir su doc mensual (migración + Fichar)', async () => {
    await assertSucceeds(
      setDoc(doc(as(PENDIENTE), 'users', PENDIENTE, 'shiftMonths', '2026-06'), MES)
    );
  });
});

describe('Peticiones (días libres)', () => {
  // La aprobación por responsables se hará por Cloud Function cuando se reactive; desde
  // el cliente, un rango autodeclarado NO puede tocar la petición de otro (anti-escalada).
  test('un "jefe" (rango autodeclarado) NO puede aprobar la petición de otro desde el cliente', async () => {
    await assertFails(updateDoc(doc(as(JEFE), 'requests', 'req1'), { status: 'approved' }));
  });

  test('un compañero (no jefe, no dueño) NO puede aprobar la petición de otro', async () => {
    await assertFails(updateDoc(doc(as(BASE2), 'requests', 'req1'), { status: 'approved' }));
  });

  test('el dueño SÍ puede retocar su propia petición (p.ej. la nota)', async () => {
    await assertSucceeds(updateDoc(doc(as(BASE), 'requests', 'req1'), { note: 'cita médica' }));
  });

  // status lo gestionará el backend cuando exista flujo de aprobación: si el dueño
  // pudiera tocarlo, se autoaprobaría con una llamada REST. Para cancelar, borra.
  test('el dueño NO puede cambiar el status de su petición (nadie se autoaprueba)', async () => {
    await assertFails(updateDoc(doc(as(BASE), 'requests', 'req1'), { status: 'approved' }));
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

  test('al actualizar una petición NO se puede cambiar el dueño (uid inmutable)', async () => {
    await assertFails(
      updateDoc(doc(as(BASE), 'requests', 'req1'), { uid: BASE2 })
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

describe('Sistema de delegados (activación de cuentas)', () => {
  test('un registro nuevo SÍ se puede crear si nace desactivado (membership.active == false)', async () => {
    await assertSucceeds(
      setDoc(doc(as('nuevo1'), 'users', 'nuevo1'), {
        profile: { company: 'Supercor', store: 'Centro', fullName: 'Recién Llegado' },
        membership: { active: false, createdAt: 2 },
      })
    );
  });

  test('un registro nuevo SIN membership NO se puede crear (nadie nace activado por omisión)', async () => {
    await assertFails(
      setDoc(doc(as('nuevo2'), 'users', 'nuevo2'), {
        profile: { company: 'Supercor', store: 'Centro', fullName: 'Tramposo' },
      })
    );
  });

  test('un registro nuevo NO puede nacer ya activado (membership.active == true)', async () => {
    await assertFails(
      setDoc(doc(as('nuevo3'), 'users', 'nuevo3'), {
        profile: { company: 'Supercor', store: 'Centro', fullName: 'Autoactivado' },
        membership: { active: true },
      })
    );
  });

  test('una cuenta pendiente NO puede autoactivarse tocando su membership', async () => {
    await assertFails(
      updateDoc(doc(as(PENDIENTE), 'users', PENDIENTE), { membership: { active: true } })
    );
  });

  test('una cuenta pendiente NO puede BORRAR su membership (quedaría "antigua" = activa)', async () => {
    await assertFails(
      setDoc(doc(as(PENDIENTE), 'users', PENDIENTE), {
        profile: { company: 'Supercor', store: 'Centro', fullName: 'Nuevo Sin Activar' },
      })
    );
  });

  test('una cuenta pendiente SÍ puede editar su perfil y ajustes (sin tocar membership)', async () => {
    await assertSucceeds(
      updateDoc(doc(as(PENDIENTE), 'users', PENDIENTE), { settings: { notifications: true } })
    );
  });

  // Fichar está abierto a las cuentas pendientes A PROPÓSITO (decisión de producto):
  // pueden registrar su jornada ('work'), pero libres/vacaciones/bajas siguen
  // bloqueados hasta que se active la cuenta.
  test('una cuenta pendiente SÍ puede registrar jornada (Fichar abierto)', async () => {
    await assertSucceeds(
      setDoc(doc(as(PENDIENTE), 'users', PENDIENTE, 'shifts', '2026-06-20'), { date: '2026-06-20', type: 'work', hours: 8 })
    );
  });

  test('una cuenta pendiente NO puede marcar libres/vacaciones (se desbloquea al activar)', async () => {
    await assertFails(
      setDoc(doc(as(PENDIENTE), 'users', PENDIENTE, 'shifts', '2026-06-21'), { date: '2026-06-21', type: 'rest', hours: 0 })
    );
  });

  test('una cuenta pendiente NO puede crear peticiones de días libres', async () => {
    await assertFails(
      setDoc(doc(as(PENDIENTE), 'requests', 'bloqueada'), { uid: PENDIENTE, storeKey: STOREKEY_CENTRO, status: 'pending', date: '2026-06-21' })
    );
  });

  test('una cuenta SIN membership (usuario de antes del sistema) SÍ sigue creando turnos', async () => {
    await assertSucceeds(
      setDoc(doc(as(BASE), 'users', BASE, 'shifts', '2026-06-22'), { date: '2026-06-22', type: 'work', hours: 8 })
    );
  });

  test('un usuario normal (aunque sea de la misma tienda) NO puede tocar el membership de otro', async () => {
    await assertFails(
      updateDoc(doc(as(BASE), 'users', PENDIENTE), { membership: { active: true } })
    );
  });

  test('el admin SÍ puede activar la cuenta de cualquiera', async () => {
    await assertSucceeds(
      updateDoc(doc(as('admin1', { admin: true }), 'users', PENDIENTE), { membership: { active: true } })
    );
  });
});

describe('Noticias de delegado (noticiasTienda)', () => {
  const nueva = (extra = {}) => ({
    title: 'Aviso', desc: 'Texto', stores: ['Centro'],
    authorUid: DELEGADO, createdAt: 2, ...extra,
  });

  test('un usuario de la tienda destino SÍ puede leer la noticia', async () => {
    await assertSucceeds(getDoc(doc(as(BASE), 'noticiasTienda', 'nt1')));
  });

  test('un usuario de OTRA tienda NO puede leer la noticia', async () => {
    await assertFails(getDoc(doc(as(BARNA), 'noticiasTienda', 'nt1')));
  });

  test('el feed por tienda (array-contains la tienda PROPIA) es una consulta válida', async () => {
    const q = query(collection(as(BASE), 'noticiasTienda'), where('stores', 'array-contains', 'Centro'));
    await assertSucceeds(getDocs(q));
  });

  test('consultar el feed de OTRA tienda es rechazado', async () => {
    const q = query(collection(as(BASE), 'noticiasTienda'), where('stores', 'array-contains', 'Barcelona'));
    await assertFails(getDocs(q));
  });

  test('el delegado SÍ puede publicar para su tienda autorizada', async () => {
    await assertSucceeds(setDoc(doc(as(DELEGADO), 'noticiasTienda', 'ok1'), nueva()));
  });

  test('el delegado NO puede publicar para una tienda NO autorizada', async () => {
    await assertFails(
      setDoc(doc(as(DELEGADO), 'noticiasTienda', 'mal1'), nueva({ stores: ['Barcelona'] }))
    );
  });

  test('el delegado NO puede colar una tienda ajena entre las suyas', async () => {
    await assertFails(
      setDoc(doc(as(DELEGADO), 'noticiasTienda', 'mal2'), nueva({ stores: ['Centro', 'Barcelona'] }))
    );
  });

  test('el delegado NO puede publicar sin tiendas destino (no hay noticias "a todos")', async () => {
    await assertFails(
      setDoc(doc(as(DELEGADO), 'noticiasTienda', 'mal3'), nueva({ stores: [] }))
    );
  });

  test('el delegado NO puede firmar la noticia como OTRO autor', async () => {
    await assertFails(
      setDoc(doc(as(DELEGADO), 'noticiasTienda', 'mal4'), nueva({ authorUid: BASE }))
    );
  });

  test('un usuario normal NO puede publicar noticias de tienda', async () => {
    await assertFails(setDoc(doc(as(BASE), 'noticiasTienda', 'mal5'), nueva({ authorUid: BASE })));
  });

  test('el autor SÍ puede leer y borrar su propia noticia (aunque su perfil sea de otra tienda)', async () => {
    await assertSucceeds(getDoc(doc(as(DELEGADO), 'noticiasTienda', 'nt1')));
    await assertSucceeds(deleteDoc(doc(as(DELEGADO), 'noticiasTienda', 'nt1')));
  });

  test('otro usuario NO puede borrar la noticia del delegado', async () => {
    await assertFails(deleteDoc(doc(as(BASE), 'noticiasTienda', 'nt1')));
  });

  test('el admin SÍ puede borrar cualquier noticia de tienda', async () => {
    await assertSucceeds(deleteDoc(doc(as('admin1', { admin: true }), 'noticiasTienda', 'nt1')));
  });
});

describe('Colección delegados', () => {
  test('el delegado SÍ puede leer su propio doc (para ver su pestaña y tiendas)', async () => {
    await assertSucceeds(getDoc(doc(as(DELEGADO), 'delegados', DELEGADO)));
  });

  test('un usuario normal NO puede leer el doc de un delegado', async () => {
    await assertFails(getDoc(doc(as(BASE), 'delegados', DELEGADO)));
  });

  test('nadie puede autonombrarse delegado desde el cliente', async () => {
    await assertFails(
      setDoc(doc(as(BASE), 'delegados', BASE), { stores: ['Centro'], active: true })
    );
  });

  test('el admin SÍ puede nombrar delegados', async () => {
    await assertSucceeds(
      setDoc(doc(as('admin1', { admin: true }), 'delegados', BASE2), { stores: ['Centro'], active: true })
    );
  });
});

describe('Censo de afiliación (censos/{uid})', () => {
  test('el delegado SÍ puede escribir su propio censo (con los campos previstos)', async () => {
    await assertSucceeds(
      setDoc(doc(as(DELEGADO), 'censos', DELEGADO), {
        prospects: { Centro: [{ name: 'Futuro Uno', phone: '600000000' }] },
        updatedAt: 1,
      })
    );
  });

  test('el delegado SÍ puede leer su propio censo', async () => {
    await assertSucceeds(getDoc(doc(as(DELEGADO), 'censos', DELEGADO)));
  });

  test('NO se puede escribir el censo con campos extra (forma controlada)', async () => {
    await assertFails(
      setDoc(doc(as(DELEGADO), 'censos', DELEGADO), {
        prospects: {},
        updatedAt: 1,
        hacked: true,
      })
    );
  });

  test('un usuario NO puede leer el censo de otro', async () => {
    await assertFails(getDoc(doc(as(BASE), 'censos', DELEGADO)));
  });

  test('un usuario NO puede escribir el censo de otro', async () => {
    await assertFails(
      setDoc(doc(as(BASE), 'censos', DELEGADO), { prospects: {}, updatedAt: 2 })
    );
  });

  test('el admin SÍ puede leer cualquier censo (soporte)', async () => {
    await assertSucceeds(getDoc(doc(as('admin1', { admin: true }), 'censos', DELEGADO)));
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
