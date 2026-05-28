import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Llama a la Cloud Function `askFeticoAssistant`.
 * @param {string} message El mensaje del usuario.
 * @returns {Promise<{text: string, success: boolean}>} La respuesta del asistente.
 */
export const askAssistant = async (message) => {
  try {
    const askFeticoAssistant = httpsCallable(functions, 'askFeticoAssistant');
    const result = await askFeticoAssistant({ message });
    return result.data;
  } catch (error) {
    // Si la cuota se excede o hay error, la función lanza un HttpsError que Firebase Functions
    // mapea automáticamente aquí. Extraemos el mensaje original.
    throw new Error(error.message || 'Error desconocido al contactar con el asistente.');
  }
};
