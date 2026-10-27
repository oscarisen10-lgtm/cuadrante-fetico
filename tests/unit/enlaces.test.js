// Test UNITARIO del filtro de enlaces de las noticias (src/utils/enlaces.js).
// Auditoría 25-oct-2026 (H-01): con Capacitor ≤ 8.3.4 (CVE-2026-103922), un enlace a
// la ruta interna del proxy cargaba una web ajena DENTRO de la app Android, que vive
// en https://localhost. El botón "Ver más información" no debe pintarse nunca para
// un enlace a la propia app.
import { describe, test, expect } from 'vitest';
import { enlaceSeguro } from '../../src/utils/enlaces.js';

const ANDROID = 'https://localhost';
const IOS = 'capacitor://localhost';
const WEB = 'https://mi-calendario-fe.web.app';

describe('enlaceSeguro', () => {
  test('deja pasar un enlace normal a otra web', () => {
    expect(enlaceSeguro('https://www.boe.es/convenio', ANDROID)).toBe('https://www.boe.es/convenio');
    expect(enlaceSeguro('http://fetico.es', WEB)).toBe('http://fetico.es/');
  });

  test('rechaza lo que no es http(s)', () => {
    expect(enlaceSeguro('javascript:alert(1)', WEB)).toBeNull();
    expect(enlaceSeguro('data:text/html,<script>1</script>', WEB)).toBeNull();
    expect(enlaceSeguro('capacitor://localhost/x', IOS)).toBeNull();
  });

  test('rechaza la ruta interna del proxy de Capacitor', () => {
    const ataque = 'https://localhost/_capacitor_http_interceptor_?u=https%3A%2F%2Fmalo.example';
    expect(enlaceSeguro(ataque, ANDROID)).toBeNull();
    // Aunque se disfrace con mayúsculas o desde otro origen.
    expect(enlaceSeguro('https://LOCALHOST/_Capacitor_http_interceptor_', IOS)).toBeNull();
  });

  test('rechaza cualquier enlace al propio origen o a máquinas locales', () => {
    expect(enlaceSeguro('https://localhost/', ANDROID)).toBeNull();
    expect(enlaceSeguro('/ajustes', ANDROID)).toBeNull();
    expect(enlaceSeguro('https://mi-calendario-fe.web.app/privacidad.html', WEB)).toBeNull();
    expect(enlaceSeguro('http://127.0.0.1:8080/', WEB)).toBeNull();
    expect(enlaceSeguro('http://app.localhost/', WEB)).toBeNull();
  });

  test('vacío, null o basura no pinta botón', () => {
    expect(enlaceSeguro('', WEB)).toBeNull();
    expect(enlaceSeguro('   ', WEB)).toBeNull();
    expect(enlaceSeguro(null, WEB)).toBeNull();
    expect(enlaceSeguro(42, WEB)).toBeNull();
    expect(enlaceSeguro('http://', WEB)).toBeNull();
  });
});
