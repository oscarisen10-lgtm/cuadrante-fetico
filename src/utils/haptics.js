import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Háptica táctil — solo en apps nativas (iOS/Android) y si el usuario la tiene activada.
// La preferencia se guarda en el dispositivo (localStorage) para que el helper, que no
// es React, pueda leerla de forma síncrona desde cualquier sitio.
const native = Capacitor.isNativePlatform();
const isAndroid = native && Capacitor.getPlatform() === 'android';

let enabled = (() => {
  try { return localStorage.getItem('hapticsEnabled') !== 'false'; } catch { return true; }
})();

export const setHapticsEnabled = (v) => {
  enabled = !!v;
  try { localStorage.setItem('hapticsEnabled', v ? 'true' : 'false'); } catch { /* almacenamiento no disponible */ }
};
export const isHapticsEnabled = () => enabled;

const on = () => native && enabled;

// Toque ligero (tap de apartados, botones de la barra…). En Android el impacto "Light"
// se siente más fuerte/brusco que en iOS; usamos selectionChanged(), que es el feedback
// MÁS SUAVE de la API (un "tick" muy ligero) y se acerca a la sensación de iOS. En iOS
// dejamos impact Light, que ya es suave.
export const hapticLight = () => {
  if (!on()) return;
  if (isAndroid) Haptics.selectionChanged().catch(() => {});
  else Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
};
// En Android bajamos "Medium" a "Light" para que tampoco resulte brusco (iOS se queda igual).
export const hapticMedium = () => {
  if (!on()) return;
  Haptics.impact({ style: isAndroid ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {});
};
export const hapticHeavy = () => { if (on()) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); };
export const hapticSuccess = () => { if (on()) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); };
export const hapticWarning = () => { if (on()) Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); };
export const hapticError = () => { if (on()) Haptics.notification({ type: NotificationType.Error }).catch(() => {}); };
