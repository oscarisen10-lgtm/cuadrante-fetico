/**
 * Enlaces que vienen de un documento (el `linkUrl` de una noticia) y se pintan como
 * botón. Nada en el esquema obliga a que sean inofensivos, así que se filtran aquí.
 */

const esHostLocal = (host) =>
  host === 'localhost' || host.endsWith('.localhost') ||
  host === '127.0.0.1' || host === '[::1]' || host === '0.0.0.0';

/**
 * Devuelve el enlace solo si es http(s) y apunta FUERA de la app; si no, null (y el
 * botón no se pinta). Sin el filtro de protocolo, un `javascript:…` se ejecutaría al
 * tocar el botón.
 *
 * ⚠️ El propio origen y `localhost` también se rechazan (auditoría 25-oct-2026, H-01).
 * En Android la app vive en https://localhost, y con Capacitor ≤ 8.3.4
 * (CVE-2026-103922) un enlace a https://localhost/_capacitor_http_interceptor_?…
 * cargaba una web ajena DENTRO de la app, con acceso a la sesión y a los plugins. Una
 * noticia nunca necesita enlazar a la propia app, así que se corta todo ese terreno.
 *
 * @param {unknown} url
 * @param {string} [origenApp]  origen de la app; inyectable para los tests.
 * @returns {string|null}
 */
export const enlaceSeguro = (url, origenApp = window.location.origin) => {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const u = new URL(url.trim(), origenApp);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.origin === origenApp || esHostLocal(u.hostname.toLowerCase())) return null;
    if (u.pathname.toLowerCase().includes('_capacitor_')) return null;
    return u.href;
  } catch {
    return null;
  }
};
