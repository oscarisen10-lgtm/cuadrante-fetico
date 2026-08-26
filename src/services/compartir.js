/**
 * Compartir la app con compañeros.
 *
 * Se comparte SIEMPRE /descargar, nunca el enlace de una tienda concreta: quien
 * envía el mensaje no sabe si el que lo recibe tiene Android o iPhone. Esa página
 * detecta la plataforma y resalta el botón que toca, y además es donde viven las
 * etiquetas Open Graph que pintan la tarjeta de vista previa en WhatsApp — que es
 * lo que de verdad ve el grupo entero, no el botón que lo mandó.
 *
 * Apuntar aquí (y no a las tiendas) también significa que si mañana cambia una URL
 * de tienda se arregla en la web, sin sacar una versión nueva de la app.
 */

export const ENLACE_DESCARGA = 'https://mi-calendario-fe.web.app/descargar';

// El asterisco es la negrita de WhatsApp. En el resto de sitios se ve como un
// asterisco y tampoco molesta.
const MENSAJE = '¡Hola! Llevo mis turnos y mis horas con *Mi Cuadrante*: el cuadrante, ' +
  'los findes de calidad y los festivos de mi centro, todo en el móvil. Te la paso por si te sirve, es gratis 👇';

/** El texto tal cual se envía: mensaje + enlace. */
export const textoCompartir = () => `${MENSAJE}\n${ENLACE_DESCARGA}`;

/**
 * Abre WhatsApp con el mensaje ya escrito, para que el usuario solo elija a quién
 * se lo manda. Se usa `wa.me` y no el esquema `whatsapp://` a propósito: si no
 * tiene WhatsApp instalado, `wa.me` abre la versión web en vez de fallar en
 * silencio, que es lo que hace el esquema nativo.
 *
 * `_blank` es importante en la app nativa: sin él la propia app navegaría fuera
 * de sí misma y el usuario se quedaría sin forma de volver.
 */
export const compartirPorWhatsApp = () => {
  const url = `https://wa.me/?text=${encodeURIComponent(textoCompartir())}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Copia el enlace al portapapeles. Es la salida cuando alguien no usa WhatsApp o
 * quiere pegarlo en otro sitio.
 * @returns {Promise<boolean>} false si el navegador no deja copiar (contexto no
 *   seguro, permisos), para que quien llama pueda avisar en vez de mentir.
 */
export const copiarEnlace = async () => {
  try {
    await navigator.clipboard.writeText(ENLACE_DESCARGA);
    return true;
  } catch {
    return false;
  }
};
