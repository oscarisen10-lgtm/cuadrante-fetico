import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Háptica táctil — solo en apps nativas (iOS/Android). En web no hace nada,
// así que las llamadas son seguras desde cualquier sitio.
const native = Capacitor.isNativePlatform();

export const hapticLight = () => { if (native) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); };
export const hapticMedium = () => { if (native) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); };
export const hapticHeavy = () => { if (native) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); };
export const hapticSuccess = () => { if (native) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); };
export const hapticWarning = () => { if (native) Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); };
export const hapticError = () => { if (native) Haptics.notification({ type: NotificationType.Error }).catch(() => {}); };
