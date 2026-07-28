/**
 * Tareas programadas de mantenimiento.
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require("./lib/firebase");

/**
 * dailyCleanup — Limpieza programada (optimización de almacenamiento F-4).
 * Borra la caché de IA con más de 30 días para que no crezca indefinidamente.
 * Se ejecuta de madrugada (hora de Madrid).
 */
exports.dailyCleanup = onSchedule(
  { schedule: "every day 04:30", timeZone: "Europe/Madrid", maxInstances: 1 },
  async () => {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ai_cache con timestamp anterior al corte (en lotes de 400).
    let removedCache = 0;
    for (;;) {
      const old = await db().collection("ai_cache")
        .where("timestamp", "<", cutoffDate)
        .limit(400)
        .get();
      if (old.empty) break;
      const batch = db().batch();
      old.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      removedCache += old.size;
      if (old.size < 400) break;
    }

    console.log(`Limpieza: ${removedCache} cachés de IA eliminados.`);
    return null;
  }
);
