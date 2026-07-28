import { describe, it, expect, vi } from 'vitest';
import {
  toast,
  confirm,
  registerToastHandler,
  registerConfirmHandler,
  resolvePendingConfirm,
} from '../../src/services/toastBus.js';

/**
 * El bus se extrajo de components/Toast.jsx (que exportaba componentes Y funciones,
 * rompiendo el Fast Refresh). Estos tests fijan el contrato entre las dos piezas:
 * si alguien cambia el bus, los avisos y las confirmaciones de toda la app dependen
 * de él y no hay forma de verlo en el navegador sin iniciar sesión.
 */
describe('toastBus — avisos', () => {
  it('no revienta si no hay contenedor montado (se descarta en silencio)', () => {
    expect(() => toast('sin contenedor')).not.toThrow();
  });

  it('entrega mensaje y tipo al contenedor registrado', () => {
    const handler = vi.fn();
    const unregister = registerToastHandler(handler);

    toast('guardado', 'success');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ message: 'guardado', type: 'success' });
    unregister();
  });

  it('usa "info" como tipo por defecto', () => {
    const handler = vi.fn();
    const unregister = registerToastHandler(handler);

    toast('mensaje suelto');

    expect(handler.mock.calls[0][0].type).toBe('info');
    unregister();
  });

  it('asigna ids distintos a cada aviso (React los usa como key)', () => {
    const handler = vi.fn();
    const unregister = registerToastHandler(handler);

    toast('uno');
    toast('dos');

    const [primero, segundo] = handler.mock.calls.map((c) => c[0].id);
    expect(segundo).not.toBe(primero);
    unregister();
  });

  it('deja de entregar tras la limpieza (desmontaje del contenedor)', () => {
    const handler = vi.fn();
    registerToastHandler(handler)();

    toast('a nadie');

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('toastBus — confirmaciones', () => {
  it('muestra el mensaje y resuelve con la respuesta del usuario', async () => {
    const handler = vi.fn();
    const unregister = registerConfirmHandler(handler);

    const respuesta = confirm('¿Borrar la noticia?');
    expect(handler).toHaveBeenCalledWith('¿Borrar la noticia?');

    resolvePendingConfirm(true);
    await expect(respuesta).resolves.toBe(true);
    unregister();
  });

  it('resuelve a false cuando se cancela', async () => {
    const unregister = registerConfirmHandler(vi.fn());

    const respuesta = confirm('¿Seguro?');
    resolvePendingConfirm(false);

    await expect(respuesta).resolves.toBe(false);
    unregister();
  });

  it('no deja resolver dos veces la misma confirmación', async () => {
    const unregister = registerConfirmHandler(vi.fn());

    const respuesta = confirm('¿Seguro?');
    resolvePendingConfirm(true);
    // Una segunda llamada (p.ej. doble clic) no debe afectar ni lanzar.
    expect(() => resolvePendingConfirm(false)).not.toThrow();

    await expect(respuesta).resolves.toBe(true);
    unregister();
  });
});
