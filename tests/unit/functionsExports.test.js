import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require_ = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS_DIR = join(ROOT, 'functions');

/**
 * Los nombres exportados por functions/index.js SON los nombres desplegados en
 * Firebase: renombrar uno equivale a borrar esa función y crear otra (perdiendo su
 * trigger o su URL). Este test congela la lista para que un refactor no lo haga sin
 * querer — que es justo el riesgo que se corrió al partir el index.js de ~1.070
 * líneas en módulos por dominio.
 */
const DEPLOYED_FUNCTIONS = [
  'adminOverview',
  'adminSetDelegado',
  'adminSetNoticias',
  'adminStats',
  'cambiarMiTienda',
  'cleanupOnAuthDelete',
  'delegadoCensusCounts',
  'delegadoExpelUser',
  'delegadoListUsers',
  'delegadoSetActive',
  'deleteMyAccount',
  'notifyDelegadoNewUser',
  'sendPushNotification',
  'sendStoreNews',
  'subscribeToNewsTopic',
];

describe('functions/index.js — superficie desplegada', () => {
  it('exporta exactamente las 15 funciones esperadas (comprobación estática)', () => {
    const src = readFileSync(join(FUNCTIONS_DIR, 'index.js'), 'utf8');
    const exported = [...src.matchAll(/^exports\.([A-Za-z0-9_]+)\s*=/gm)]
      .map((m) => m[1])
      .sort();
    expect(exported).toEqual([...DEPLOYED_FUNCTIONS].sort());
  });

  it('todos los módulos que index.js requiere existen', () => {
    const src = readFileSync(join(FUNCTIONS_DIR, 'index.js'), 'utf8');
    const requires = [...src.matchAll(/require\("(\.[^"]+)"\)/g)].map((m) => m[1]);
    expect(requires.length).toBeGreaterThan(0);
    for (const rel of requires) {
      expect(existsSync(join(FUNCTIONS_DIR, `${rel}.js`)), `falta ${rel}.js`).toBe(true);
    }
  });

  // Carga REAL del backend. Solo corre si functions/node_modules está instalado:
  // el CI (Codemagic) solo hace `npm install` en la raíz, así que allí se omite.
  const canLoad = existsSync(join(FUNCTIONS_DIR, 'node_modules', 'firebase-functions'));
  it.skipIf(!canLoad)('carga de verdad y cada export es una función', () => {
    const mod = require_(join(FUNCTIONS_DIR, 'index.js'));
    expect(Object.keys(mod).sort()).toEqual([...DEPLOYED_FUNCTIONS].sort());
    for (const name of DEPLOYED_FUNCTIONS) {
      expect(typeof mod[name], `${name} no es una función`).toBe('function');
    }
  });
});
