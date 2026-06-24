import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Háptica táctil — solo en apps nativas (iOS/Android) y si el usuario la tiene activada.
// La preferencia se guarda en el dispositivo (localStorage) para que el helper, que no
// es React, pueda leerla de forma síncrona desde cualquier sitio.
const native = Capacitor.isNativePlatform();

let enabled = (() => {
  try { return localStorage.getItem('hapticsEnabled') !== 'false'; } catch { return true; }
})();

export const setHapticsEnabled = (v) => {
  enabled = !!v;
  try { localStorage.setItem('hapticsEnabled', v ? 'true' : 'false'); } catch { /* almacenamiento no disponible */ }
};
export const isHapticsEnabled = () => enabled;

const on = () => native && enabled;

export const hapticLight = () => { if (on()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); };
export const hapticMedium = () => { if (on()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); };
export const hapticHeavy = () => { if (on()) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); };
export const hapticSuccess = () => { if (on()) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); };
export const hapticWarning = () => { if (on()) Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); };
export const hapticError = () => { if (on()) Haptics.notification({ type: NotificationType.Error }).catch(() => {}); };
