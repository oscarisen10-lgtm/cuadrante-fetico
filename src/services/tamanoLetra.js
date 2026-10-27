/**
 * Tamaño de letra del SISTEMA en la app nativa (auditoría 25-oct-2026, H-29).
 *
 * Quien tiene puesta la letra grande en su móvil (Ajustes → Accesibilidad → Texto más
 * grande en iPhone; Ajustes → Pantalla → Tamaño de fuente en Android) la ve también
 * más grande en la app. Quien no ha tocado ese ajuste no nota nada: el factor es 1.
 *
 * Con TOPE: la app tiene textos de 9-11 px dentro de pastillas, barras y celdas de
 * calendario de tamaño fijo. Hasta el 130% caben; más allá, el diseño se descoloca y
 * la app se volvería menos usable justo para quien la necesita más grande. Tampoco se
 * reduce por debajo de 1: los textos ya están en el mínimo que se lee.
 *
 * En la web no hace nada: allí el navegador ya deja ampliar.
 * El zoom con dos dedos sigue bloqueado en la app a propósito (index.html): en iPhone,
 * liberarlo hace que la pantalla entera se amplíe al tocar cualquier campo de texto.
 */
import { Capacitor } from '@capacitor/core';

export const TOPE_TAMANO_LETRA = 1.3;

/** Factor que se aplica de verdad: entre 1 y el tope. Función pura. */
export const factorAplicable = (preferido) => {
  const v = Number(preferido);
  if (!Number.isFinite(v) || v <= 1) return 1;
  return Math.min(Math.round(v * 100) / 100, TOPE_TAMANO_LETRA);
};

/** Lee el tamaño de letra del sistema y lo aplica a la app. Mejor esfuerzo. */
export async function aplicarTamanoLetraDelSistema() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { TextZoom } = await import('@capacitor/text-zoom');
    const { value } = await TextZoom.getPreferred();
    await TextZoom.set({ value: factorAplicable(value) });
  } catch (e) {
    // Sin el plugin (build antigua) o si falla, la app sigue a tamaño normal.
    console.warn('No se pudo aplicar el tamaño de letra del sistema:', e?.message || e);
  }
}

/**
 * Se aplica al arrancar y cada vez que la app vuelve a primer plano: el usuario puede
 * haber cambiado el tamaño de letra en Ajustes del móvil con la app abierta detrás.
 */
export function iniciarTamanoLetraDelSistema() {
  if (!Capacitor.isNativePlatform()) return;
  aplicarTamanoLetraDelSistema();
  import('@capacitor/app')
    .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) aplicarTamanoLetraDelSistema();
    }))
    .catch(() => { /* sin el plugin de App, solo se aplica al arrancar */ });
}
