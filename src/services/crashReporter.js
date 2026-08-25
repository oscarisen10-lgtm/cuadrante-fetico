/**
 * Reporte de errores en producción (Crashlytics).
 *
 * ⚠️ POR QUÉ EXISTE ESTE ENVOLTORIO, y no llamadas sueltas al plugin.
 *
 * Crashlytics captura solo los crashes NATIVOS por su cuenta, y esta app es un
 * WebView: lo que de verdad se rompe aquí es JavaScript (un render de React, un
 * error de permisos de Firestore, una promesa sin `catch`). Nada de eso es un
 * crash nativo, así que si no se reporta A MANO, Crashlytics no se entera y la
 * consola se queda vacía mientras los usuarios ven pantallas rotas — justo la
 * ceguera que esto viene a resolver (auditoría 22-ago-2026, F-02).
 *
 * Aquí se centraliza: los enganches globales de errores de JS, el envío como
 * "excepción no fatal", y el no-op en web (el plugin es solo nativo).
 */
import { Capacitor } from '@capacitor/core';

// El plugin es NATIVO: en web (y en `vite dev`) no existe. La importación es
// dinámica para no meterlo en el bundle de quien abre la app desde el navegador.
const esNativo = Capacitor.isNativePlatform();
let pluginPromise = null;

const getPlugin = () => {
  if (!esNativo) return null;
  if (!pluginPromise) {
    pluginPromise = import('@capacitor-firebase/crashlytics')
      .then((m) => m.FirebaseCrashlytics)
      .catch((e) => {
        console.warn('[crash] plugin no disponible:', e?.message);
        return null;
      });
  }
  return pluginPromise;
};

// Tope de caracteres del mensaje. Crashlytics trunca los textos largos por su
// cuenta; recortar aquí evita mandar una traza de 20 KB para que la corten allí.
const MAX_MENSAJE = 900;

/**
 * Arma el texto que se envía. Se mete TODO en el mensaje (contexto + tipo +
 * descripción + traza) en vez de usar el parámetro `stacktrace` del plugin,
 * porque el bundle va minificado y una traza estructurada de nombres mangleados
 * no aporta más que el texto plano. Con `keepNames` en vite.config, los nombres
 * de función siguen siendo reconocibles.
 */
const construirMensaje = (error, contexto) => {
  const nombre = error?.name || 'Error';
  const desc = error?.message || String(error);
  const traza = error?.stack ? `\n${error.stack}` : '';
  const texto = `${contexto ? `[${contexto}] ` : ''}${nombre}: ${desc}${traza}`;
  return texto.length > MAX_MENSAJE ? `${texto.slice(0, MAX_MENSAJE)}…` : texto;
};

// Anti-inundación: un bucle de render roto puede disparar el mismo error cientos
// de veces por segundo. Se recuerda lo último enviado y se descarta lo repetido
// dentro de la ventana; si no, una sola sesión rota consumiría la cuota y, peor,
// enterraría el resto de errores del día.
const VENTANA_REPETIDOS_MS = 10000;
const ultimos = new Map();

const esRepetido = (clave) => {
  const ahora = Date.now();
  const previo = ultimos.get(clave);
  if (previo && ahora - previo < VENTANA_REPETIDOS_MS) return true;
  ultimos.set(clave, ahora);
  // El Map no puede crecer sin límite en una sesión larga.
  if (ultimos.size > 50) {
    for (const [k, t] of ultimos) {
      if (ahora - t > VENTANA_REPETIDOS_MS) ultimos.delete(k);
    }
  }
  return false;
};

/**
 * Envía un error como excepción NO FATAL: queda registrado en la consola de
 * Crashlytics sin matar la app. Nunca lanza: si el reporte falla, se traga (un
 * fallo del reportero no puede ser motivo de otro fallo).
 * @param {Error|unknown} error
 * @param {string} [contexto]  De dónde viene ('ErrorBoundary', 'onerror'…)
 * @returns {Promise<boolean>} true SOLO si el informe llegó a enviarse. Lo usa el
 *   botón de prueba de Ajustes para no decir "enviado" cuando no se envió nada
 *   (en web esto es siempre false: Crashlytics no tiene SDK web).
 */
export const reportError = async (error, contexto) => {
  if (!esNativo) return false;
  try {
    const message = construirMensaje(error, contexto);
    if (esRepetido(message)) return false;
    const Crashlytics = await getPlugin();
    if (!Crashlytics) return false;
    await Crashlytics.recordException({ message });
    return true;
  } catch {
    // A propósito en silencio: aquí no se puede volver a reportar.
    return false;
  }
};

/** ¿Se pueden enviar informes en esta plataforma? (false en web) */
export const puedeReportar = () => esNativo;

/**
 * Asocia los informes con el usuario, para poder cruzar "este fallo le pasó a
 * quien se quejó". Se manda SOLO el uid: es un identificador opaco. Nunca el
 * email ni el nombre — eso convertiría la consola de errores en un almacén de
 * datos personales sin motivo.
 */
export const setCrashUser = async (uid) => {
  if (!esNativo) return;
  try {
    const Crashlytics = await getPlugin();
    if (!Crashlytics) return;
    await Crashlytics.setUserId({ userId: uid || '' });
  } catch { /* mejor esfuerzo */ }
};

/**
 * Engancha los errores de JS que nadie captura. Se llama UNA vez al arrancar
 * (main.jsx), antes de montar React:
 *   - `error`: excepciones que llegan hasta arriba sin try/catch.
 *   - `unhandledrejection`: promesas rechazadas sin `.catch()` — el caso más
 *     común aquí, porque casi todo el trato con Firebase es asíncrono.
 * Los errores de render de React NO pasan por aquí: los atrapa ErrorBoundary,
 * que llama a reportError por su cuenta.
 */
export const initCrashReporting = () => {
  if (!esNativo || typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    // Los fallos al cargar un <img>/<script> también disparan 'error' pero no
    // traen `error`: no son excepciones y no interesan aquí.
    if (event?.error) reportError(event.error, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const motivo = event?.reason;
    reportError(motivo instanceof Error ? motivo : new Error(String(motivo)), 'unhandledrejection');
  });
};
