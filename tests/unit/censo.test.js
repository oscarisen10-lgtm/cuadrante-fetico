// Test UNITARIO del consentimiento del sindicato en el censo (src/utils/censo.js).
// Auditoría 25-oct-2026 (H-03): el sindicato es un dato de categoría especial (RGPD
// art. 9) y solo se guarda con el consentimiento expreso de la persona, registrado
// con fecha y con quién lo apuntó.
import { describe, test, expect } from 'vitest';
import {
  SIN_SINDICATO, tieneSindicato, sindicatoPendiente, crearFuturo,
  confirmarConsentimiento, quitarSindicato, contarPendientes,
} from '../../src/utils/censo.js';

const AHORA = 1793000000000;

describe('crearFuturo', () => {
  test('sin sindicato no guarda ningún campo de sindicato', () => {
    const { entrada, error } = crearFuturo({ name: '  Ana Pérez ', section: 'Sala', sindicato: SIN_SINDICATO, uid: 'd1' });
    expect(error).toBeUndefined();
    expect(entrada).toEqual({ name: 'Ana Pérez', section: 'Sala' });
  });

  test('con sindicato y SIN consentimiento, no crea nada', () => {
    const { entrada, error } = crearFuturo({ name: 'Ana', section: 'Sala', sindicato: 'UGT', consentido: false, uid: 'd1' });
    expect(entrada).toBeUndefined();
    expect(error).toMatch(/consentimiento/i);
  });

  test('con sindicato y consentimiento, guarda cuándo y quién lo registró', () => {
    const { entrada } = crearFuturo({ name: 'Ana', section: 'Sala', sindicato: 'Fetico', consentido: true, uid: 'd1', ahora: AHORA });
    expect(entrada).toEqual({
      name: 'Ana', section: 'Sala', sindicato: 'Fetico',
      sindicatoConsentidoAt: AHORA, sindicatoConsentidoPor: 'd1',
    });
  });

  test('sin nombre no crea nada', () => {
    expect(crearFuturo({ name: '   ', sindicato: SIN_SINDICATO }).error).toMatch(/nombre/i);
  });
});

describe('entradas antiguas (apuntadas antes de pedir el consentimiento)', () => {
  const antigua = { name: 'Luis', section: 'Sala', sindicato: 'CCOO' };

  test('se detectan como pendientes', () => {
    expect(tieneSindicato(antigua)).toBe(true);
    expect(sindicatoPendiente(antigua)).toBe(true);
    expect(sindicatoPendiente({ name: 'X', sindicato: SIN_SINDICATO })).toBe(false);
    expect(sindicatoPendiente({ name: 'X' })).toBe(false);
  });

  test('confirmar registra el consentimiento y deja de estar pendiente', () => {
    const c = confirmarConsentimiento(antigua, 'd1', AHORA);
    expect(c).toMatchObject({ sindicato: 'CCOO', sindicatoConsentidoAt: AHORA, sindicatoConsentidoPor: 'd1' });
    expect(sindicatoPendiente(c)).toBe(false);
  });

  test('quitar borra el sindicato y su consentimiento, y conserva lo demás', () => {
    const q = quitarSindicato(confirmarConsentimiento(antigua, 'd1', AHORA));
    expect(q).toEqual({ name: 'Luis', section: 'Sala' });
  });

  test('se cuentan en todo el censo', () => {
    const censo = {
      PINEA: [antigua, { name: 'Eva', sindicato: SIN_SINDICATO }],
      ZIELO: [confirmarConsentimiento({ name: 'Leo', sindicato: 'UGT' }, 'd1', AHORA), { name: 'Pau', sindicato: 'Fasga' }],
    };
    expect(contarPendientes(censo)).toBe(2);
    expect(contarPendientes({})).toBe(0);
    expect(contarPendientes(null)).toBe(0);
  });
});
