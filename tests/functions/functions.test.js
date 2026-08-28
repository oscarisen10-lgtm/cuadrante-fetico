/**
 * Tests de la LÓGICA DE NEGOCIO de las Cloud Functions.
 *
 * Por qué existen (auditoría 22-ago-2026, F-17): hasta ahora lo único que cubría a
 * las functions era `functionsExports.test.js`, que comprueba que los 14 nombres
 * sigan exportados — no lo que HACEN. Las reglas de Firestore prueban el documento
 * resultante, pero no la función que lo escribe. Resultado: toda la lógica de
 * autorización de delegados (quién puede gestionar a quién, qué degrada una cuenta
 * a pendiente, el cortafuegos anti-spam de los push) no la paraba ni el lint, ni el
 * build, ni ningún test. Un refactor podía romperla y nadie se enteraba hasta
 * producción.
 *
 * Cómo funcionan: las funciones v2 exponen `.run(request)`, así que se invocan
 * directamente contra los emuladores de Firestore y Auth — sin desplegar nada y sin
 * `firebase-functions-test`.
 *
 * Se ejecuta con:  npm run test:functions   (necesita Java 21, como los de reglas)
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, beforeEach, afterAll, describe, test, expect } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// El Admin SDK decide a qué apunta al INICIALIZARSE, así que estas variables tienen
// que estar puestas antes de cargar functions/index.js (que llama a initializeApp).
process.env.GCLOUD_PROJECT = 'demo-cuadrante';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const require_ = createRequire(import.meta.url);
const fns = require_(join(ROOT, 'functions', 'index.js'));
const admin = require_(join(ROOT, 'functions', 'node_modules', 'firebase-admin'));

const db = admin.firestore();
const auth = admin.auth();

// --- Personajes ---
const ADMIN_UID = 'admin1';
const DELEGADO_UID = 'delegado1';
const USER_CENTRO = 'userCentro';   // en una tienda del delegado
const USER_BARNA = 'userBarna';     // en una tienda que el delegado NO gestiona
const FUERA_UID = 'userFuera';      // empresa no verificada

// Tiendas REALES del catálogo (lib/validStores.js las valida).
const TIENDA_A = 'PINEA';
const TIENDA_B = 'MIRASIERRA';

/** request de una callable: quien llama + los datos. */
const req = (uid, data = {}, claims = {}) => ({
  auth: { uid, token: { ...claims } },
  data,
});

/** Borra una colección entera del emulador (no hay clearFirestore aquí). */
const limpiar = async (col) => {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
};

beforeAll(async () => {
  // Cuenta de Auth del admin: isProtectedAdminAccount la busca por email para
  // impedir que un delegado toque esa cuenta.
  await auth.createUser({ uid: ADMIN_UID, email: 'oscarisen10@gmail.com' }).catch(() => {});
});

beforeEach(async () => {
  await Promise.all([limpiar('users'), limpiar('delegados'), limpiar('noticiasTienda')]);

  await db.collection('delegados').doc(DELEGADO_UID).set({
    stores: [TIENDA_A], active: true, email: 'delegado@test.com', fullName: 'Delegada',
  });
  await db.collection('users').doc(USER_CENTRO).set({
    profile: { fullName: 'Usuario Centro', store: TIENDA_A },
    membership: { active: false, createdAt: 1 },
  });
  await db.collection('users').doc(USER_BARNA).set({
    profile: { fullName: 'Usuario Barna', store: TIENDA_B },
    membership: { active: false, createdAt: 1 },
  });
  await db.collection('users').doc(FUERA_UID).set({
    profile: { fullName: 'De Fuera', store: '', companyVerified: false },
    membership: { active: true, createdAt: 1 },
  });
  // El admin vive en OTRA tienda a propósito: si estuviera en la del delegado,
  // contaría como un usuario más en cada recuento y lista, y los tests de censo
  // pasarían (o fallarían) por un motivo que no es el que quieren comprobar.
  // El test que sí necesita al admin dentro de su tienda se lo mueve él mismo.
  await db.collection('users').doc(ADMIN_UID).set({
    profile: { fullName: 'Admin', store: TIENDA_B },
  });
});

afterAll(async () => {
  await admin.app().delete().catch(() => {});
});

const perfil = async (uid) => (await db.collection('users').doc(uid).get()).data();

// ───────────────────────────────────────────────────────────────────────────────
describe('cambiarMiTienda', () => {
  test('a un usuario normal le cambia la tienda y le DEVUELVE la cuenta a pendiente', async () => {
    await db.collection('users').doc(USER_CENTRO).set(
      { membership: { active: true } }, { merge: true }
    );

    const res = await fns.cambiarMiTienda.run(req(USER_CENTRO, { store: TIENDA_B }));

    expect(res.pendiente).toBe(true);
    const d = await perfil(USER_CENTRO);
    expect(d.profile.store).toBe(TIENDA_B);
    expect(d.membership.active).toBe(false);
    expect(d.membership.reason).toBe('cambio-de-tienda');
  });

  // Si al delegado le degradaran la cuenta al corregir su propia tienda, se
  // bloquearía a sí mismo la pestaña desde la que gestiona a los demás.
  test('un DELEGADO no se degrada al cambiar de tienda', async () => {
    await db.collection('users').doc(DELEGADO_UID).set({
      profile: { fullName: 'Delegada', store: TIENDA_A },
      membership: { active: true },
    });

    const res = await fns.cambiarMiTienda.run(req(DELEGADO_UID, { store: TIENDA_B }));

    expect(res.pendiente).toBe(false);
    expect((await perfil(DELEGADO_UID)).membership.active).toBe(true);
  });

  test('el ADMIN tampoco se degrada', async () => {
    const res = await fns.cambiarMiTienda.run(req(ADMIN_UID, { store: TIENDA_B }, { admin: true }));
    expect(res.pendiente).toBe(false);
  });

  // Estas cuentas nacen ACTIVAS sin que ningún delegado las verifique, a cambio de
  // quedarse sin tienda. Dejarles ponerse una sería saltarse al delegado.
  test('una cuenta de fuera de ANGED NO puede asignarse tienda', async () => {
    await expect(
      fns.cambiarMiTienda.run(req(FUERA_UID, { store: TIENDA_A }))
    ).rejects.toThrow(/permission-denied|fuera de ANGED/i);
  });

  // F-04: antes solo se validaba la longitud y el desplegable del cliente era la
  // única barrera; una tienda inventada dejaba al usuario invisible para todo delegado.
  test('rechaza una tienda que no existe en el catálogo', async () => {
    await expect(
      fns.cambiarMiTienda.run(req(USER_CENTRO, { store: 'TIENDA-INVENTADA' }))
    ).rejects.toThrow(/invalid-argument|no válida/i);
  });

  test('acepta "" (cambiar de empresa vacía la tienda)', async () => {
    const res = await fns.cambiarMiTienda.run(req(USER_CENTRO, { store: '' }));
    expect(res.success).toBe(true);
  });

  // Reelegir la misma tienda en Ajustes no debe mandar la cuenta a pendiente.
  test('sin cambio real NO toca membership', async () => {
    await db.collection('users').doc(USER_CENTRO).set({ membership: { active: true } }, { merge: true });
    const res = await fns.cambiarMiTienda.run(req(USER_CENTRO, { store: TIENDA_A }));
    expect(res.pendiente).toBe(false);
    expect((await perfil(USER_CENTRO)).membership.active).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
describe('delegadoSetActive', () => {
  test('un delegado SÍ puede activar a un usuario de su tienda', async () => {
    const res = await fns.delegadoSetActive.run(req(DELEGADO_UID, { uid: USER_CENTRO, active: true }));
    expect(res.success).toBe(true);
    expect((await perfil(USER_CENTRO)).membership.active).toBe(true);
  });

  test('un delegado NO puede tocar a un usuario de OTRA tienda', async () => {
    await expect(
      fns.delegadoSetActive.run(req(DELEGADO_UID, { uid: USER_BARNA, active: true }))
    ).rejects.toThrow(/permission-denied|tiendas autorizadas/i);
    expect((await perfil(USER_BARNA)).membership.active).toBe(false);
  });

  // La cuenta del admin es intocable para un delegado, INCLUSO estando en su tienda
  // (que es el único caso en que el delegado llega siquiera a esa comprobación: si
  // no fuera de sus tiendas, cortaría antes por otro motivo y el test no probaría
  // la protección del admin, que es lo que interesa).
  test('un delegado NO puede desactivar la cuenta del ADMIN de su propia tienda', async () => {
    await db.collection('users').doc(ADMIN_UID).set(
      { profile: { fullName: 'Admin', store: TIENDA_A } }, { merge: true }
    );
    await expect(
      fns.delegadoSetActive.run(req(DELEGADO_UID, { uid: ADMIN_UID, active: false }))
    ).rejects.toThrow(/No puedes modificar esa cuenta/i);
  });

  test('un usuario normal (no delegado) no puede activar a nadie', async () => {
    await expect(
      fns.delegadoSetActive.run(req(USER_BARNA, { uid: USER_CENTRO, active: true }))
    ).rejects.toThrow(/no pertenece a tus tiendas autorizadas/i);
  });

  test('rechaza parámetros no válidos', async () => {
    await expect(
      fns.delegadoSetActive.run(req(DELEGADO_UID, { uid: USER_CENTRO, active: 'si' }))
    ).rejects.toThrow(/invalid-argument|no válidos/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
describe('delegadoExpelUser', () => {
  // Expulsar = "se fue de la empresa": desaparece de las listas del delegado, pero
  // su cuenta sigue ACTIVA por si quiere seguir usando la app. No es un bloqueo.
  test('expulsar deja la cuenta ACTIVA y marcada como expulsada', async () => {
    await fns.delegadoExpelUser.run(req(DELEGADO_UID, { uid: USER_CENTRO, expelled: true }));
    const d = await perfil(USER_CENTRO);
    expect(d.membership.expelled).toBe(true);
    expect(d.membership.active).toBe(true);
    expect(typeof d.membership.expelledAt).toBe('number');
  });

  test('readmitir limpia la marca y la fecha', async () => {
    await fns.delegadoExpelUser.run(req(DELEGADO_UID, { uid: USER_CENTRO, expelled: true }));
    await fns.delegadoExpelUser.run(req(DELEGADO_UID, { uid: USER_CENTRO, expelled: false }));
    const d = await perfil(USER_CENTRO);
    expect(d.membership.expelled).toBe(false);
    expect(d.membership.expelledAt).toBeNull();
  });

  test('un delegado NO puede expulsar a alguien de otra tienda', async () => {
    await expect(
      fns.delegadoExpelUser.run(req(DELEGADO_UID, { uid: USER_BARNA, expelled: true }))
    ).rejects.toThrow(/no pertenece a tus tiendas autorizadas/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
describe('delegadoCensusCounts', () => {
  test('cuenta usuarios y activos de las tiendas autorizadas', async () => {
    await db.collection('users').doc('otroCentro').set({
      profile: { fullName: 'Otro', store: TIENDA_A },
      membership: { active: true },
    });

    const { counts } = await fns.delegadoCensusCounts.run(req(DELEGADO_UID));

    // USER_CENTRO (pendiente) + otroCentro (activo) = 2 usuarios, 1 activo.
    expect(counts[TIENDA_A].users).toBe(2);
    expect(counts[TIENDA_A].activos).toBe(1);
    // Solo devuelve SUS tiendas.
    expect(counts[TIENDA_B]).toBeUndefined();
  });

  test('los EXPULSADOS no cuentan para el delegado', async () => {
    await db.collection('users').doc('expulsado').set({
      profile: { fullName: 'Se fue', store: TIENDA_A },
      membership: { active: true, expelled: true },
    });
    const { counts } = await fns.delegadoCensusCounts.run(req(DELEGADO_UID));
    expect(counts[TIENDA_A].users).toBe(1); // solo USER_CENTRO
  });

  test('quien no es delegado no obtiene recuentos', async () => {
    await expect(
      fns.delegadoCensusCounts.run(req(USER_CENTRO))
    ).rejects.toThrow(/No tienes tiendas autorizadas/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
describe('delegadoListUsers', () => {
  test('lista los usuarios de su tienda con el estado de activación', async () => {
    const { users } = await fns.delegadoListUsers.run(req(DELEGADO_UID, { store: TIENDA_A }));
    expect(users).toHaveLength(1);
    expect(users[0].uid).toBe(USER_CENTRO);
    expect(users[0].active).toBe(false);
  });

  test('no puede listar una tienda que no tiene autorizada', async () => {
    await expect(
      fns.delegadoListUsers.run(req(DELEGADO_UID, { store: TIENDA_B }))
    ).rejects.toThrow(/permission-denied|autorizada/i);
  });

  // Los expulsados desaparecen para el delegado, pero el admin sí los ve.
  test('el delegado no ve a los expulsados; el admin sí', async () => {
    await fns.delegadoExpelUser.run(req(DELEGADO_UID, { uid: USER_CENTRO, expelled: true }));

    const delegadoVe = await fns.delegadoListUsers.run(req(DELEGADO_UID, { store: TIENDA_A }));
    expect(delegadoVe.users).toHaveLength(0);

    const adminVe = await fns.delegadoListUsers.run(req(ADMIN_UID, { store: TIENDA_A }, { admin: true }));
    expect(adminVe.users.map((u) => u.uid)).toContain(USER_CENTRO);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
describe('adminSetDelegado', () => {
  test('solo el admin puede nombrar delegados', async () => {
    await expect(
      fns.adminSetDelegado.run(req(USER_CENTRO, { email: 'x@y.com', stores: [TIENDA_A] }))
    ).rejects.toThrow(/Solo el administrador/i);
  });

  // F-04 otra vez: aquí la tienda tiene que ser real de verdad ("" no vale).
  test('rechaza tiendas que no existen', async () => {
    await auth.createUser({ uid: 'nuevoDel', email: 'nuevo@delegado.com' }).catch(() => {});
    await expect(
      fns.adminSetDelegado.run(req(ADMIN_UID, { email: 'nuevo@delegado.com', stores: ['NO-EXISTE'] }, { admin: true }))
    ).rejects.toThrow(/invalid-argument|válida/i);
  });

  test('nombrar delegado deja SU cuenta activada', async () => {
    await auth.createUser({ uid: 'nuevoDel2', email: 'nuevo2@delegado.com' }).catch(() => {});
    await db.collection('users').doc('nuevoDel2').set({
      profile: { fullName: 'Nuevo Delegado', store: TIENDA_A },
      membership: { active: false },
    });

    const res = await fns.adminSetDelegado.run(
      req(ADMIN_UID, { email: 'nuevo2@delegado.com', stores: [TIENDA_A] }, { admin: true })
    );

    expect(res.success).toBe(true);
    expect((await perfil('nuevoDel2')).membership.active).toBe(true);
    expect((await db.collection('delegados').doc('nuevoDel2').get()).data().stores).toEqual([TIENDA_A]);
  });

  // Retirar borra el doc de delegados pero NO toca la cuenta del usuario.
  test('retirar a un delegado no le desactiva la cuenta', async () => {
    await db.collection('users').doc(DELEGADO_UID).set({ membership: { active: true } }, { merge: true });
    await auth.createUser({ uid: DELEGADO_UID, email: 'delegado@test.com' }).catch(() => {});

    await fns.adminSetDelegado.run(req(ADMIN_UID, { email: 'delegado@test.com', remove: true }, { admin: true }));

    expect((await db.collection('delegados').doc(DELEGADO_UID).get()).exists).toBe(false);
    expect((await perfil(DELEGADO_UID)).membership.active).toBe(true);
  });

  // Si el delegado borró su cuenta y se hizo otra, su doc quedó bajo el uid VIEJO:
  // buscarlo por el uid actual no lo encontraba y "retirar" decía que sí sin borrar
  // nada, mientras el admin lo seguía viendo en su lista.
  test('retirar borra también el doc huérfano de una cuenta recreada', async () => {
    const email = 'recreado@delegado.com';
    await db.collection('delegados').doc('uidViejo').set({
      email, fullName: 'Recreado', stores: [TIENDA_A], active: true,
    });
    await auth.createUser({ uid: 'uidNuevo', email }).catch(() => {});

    await fns.adminSetDelegado.run(req(ADMIN_UID, { email, remove: true }, { admin: true }));

    expect((await db.collection('delegados').doc('uidViejo').get()).exists).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Cortafuegos anti-spam: una cuenta de delegado comprometida podría crear noticias
// con sendPush en bucle y bombardear a toda su plantilla. maxInstances acota la
// concurrencia, no la cadencia — esto es lo único que corta la ráfaga.
describe('sendStoreNews (cooldown de push)', () => {
  const evento = (data, id = 'n1') => ({
    data: { data: () => data },
    params: { docId: id },
  });

  const noticia = (extra = {}) => ({
    title: 'Aviso', desc: 'Texto', stores: [TIENDA_A],
    authorUid: DELEGADO_UID, sendPush: true, createdAt: Date.now(), ...extra,
  });

  test('el primer push sella lastPushAt en el delegado', async () => {
    await fns.sendStoreNews.run(evento(noticia()));
    const d = (await db.collection('delegados').doc(DELEGADO_UID).get()).data();
    expect(typeof d.lastPushAt).toBe('number');
  });

  test('un segundo push inmediato NO re-sella (queda descartado por el enfriamiento)', async () => {
    await fns.sendStoreNews.run(evento(noticia()));
    const primero = (await db.collection('delegados').doc(DELEGADO_UID).get()).data().lastPushAt;

    await fns.sendStoreNews.run(evento(noticia(), 'n2'));
    const segundo = (await db.collection('delegados').doc(DELEGADO_UID).get()).data().lastPushAt;

    expect(segundo).toBe(primero);
  });

  // Defensa en profundidad: las reglas ya lo impiden al crear el doc, pero si un
  // delegado es retirado DESPUÉS de crearla, el envío tampoco debe salir.
  test('no envía si el autor ya no es delegado autorizado', async () => {
    await db.collection('delegados').doc(DELEGADO_UID).delete();
    await fns.sendStoreNews.run(evento(noticia()));
    expect((await db.collection('delegados').doc(DELEGADO_UID).get()).exists).toBe(false);
  });

  test('no envía a tiendas que el delegado no tiene autorizadas', async () => {
    await fns.sendStoreNews.run(evento(noticia({ stores: [TIENDA_B] })));
    const d = (await db.collection('delegados').doc(DELEGADO_UID).get()).data();
    expect(d.lastPushAt).toBeUndefined();
  });

  test('una noticia sin sendPush no toca el enfriamiento', async () => {
    await fns.sendStoreNews.run(evento(noticia({ sendPush: false })));
    const d = (await db.collection('delegados').doc(DELEGADO_UID).get()).data();
    expect(d.lastPushAt).toBeUndefined();
  });
});
