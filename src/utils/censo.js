/**
 * Futuros usuarios del censo del delegado, y el consentimiento de su afiliación.
 *
 * ⚠️ RGPD (auditoría 25-oct-2026, H-03). El sindicato de una persona es un dato de
 * categoría especial (art. 9): no basta el "interés legítimo" que cubre su nombre y
 * su sección. Óscar decidió mantenerlo, pero SOLO con el consentimiento expreso de
 * esa persona, y el responsable tiene que poder demostrarlo (art. 7.1). Por eso cada
 * sindicato apuntado guarda cuándo y quién registró ese consentimiento.
 *
 * Las reglas de Firestore no pueden recorrer el mapa `prospects`, así que esta
 * comprobación vive aquí. Quien la aplica es el delegado, que es el responsable de
 * haber obtenido el permiso de la persona.
 */

export const SIN_SINDICATO = 'Sin sindicato';

/** ¿Tiene apuntado algún sindicato? */
export const tieneSindicato = (p) =>
  !!p && typeof p.sindicato === 'string' && p.sindicato !== '' && p.sindicato !== SIN_SINDICATO;

/** ¿Consta cuándo se registró su consentimiento? */
export const consentimientoRegistrado = (p) =>
  !!p && typeof p.sindicatoConsentidoAt === 'number' && p.sindicatoConsentidoAt > 0;

/**
 * Sindicato apuntado SIN consentimiento registrado. Son las entradas anteriores al
 * 25-oct-2026: el delegado tiene que confirmar que la persona se lo dio, o quitarlo.
 */
export const sindicatoPendiente = (p) => tieneSindicato(p) && !consentimientoRegistrado(p);

/**
 * Crea la entrada de un futuro usuario.
 * Con sindicato, exige `consentido`; sin él, devuelve { error } y no crea nada.
 * Sin sindicato no se guarda ningún campo de sindicato (minimización de datos).
 */
export const crearFuturo = ({ name, section, sindicato, consentido, uid, ahora = Date.now() }) => {
  const nombre = String(name ?? '').trim();
  if (!nombre) return { error: 'Escribe el nombre del futuro usuario.' };
  const entrada = { name: nombre, section: section || 'Sin especificar' };
  if (!tieneSindicato({ sindicato })) return { entrada };
  if (consentido !== true) {
    return { error: 'Para apuntar su sindicato, marca que te ha dado su consentimiento expreso. Si no, déjalo en «Sin sindicato».' };
  }
  return {
    entrada: { ...entrada, sindicato, sindicatoConsentidoAt: ahora, sindicatoConsentidoPor: uid || '' },
  };
};

/** Registra ahora el consentimiento de una entrada que ya tenía sindicato. */
export const confirmarConsentimiento = (p, uid, ahora = Date.now()) => ({
  ...p, sindicatoConsentidoAt: ahora, sindicatoConsentidoPor: uid || '',
});

/** Quita el sindicato (y su consentimiento) de una entrada; el resto se queda. */
export const quitarSindicato = (p) => {
  const copia = { ...p };
  delete copia.sindicato;
  delete copia.sindicatoConsentidoAt;
  delete copia.sindicatoConsentidoPor;
  return copia;
};

/** Cuántas entradas de todo el censo tienen el sindicato sin consentimiento. */
export const contarPendientes = (prospects) =>
  Object.values(prospects || {}).reduce(
    (acc, lista) => acc + (Array.isArray(lista) ? lista.filter(sindicatoPendiente).length : 0),
    0
  );
