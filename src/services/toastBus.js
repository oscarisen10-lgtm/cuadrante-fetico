/**
 * Puente imperativo entre cualquier módulo (hooks, servicios, componentes) y los
 * componentes de aviso `ToastContainer` / `ConfirmDialog`.
 *
 * Vive FUERA de Toast.jsx a propósito: un fichero que exporta componentes de React
 * y además funciones sueltas rompe el Fast Refresh de Vite (react-refresh/
 * only-export-components), porque el HMR no sabe si recargar el módulo o remontar
 * el árbol. Separar la API imperativa —que no es un componente— lo arregla y deja
 * cada pieza en su sitio: aquí el bus, allí la interfaz.
 */

// --- Avisos (toasts) ---
let toastId = 0;
let addToastHandler = null;

/**
 * Registra el componente que pinta los avisos. Devuelve la función de limpieza,
 * pensada para usarse tal cual como retorno de un useEffect.
 */
export const registerToastHandler = (handler) => {
  addToastHandler = handler;
  return () => { addToastHandler = null; };
};

/** Muestra un aviso. Si no hay contenedor montado, se descarta en silencio. */
export function toast(message, type = 'info') {
  if (addToastHandler) addToastHandler({ id: ++toastId, message, type });
}

// --- Confirmación (sustituye a window.confirm) ---
let resolveConfirm = null;
let showConfirmHandler = null;

/** Registra el componente que pinta el diálogo. Devuelve la función de limpieza. */
export const registerConfirmHandler = (handler) => {
  showConfirmHandler = handler;
  return () => { showConfirmHandler = null; };
};

/** Resuelve la confirmación pendiente con la respuesta del usuario. */
export const resolvePendingConfirm = (value) => {
  if (resolveConfirm) {
    resolveConfirm(value);
    resolveConfirm = null;
  }
};

/** Pregunta al usuario y resuelve a true/false. */
export function confirm(message) {
  return new Promise((resolve) => {
    resolveConfirm = resolve;
    if (showConfirmHandler) showConfirmHandler(message);
  });
}
