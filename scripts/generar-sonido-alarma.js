/**
 * Genera public/sounds/alarma-descanso.wav, el aviso de "descanso terminado" de Fichar.
 *
 * Antes el sonido era un MP3 de un CDN externo (assets.mixkit.co), descargado en cada
 * uso: no sonaba sin cobertura (el almacén, la trastienda…) y cada alarma le pasaba la
 * IP del usuario a un tercero que no figura en la política de privacidad (auditoría
 * 25-oct-2026). Ahora va dentro de la app, y este script deja claro de dónde sale:
 * se sintetiza aquí, sin licencias de terceros.
 *
 * Es un carillón de tres notas (La5, Do#6, Mi6: un acorde de La mayor) con caída
 * suave y un silencio al final, pensado para sonar en bucle (useTimer lo repite
 * durante un minuto como mucho).
 *
 *   node scripts/generar-sonido-alarma.js
 */
import { writeFileSync, mkdirSync } from 'fs';

const RATE = 22050;                       // suficiente para estas frecuencias
const NOTAS = [880, 1108.73, 1318.51];    // La5, Do#6, Mi6
const DUR_NOTA = 0.22;                    // segundos por nota
const SILENCIO = 0.45;                    // pausa antes de repetir
const VOLUMEN = 0.6;

const total = Math.round(RATE * (NOTAS.length * DUR_NOTA + SILENCIO));
const muestras = new Float32Array(total);

NOTAS.forEach((f, i) => {
  const inicio = Math.round(i * DUR_NOTA * RATE);
  // Cada nota se deja sonar más allá de su hueco (se solapan como un carillón).
  const largo = Math.round(DUR_NOTA * 3 * RATE); // hasta caer a ~1%: sin corte brusco
  for (let n = 0; n < largo && inicio + n < total; n++) {
    const t = n / RATE;
    const ataque = Math.min(1, t / 0.005);          // 5 ms: sin chasquido al empezar
    const caida = Math.exp(-t * 7);
    // Fundamental + un poco de octava: suena a campana, no a pitido.
    const onda = Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f * t);
    muestras[inicio + n] += onda * ataque * caida * VOLUMEN / 1.25;
  }
});

// Normaliza a 16 bits con margen, y cae a cero al final para que el bucle no chasque.
const pico = muestras.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
const pcm = Buffer.alloc(total * 2);
for (let n = 0; n < total; n++) {
  const v = Math.max(-1, Math.min(1, (muestras[n] / pico) * 0.9));
  pcm.writeInt16LE(Math.round(v * 32767), n * 2);
}

// Cabecera WAV (PCM, mono, 16 bits).
const cab = Buffer.alloc(44);
cab.write('RIFF', 0);
cab.writeUInt32LE(36 + pcm.length, 4);
cab.write('WAVE', 8);
cab.write('fmt ', 12);
cab.writeUInt32LE(16, 16);        // tamaño del bloque fmt
cab.writeUInt16LE(1, 20);         // PCM
cab.writeUInt16LE(1, 22);         // mono
cab.writeUInt32LE(RATE, 24);
cab.writeUInt32LE(RATE * 2, 28);  // bytes por segundo
cab.writeUInt16LE(2, 32);         // bytes por muestra
cab.writeUInt16LE(16, 34);        // bits por muestra
cab.write('data', 36);
cab.writeUInt32LE(pcm.length, 40);

mkdirSync('public/sounds', { recursive: true });
writeFileSync('public/sounds/alarma-descanso.wav', Buffer.concat([cab, pcm]));
console.log(`public/sounds/alarma-descanso.wav: ${(total / RATE).toFixed(2)} s, ${((44 + pcm.length) / 1024).toFixed(0)} KB`);
