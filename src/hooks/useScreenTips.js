import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WELCOME_TIP, SCREEN_TIPS } from '../constants/screenTips';

// Marcadores de "ya visto", en el dispositivo (como cartelSeenId): el tutorial es
// una ayuda de la app, no un dato del perfil. Un solo objeto {id: true} para no
// llenar el almacenamiento de claves sueltas.
const KEY = 'mcTipsSeenV1';

const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const writeSeen = (value) => {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* almacenamiento no disponible */ }
};

/**
 * useScreenTips — Decide qué aviso del tutorial toca mostrar AHORA.
 *
 * No hace falta ningún efecto: el aviso activo se DEDUCE de la pantalla en la que
 * está el usuario y de lo que ya ha visto. Cerrar uno lo marca como visto y la
 * cuenta se vuelve a hacer sola; por eso, al cerrar la bienvenida aparece
 * enseguida el aviso de Resumen (se está en esa pantalla y aún no se ha visto),
 * y a partir de ahí cada pantalla avisa la primera vez que se abre.
 */
export function useScreenTips() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [seen, setSeen] = useState(readSeen);

  const screenTip = SCREEN_TIPS[pathname];
  const tip = !seen[WELCOME_TIP.id]
    ? WELCOME_TIP
    : (screenTip && !seen[screenTip.id] ? screenTip : null);

  const dismiss = useCallback(() => {
    if (!tip) return;
    setSeen((prev) => {
      const next = { ...prev, [tip.id]: true };
      writeSeen(next);
      return next;
    });
  }, [tip]);

  // "Ver el tutorial otra vez" (Ajustes): se olvida todo lo visto y se vuelve al
  // principio. El resto de avisos irán saliendo según se abra cada pantalla.
  const restart = useCallback(() => {
    writeSeen({});
    setSeen({});
    navigate('/dashboard');
  }, [navigate]);

  return { tip, dismiss, restart };
}
