/**
 * Tareas programadas de mantenimiento.
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require("./lib/firebase");

const BATCH_SIZE = 400;

/** Borra en lotes todo lo que devuelva `queryFor(lastDoc)` hasta vaciarlo. */
async function deleteAllBatched(queryFor) {
  let removed = 0;
  for (;;) {
    const snap = await queryFor();
    if (snap.empty) break;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    removed += snap.size;
    if (snap.size < BATCH_SIZE) break;
  }
  return removed;
}

/**
 * dailyCleanup — Purga de los restos del asistente de IA (eliminado el 28-jul-2026).
 *
 * Ya nadie ESCRIBE en `ai_cache` ni en `users/{uid}/usage`, pero los documentos que
 * generó el asistente siguen en producción. Esta tarea los vacía a lo largo de unas
 * pocas ejecuciones; cuando ambas colecciones estén a cero se puede retirar la
 * función entera (`firebase functions:delete dailyCleanup --region europe-west1`).
 *
 * `timeoutSeconds` explícito: el valor por defecto (60s) no da margen para vaciar un
 * backlog grande, y al quedarse a medias con `maxInstances: 1` no hay ninguna otra
 * instancia que recupere lo que faltó.
 */
exports.dailyCleanup = onSchedule(
  {
    schedule: "every day 04:30",
    timeZone: "Europe/Madrid",
    maxInstances: 1,
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    try {
      const removedCache = await deleteAllBatched(() =>
        db().collection("ai_cache").limit(BATCH_SIZE).get()
      );

      // `usage` solo contenía la cuota diaria del asistente (docs `chat_YYYY-MM-DD`).
      const removedUsage = await deleteAllBatched(() =>
        db().collectionGroup("usage").limit(BATCH_SIZE).get()
      );

      console.log(
        `Limpieza IA: ${removedCache} docs de ai_cache y ${removedUsage} de usage eliminados.`
      );
    } catch (error) {
      // Sin captura, un fallo transitorio deja solo el stack genérico de la
      // plataforma y no se sabe en qué fase murió.
      console.error("dailyCleanup falló:", error);
      throw error;
    }
    return null;
  }
);
