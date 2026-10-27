// Test UNITARIO: el catálogo de tiendas del servidor es el MISMO que el del cliente.
//
// functions/ es CommonJS y no puede importar el ESM de src/, así que
// functions/lib/validStores.js copia a mano las listas de src/constants/stores.js.
// Si alguien añade una tienda solo en el cliente, el desplegable la ofrece pero
// cambiarMiTienda la rechaza ("Tienda no válida") y esa persona no puede elegirla
// nunca (auditoría 25-oct-2026, H-19). Este test lo para antes de publicar.
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STORES, ECI_STORES, S_ROMERO_STORES, SUPERCOR_EXPRESS_STORES } from '../../src/constants/stores.js';
import { COMPANY_RULES } from '../../src/constants/config.js';

const require_ = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const servidor = require_(join(ROOT, 'functions', 'lib', 'validStores.js'));

const ordenado = (lista) => [...lista].sort((a, b) => a.localeCompare(b, 'es'));

describe('catálogo de tiendas: servidor = cliente', () => {
  test('las mismas tiendas, sin que falte ni sobre ninguna', () => {
    expect(ordenado(servidor.VALID_STORES)).toEqual(ordenado(STORES.map((s) => s.name)));
  });

  test('las mismas tiendas de S. Romero', () => {
    expect(ordenado(servidor.S_ROMERO_STORES ?? [])).toEqual(ordenado(S_ROMERO_STORES));
  });

  test('las mismas de El Corte Inglés', () => {
    expect(ordenado(servidor.VALID_STORES.filter((s) => s.startsWith('El Corte Inglés'))))
      .toEqual(ordenado(ECI_STORES));
  });

  test('las mismas de Supercor Exprés', () => {
    expect(ordenado(servidor.SUPERCOR_EXPRESS_STORES ?? [])).toEqual(ordenado(SUPERCOR_EXPRESS_STORES));
  });

  test('las mismas empresas de ANGED (las que tienen convenio)', () => {
    expect(ordenado(servidor.ANGED_COMPANIES)).toEqual(ordenado(Object.keys(COMPANY_RULES)));
  });

  test('cada tienda del cliente pertenece a la empresa que dice el servidor', () => {
    const empresaDe = (nombre) =>
      S_ROMERO_STORES.includes(nombre) ? 'S. Romero'
        : ECI_STORES.includes(nombre) ? 'ECI'
          : SUPERCOR_EXPRESS_STORES.includes(nombre) ? 'S. Express'
            : 'Supercor';
    for (const { name } of STORES) {
      expect(servidor.storeBelongsToCompany(name, empresaDe(name)), name).toBe(true);
    }
  });
});
