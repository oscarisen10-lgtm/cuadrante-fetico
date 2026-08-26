/**
 * Sacar un archivo generado en el móvil FUERA de la app (guardarlo, mandarlo por
 * WhatsApp, imprimirlo).
 *
 * Web y app nativa no se parecen en nada aquí:
 *   - Web: un enlace <a download> y el navegador se encarga.
 *   - Nativa: ese enlace NO funciona (en iOS directamente no descarga nada), así
 *     que hay que escribir el fichero en el disco del dispositivo y abrir la hoja
 *     de compartir del sistema para que el usuario decida qué hacer con él.
 *
 * Los plugins nativos se importan dinámicamente para que la web no cargue código
 * que allí no puede usar.
 */
import { Capacitor } from '@capacitor/core';

const blobABase64 = (blob) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    // readAsDataURL da "data:application/pdf;base64,XXXX" — al plugin hay que
    // pasarle solo la parte de después de la coma.
    lector.onload = () => resolve(String(lector.result).split(',')[1]);
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });

async function guardarEnWeb(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Sin esto el blob se queda en memoria hasta recargar la página.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function guardarEnNativo(blob, nombre, titulo) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  // Cache y no Documents: es un fichero que el usuario va a compartir o guardar
  // donde quiera desde la hoja del sistema, no algo que la app deba conservar.
  const { uri } = await Filesystem.writeFile({
    path: nombre,
    data: await blobABase64(blob),
    directory: Directory.Cache,
  });

  await Share.share({ title: titulo, files: [uri] });
}

/**
 * Guarda o comparte un Blob según la plataforma.
 * @returns {Promise<'guardado'|'compartido'|'cancelado'>}
 * @throws si falla de verdad (sin espacio, permiso denegado…). Quien llama avisa.
 */
export async function descargarArchivo(blob, nombre, titulo = nombre) {
  if (!Capacitor.isNativePlatform()) {
    await guardarEnWeb(blob, nombre);
    return 'guardado';
  }
  try {
    await guardarEnNativo(blob, nombre, titulo);
    return 'compartido';
  } catch (e) {
    // Cerrar la hoja de compartir sin elegir nada llega aquí como error, y no lo
    // es: el usuario ha cambiado de idea. Decirle "no se pudo generar el PDF"
    // sería mentirle, así que se distingue por el mensaje del plugin.
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss')) return 'cancelado';
    throw e;
  }
}
