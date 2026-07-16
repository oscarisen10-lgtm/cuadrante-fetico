/**
 * Compresión de imágenes EN EL DISPOSITIVO antes de subirlas a Storage.
 *
 * Motivo (coste + velocidad): los carteles de noticias se subían tal cual salían
 * de la cámara (hasta 5 MB) y CADA usuario los descargaba enteros — es la mayor
 * partida de ancho de banda de Storage y el elemento más lento del Resumen.
 * Redimensionar a un máximo razonable y recomprimir deja un cartel típico en
 * ~150-400 KB (10-30 veces menos) sin pérdida visible en pantalla de móvil.
 *
 * Estrategia: canvas → WebP si el navegador sabe codificarlo (Chrome/Android);
 * si no (Safari/iOS devuelve PNG cuando se le pide WebP), JPEG de calidad alta.
 * Si algo falla o el resultado no mejora el original, se devuelve el original:
 * comprimir es una optimización, nunca un motivo para no poder publicar.
 */

const extFromType = (type) =>
  type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg';

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export const compressImage = async (file, { maxDim = 1600, quality = 0.82 } = {}) => {
  const original = { blob: file, type: file.type || 'image/jpeg', ext: extFromType(file.type) };
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    // WebP solo si el navegador REALMENTE lo codifica (Safari responde con PNG).
    const webp = await toBlob(canvas, 'image/webp', quality);
    if (webp && webp.type === 'image/webp' && webp.size < file.size) {
      return { blob: webp, type: 'image/webp', ext: 'webp' };
    }
    const jpeg = await toBlob(canvas, 'image/jpeg', quality);
    if (jpeg && jpeg.size < file.size) {
      return { blob: jpeg, type: 'image/jpeg', ext: 'jpg' };
    }
    return original; // ya era más pequeña que cualquier recompresión
  } catch (e) {
    console.warn('compressImage: no se pudo comprimir, se sube el original.', e?.message);
    return original;
  }
};
