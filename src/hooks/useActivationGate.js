import { useState, useCallback } from 'react';

/**
 * useActivationGate — "esta acción solo vale para cuentas ACTIVADAS".
 *
 * Las cuentas pendientes de que un delegado las verifique navegan con normalidad:
 * ven la Agenda y los Permisos, y el aviso salta solo al intentar USAR lo bloqueado
 * (registrar un libre, ajustar horas, abrir el detalle de un permiso). Fichar queda
 * abierto a propósito.
 *
 * Esto estaba copiado en CalendarView y LicenciasView: cada una con su propio
 * `useState` y su propio `if (!isActive) { setShowActivationGate(true); return; }`
 * repetido en cada handler. Funcionaba, pero nada avisaba si una pantalla NUEVA se
 * olvidaba del guard, y ese olvido no se ve en la interfaz: simplemente la cuenta
 * pendiente podría escribir.
 *
 * Es una GUARDA (`if (!requireActive()) return;`) y no un envoltorio del estilo
 * `gated(fn)` a propósito: envolver la función deja a react-hooks/exhaustive-deps
 * sin poder comprobar las dependencias del useCallback ("received a function whose
 * dependencies are unknown"), y perder esa verificación en los handlers que
 * escriben turnos cuesta más de lo que ahorra en escritura.
 *
 * @param {boolean} isActive  ¿La cuenta puede usar lo restringido?
 */
export function useActivationGate(isActive) {
  const [gateVisible, setGateVisible] = useState(false);

  const closeGate = useCallback(() => setGateVisible(false), []);

  /** true si puede seguir; si no, muestra el aviso y devuelve false. */
  const requireActive = useCallback(() => {
    if (isActive) return true;
    setGateVisible(true);
    return false;
  }, [isActive]);

  return { requireActive, gateVisible, closeGate };
}
