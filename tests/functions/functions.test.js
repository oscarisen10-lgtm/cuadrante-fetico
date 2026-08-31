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
  // quedarse sin tienda. Pedir tienda "a secas", sin declarar una empresa de ANGED,
  // NO se la da: si no, sería el atajo para saltarse al delegado.
  test('una cuenta de fuera de ANGED no se lleva tienda si no declara empresa', async () => {
    const res = await fns.cambiarMiTienda.run(req(FUERA_UID, { store: TIENDA_A }));

    expect(res.store).toBe('');
    const d = await perfil(FUERA_UID);
    expect(d.profile.store).toBe('');
    expect(d.profile.companyVerified).toBe(false);
  });

  // El camino de vuelta (28-ago-2026). Antes esto se rechazaba en seco y quien se
  // registraba en "Otra empresa" se quedaba encerrado ahí para siempre.
  test('de fuera de ANGED a una empresa de ANGED: entra, pero PENDIENTE de verificar', async () => {
    const res = await fns.cambiarMiTienda.run(
      req(FUERA_UID, { company: 'S. Romero', store: TIENDA_A, rank: 'Jefes' })
    );

    expect(res.pendiente).toBe(true);
    const d = await perfil(FUERA_UID);
    expect(d.profile.store).toBe(TIENDA_A);
    expect(d.profile.company).toBe('S. Romero');
    expect(d.profile.companyVerified).toBe(true);
    // Lo que impide que sea un atajo: la cuenta estaba ACTIVA y vuelve a pendiente.
    expect(d.membership.active).toBe(false);
    expect(d.membership.reason).toBe('alta-en-anged');
  });

  // Paso intermedio del formulario: se elige empresa y la tienda queda por elegir.
  // No debe degradar la cuenta: sin tienda, ningún delegado la vería en su censo
  // para poder activarla, y se quedaría atascada en pendiente para siempre.
  test('elegir empresa de ANGED sin tienda todavía NO manda la cuenta a pendiente', async () => {
    const res = await fns.cambiarMiTienda.run(
      req(FUERA_UID, { company: 'Supercor', store: '' })
    );

    expect(res.pendiente).toBe(false);
    expect((await perfil(FUERA_UID)).membership.active).toBe(true);
  });

  // La ida. Vaciar la tienda es lo importante: si se quedara puesta, seguiría
  // leyendo las noticias de su antiguo delegado y contando en su censo.
  test('de ANGED a "Otra empresa": vacía tienda y rango, y la cuenta SIGUE activa', async () => {
    await db.collection('users').doc(USER_CENTRO).set({
      profile: { fullName: 'Usuario Centro', store: TIENDA_A, company: 'Supercor', rank: 'Jefes' },
      membership: { active: true },
    });

    const res = await fns.cambiarMiTienda.run(
      req(USER_CENTRO, { company: 'Otra empresa', store: '' })
    );

    expect(res.pendiente).toBe(false);
    const d = await perfil(USER_CENTRO);
    expect(d.profile.store).toBe('');
    expect(d.profile.rank).toBe('');
    expect(d.profile.companyVerified).toBe(false);
    // Fuera de ANGED no hay delegado que pudiera reactivarla: degradarla sería
    // encerrarla para siempre.
    expect(d.membership.active).toBe(true);
  });

  // Un delegado que se fuera conservaría su doc `delegados/{uid}` con sus tiendas:
  // seguiría gestionando el censo de una empresa en la que ya no dice trabajar.
  test('un DELEGADO no puede pasarse a una empresa de fuera de ANGED', async () => {
    await db.collection('users').doc(DELEGADO_UID).set({
      profile: { fullName: 'Delegada', store: TIENDA_A, company: 'Supercor' },
      membership: { active: true },
    });

    await expect(
      fns.cambiarMiTienda.run(req(DELEGADO_UID, { company: 'Otra empresa', store: '' }))
    ).rejects.toThrow(/failed-precondition|retirarte/i);
  });

  // Con Supercor y Exprés separados (28-ago-2026), una llamada directa podía declarar
  // una empresa y una tienda que no se corresponden, y colarse en el censo de un
  // delegado que no es el suyo. El desplegable nunca ofrecería esa combinación.
  test('rechaza una tienda que no es de la empresa declarada', async () => {
    await expect(
      // PINEA es de S. Romero, no de ECI.
      fns.cambiarMiTienda.run(req(USER_CENTRO, { company: 'ECI', store: TIENDA_A }))
    ).rejects.toThrow(/invalid-argument|no es de esa empresa/i);
  });

  // Hasta el 28-ago-2026 el desplegable ofrecía TODAS las tiendas a quien elegía
  // "Supercor", así que hay usuarios registrados como Supercor en centros que ahora
  // son Exprés. Validar contra su empresa GUARDADA les dejaría sin poder cambiarse
  // de tienda nunca más: la comprobación solo mira la empresa de la propia llamada.
  test('no bloquea a quien ya tiene una empresa y una tienda que no casan', async () => {
    await db.collection('users').doc(USER_CENTRO).set({
      // BARQUILLO es de Exprés; su perfil dice Supercor. Combinación heredada real.
      profile: { fullName: 'Usuario Centro', store: 'BARQUILLO', company: 'Supercor' },
      membership: { active: true },
    });

    const res = await fns.cambiarMiTienda.run(req(USER_CENTRO, { store: 'ODONNEL' }));

    expect(res.success).toBe(true);
    expect((await perfil(USER_CENTRO)).profile.store).toBe('ODONNEL');
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
// Limpieza de tokens muertos. Es la única señal de "app desinstalada" que existe:
// nadie la notifica, solo se descubre al INTENTAR enviar. Lo delicado es no pasarse
// borrando — un fallo de red no es un token muerto.
describe('purgeDeadTokens', () => {
  const push = require_(join(ROOT, 'functions', 'lib', 'push.js'));

  test('retira solo el token muerto y deja vivos los demás del mismo usuario', async () => {
    await db.collection('users').doc(USER_CENTRO).set({
      profile: { fullName: 'Usuario Centro', store: TIENDA_A, fcmTokens: ['tok-vivo', 'tok-muerto'] },
    });

    await push.purgeDeadTokens(['tok-muerto']);

    const p = (await perfil(USER_CENTRO)).profile;
    expect(p.fcmTokens).toEqual(['tok-vivo']);
    // Le queda un dispositivo: NO es una baja.
    expect(p.pushMuerto).toBeUndefined();
  });

  test('sin ningún dispositivo vivo, marca pushMuerto', async () => {
    await db.collection('users').doc(USER_CENTRO).set({
      profile: { fullName: 'Usuario Centro', store: TIENDA_A, fcmTokens: ['tok-muerto'] },
    });

    await push.purgeDeadTokens(['tok-muerto']);

    const p = (await perfil(USER_CENTRO)).profile;
    expect(p.fcmTokens).toEqual([]);
    expect(p.pushMuerto).toBe(true);
    expect(typeof p.pushMuertoAt).toBe('number');
  });

  // Las apps anteriores al 28-ago-2026 guardan el token como string en `fcmToken`.
  test('también limpia el campo antiguo fcmToken (string)', async () => {
    await db.collection('users').doc(USER_BARNA).set({
      profile: { fullName: 'Usuario Barna', store: TIENDA_B, fcmToken: 'tok-viejo-muerto' },
    });

    await push.purgeDeadTokens(['tok-viejo-muerto']);

    const p = (await perfil(USER_BARNA)).profile;
    expect(p.fcmToken).toBeUndefined();
    expect(p.pushMuerto).toBe(true);
  });

  test('un token que no es de nadie no rompe ni toca a otros', async () => {
    await db.collection('users').doc(USER_CENTRO).set({
      profile: { fullName: 'Usuario Centro', store: TIENDA_A, fcmTokens: ['tok-vivo'] },
    });

    await expect(push.purgeDeadTokens(['tok-fantasma'])).resolves.toBe(0);
    expect((await perfil(USER_CENTRO)).profile.fcmTokens).toEqual(['tok-vivo']);
  });

  // Sin esta distinción, una caída de FCM borraría los tokens de toda la plantilla.
  test('solo son "muertos" los códigos de token inexistente, no un fallo cualquiera', () => {
    expect(push.DEAD_TOKEN_CODES.has('messaging/registration-token-not-registered')).toBe(true);
    expect(push.DEAD_TOKEN_CODES.has('messaging/invalid-registration-token')).toBe(true);
    expect(push.DEAD_TOKEN_CODES.has('messaging/server-unavailable')).toBe(false);
    expect(push.DEAD_TOKEN_CODES.has('messaging/internal-error')).toBe(false);
    expect(push.DEAD_TOKEN_CODES.has('messaging/quota-exceeded')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// A QUIÉN se le mandan las noticias.
//
// Expulsar a alguien nunca tocó `profile.store`, y el envío de tienda se resuelve
// por ese campo: el expulsado seguía recibiendo los avisos del delegado de una
// tienda en la que ya no trabaja. Aparte, el admin puede cortarle las noticias a
// quien quiera (adminSetNoticias), y ese corte sí alcanza también a las globales.
describe('destinatarios de las noticias', () => {
  const push = require_(join(ROOT, 'functions', 'lib', 'push.js'));
  // El módulo recibe `db` como FUNCIÓN (lib/firebase la exporta así, perezosa).
  const dbFn = () => db;

  const conToken = (uid, store, token, membership) =>
    db.collection('users').doc(uid).set({
      profile: { fullName: uid, store, fcmTokens: [token] },
      ...(membership ? { membership } : {}),
    });

  test('las noticias de tienda llegan a quien está en esa tienda', async () => {
    await conToken(USER_CENTRO, TIENDA_A, 'tok-centro', { active: true });
    expect([...(await push.tokensForStores(dbFn, [TIENDA_A]))]).toEqual(['tok-centro']);
  });

  test('un EXPULSADO deja de recibir las noticias de su antigua tienda', async () => {
    await conToken(USER_CENTRO, TIENDA_A, 'tok-centro', { active: true, expelled: true });
    expect((await push.tokensForStores(dbFn, [TIENDA_A])).size).toBe(0);
  });

  // Su cuenta queda ACTIVA a propósito (ver delegadoExpelUser): sigue siendo de la
  // app, así que el canal "a toda la app" no se le corta por haberse ido de la tienda.
  test('pero un expulsado SÍ sigue recibiendo las noticias globales del admin', async () => {
    await conToken(USER_CENTRO, TIENDA_A, 'tok-centro', { active: true, expelled: true });
    expect([...(await push.tokensForBroadcast(dbFn))]).toContain('tok-centro');
  });

  // El campo ausente tiene que significar "sí recibe": ningún perfil anterior a
  // esto lo lleva, y un filtro mal planteado dejaría muda a toda la plantilla.
  test('un perfil SIN membership sigue recibiéndolas (cuentas antiguas)', async () => {
    await conToken(USER_CENTRO, TIENDA_A, 'tok-antiguo');
    expect([...(await push.tokensForStores(dbFn, [TIENDA_A]))]).toEqual(['tok-antiguo']);
    expect([...(await push.tokensForBroadcast(dbFn))]).toContain('tok-antiguo');
  });

  test('el corte del admin le quita las de tienda Y las globales', async () => {
    await conToken(USER_CENTRO, TIENDA_A, 'tok-centro', { active: true, noticias: false });
    expect((await push.tokensForStores(dbFn, [TIENDA_A])).size).toBe(0);
    expect([...(await push.tokensForBroadcast(dbFn))]).not.toContain('tok-centro');
  });

  // Decide si el broadcast va por topic (barato) o por token (para saltarse a
  // alguien). Si diera un falso negativo, el silenciado recibiría el aviso igual.
  test('haySilenciados solo es cierto cuando hay alguien cortado', async () => {
    await conToken(USER_CENTRO, TIENDA_A, 'tok-centro', { active: true });
    expect(await push.haySilenciados(dbFn)).toBe(false);

    await conToken(USER_CENTRO, TIENDA_A, 'tok-centro', { active: true, noticias: false });
    expect(await push.haySilenciados(dbFn)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
describe('adminSetNoticias', () => {
  // Si pudiera un delegado, le taparía a un usuario de su tienda las noticias que
  // el admin publica para toda la app.
  test('un delegado NO puede cortar las noticias a nadie', async () => {
    await expect(
      fns.adminSetNoticias.run(req(DELEGADO_UID, { uid: USER_CENTRO, noticias: false }))
    ).rejects.toThrow(/Solo el administrador/i);
  });

  test('corta y restaura sin tocar la activación de la cuenta', async () => {
    await db.collection('users').doc(USER_CENTRO).set({ membership: { active: true } }, { merge: true });

    await fns.adminSetNoticias.run(req(ADMIN_UID, { uid: USER_CENTRO, noticias: false }, { admin: true }));
    const cortado = (await perfil(USER_CENTRO)).membership;
    expect(cortado.noticias).toBe(false);
    expect(cortado.active).toBe(true);

    await fns.adminSetNoticias.run(req(ADMIN_UID, { uid: USER_CENTRO, noticias: true }, { admin: true }));
    expect((await perfil(USER_CENTRO)).membership.noticias).toBe(true);
  });

  // membership AUSENTE = cuenta activa por ausencia del campo (isUserActive e
  // isActiveMember() de las reglas). Crear el mapa con solo `noticias` la habría
  // dejado bloqueada de rebote, por haberle tocado las noticias.
  test('a una cuenta sin membership no le quita la activación', async () => {
    await db.collection('users').doc('antiguo').set({ profile: { fullName: 'Antiguo', store: TIENDA_A } });

    await fns.adminSetNoticias.run(req(ADMIN_UID, { uid: 'antiguo', noticias: false }, { admin: true }));

    const m = (await perfil('antiguo')).membership;
    expect(m.noticias).toBe(false);
    expect(m.active).toBe(true);
  });

  test('rechaza un usuario que no existe', async () => {
    await expect(
      fns.adminSetNoticias.run(req(ADMIN_UID, { uid: 'fantasma', noticias: false }, { admin: true }))
    ).rejects.toThrow(/no existe/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
describe('adminStats — abandono', () => {
  const hace = (dias) => Date.now() - dias * 24 * 60 * 60 * 1000;

  test('cuenta inactivos por ventana sin mezclar a quien no sella actividad', async () => {
    await limpiar('users');
    await db.collection('users').doc('u-activo').set({
      profile: { platform: 'ios', lastActiveAt: hace(2) },
    });
    await db.collection('users').doc('u-45dias').set({
      profile: { platform: 'android', lastActiveAt: hace(45) },
    });
    await db.collection('users').doc('u-90dias').set({
      profile: { platform: 'ios', lastActiveAt: hace(90), pushMuerto: true },
    });
    // App antigua: sin lastActiveAt. No es un inactivo, es un desconocido.
    await db.collection('users').doc('u-sin-sello').set({
      profile: { platform: 'android' },
    });

    const res = await fns.adminStats.run(req(ADMIN_UID, { refresh: true }, { admin: true }));

    expect(res.total).toBe(4);
    expect(res.activos7d).toBe(1);
    // Acumulativas: el de 90 días cuenta en las dos ventanas; el de 45, solo en la de 30.
    expect(res.inactivos[30].total).toBe(2);
    expect(res.inactivos[60].total).toBe(1);
    // Lo importante: el de la app antigua NO infla el abandono.
    expect(res.sinActividad).toBe(1);
    expect(res.pushMuerto).toBe(1);
    expect(res.pushMuertoIos).toBe(1);
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

  // Lo pinta la ficha (y el delegado lo ve sin botón): si no, creería que sus push
  // fallan con esta persona.
  test('dice si el admin le ha cortado las noticias', async () => {
    const antes = await fns.delegadoListUsers.run(req(DELEGADO_UID, { store: TIENDA_A }));
    expect(antes.users[0].noticias).toBe(true);

    await fns.adminSetNoticias.run(req(ADMIN_UID, { uid: USER_CENTRO, noticias: false }, { admin: true }));

    const despues = await fns.delegadoListUsers.run(req(DELEGADO_UID, { store: TIENDA_A }));
    expect(despues.users[0].noticias).toBe(false);
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
