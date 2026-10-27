/**
 * Imágenes de las noticias en Storage (carteles del admin y de los delegados).
 *
 * ⚠️ Auditoría 25-oct-2026 (H-15). Borrar una noticia solo eliminaba el documento: el
 * cartel se quedaba en Storage para siempre, y su URL con token seguía funcionando
 * aunque la noticia (o la cuenta del delegado que lo subió) ya no existiera. Ahora un
 * trigger lo borra en cuanto desaparece el documento, venga el borrado de donde venga
 * (el autor, el admin, o purgeUserData al eliminar una cuenta).
 */
const { admin } = require("./firebase");

// Solo se borra bajo estas carpetas. Es el cinturón de seguridad: aunque una noticia
// llevara en `imageUrl` la URL de cualquier otro fichero del bucket, este código no
// lo tocaría.
const CARPETAS_DE_NOTICIAS = ["noticias/", "noticias-delegado/"];

/**
 * Saca la ruta dentro del bucket de una URL de descarga de Firebase Storage
 * (https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ruta>?alt=media&token=…).
 * Devuelve null si la URL no es de ESE bucket o no apunta a una carpeta de noticias.
 * Función pura: no toca la red.
 */
function rutaDeImagen(url, bucket) {
  if (typeof url !== "string" || !url || !bucket) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "firebasestorage.googleapis.com") return null;
  const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
  if (!m || decodeURIComponent(m[1]) !== bucket) return null;
  let ruta;
  try {
    ruta = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  if (ruta.includes("..")) return null;
  return CARPETAS_DE_NOTICIAS.some((c) => ruta.startsWith(c)) ? ruta : null;
}

/**
 * Borra el cartel de una noticia que se acaba de eliminar. Mejor esfuerzo: si la
 * imagen ya no estaba, no es un error; si falla, se registra y no se reintenta.
 * @param {object|undefined} noticia  datos del documento borrado
 */
async function borrarImagenDeNoticia(noticia) {
  const bucket = admin.storage().bucket();
  const ruta = rutaDeImagen(noticia && noticia.imageUrl, bucket.name);
  if (!ruta) return false;
  try {
    await bucket.file(ruta).delete({ ignoreNotFound: true });
    console.log(`Cartel borrado de Storage: ${ruta}`);
    return true;
  } catch (e) {
    console.error(`No se pudo borrar el cartel ${ruta}:`, e.message);
    return false;
  }
}

module.exports = { rutaDeImagen, borrarImagenDeNoticia, CARPETAS_DE_NOTICIAS };
