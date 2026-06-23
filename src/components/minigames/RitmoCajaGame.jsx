import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand , ScoreBurst } from './GameShell';

const COLS = 4;
const HIT_FROM = 55;   // zona válida de pulsación (%)

// Cada cinta tiene su propio color para diferenciarla de un vistazo
const LANES = [
  { icon: '🥫', light: '#fda4af', dark: '#e11d48', border: '#9f1239', tintRgb: '225,29,72' },   // rojo
  { icon: '🍞', light: '#fcd34d', dark: '#d97706', border: '#92400e', tintRgb: '217,119,6' },    // ámbar
  { icon: '🥛', light: '#6ee7b7', dark: '#059669', border: '#065f46', tintRgb: '5,150,105' },    // verde
  { icon: '🍫', light: '#7dd3fc', dark: '#0284c7', border: '#075985', tintRgb: '2,132,199' },    // azul
];

function Play({ end }) {
  const [, render] = useState(0);
  const tiles = useRef([]); // {id, col, y}
  const st = useRef({ t: 0, hits: 0, nextSpawn: 600, alive: true });
  const idRef = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      if (!st.current.alive) return;
      const dt = Math.min(40, now - last);
      last = now;
      const s = st.current;
      s.t += dt;

      // Generar productos en la cinta
      if (s.t > s.nextSpawn) {
        let col = rand(0, COLS - 1);
        const lastTile = tiles.current[tiles.current.length - 1];
        if (lastTile && lastTile.col === col) col = (col + 1) % COLS;
        tiles.current.push({ id: idRef.current++, col, y: -12 });
        s.nextSpawn = s.t + Math.max(420, 800 - s.t / 80);
      }

      // Bajar productos
      const speed = 0.045 + s.t / 150000 + s.hits * 0.0004;
      for (const t of tiles.current) t.y += speed * dt;

      // Producto que se escapa = fin
      if (tiles.current.some(t => t.y > 102)) {
        s.alive = false;
        endRef.current(clamp(s.hits * 25, 0, 1500));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapCol = (col) => {
    const s = st.current;
    if (!s.alive) return;
    // El producto más bajo de esa columna dentro de la zona de cobro
    const candidates = tiles.current.filter(t => t.col === col && t.y >= HIT_FROM);
    if (candidates.length === 0) {
      s.alive = false;
      endRef.current(clamp(s.hits * 25, 0, 1500));
      return;
    }
    const lowest = candidates.reduce((a, b) => (a.y > b.y ? a : b));
    tiles.current = tiles.current.filter(t => t.id !== lowest.id);
    s.hits += 1;
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6 select-none">
      <ScoreBurst value={st.current.hits} color="#c4b5fd" />
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        Cobrados: <span className="text-violet-400">{st.current.hits}</span>
      </p>
      <div className="flex-1 relative bg-black/30 rounded-3xl overflow-hidden touch-none flex">
        {/* Línea de cobro */}
        <div className="absolute left-0 right-0 border-t-2 border-dashed border-white/40 z-10 pointer-events-none" style={{ top: `${HIT_FROM}%` }} />
        {Array.from({ length: COLS }, (_, c) => {
          const L = LANES[c];
          return (
            <button
              key={c}
              onPointerDown={() => tapCol(c)}
              className="flex-1 relative active:brightness-125"
              style={{
                // tinte vertical propio de la cinta: casi nulo arriba, marcado en la zona de cobro
                background: `linear-gradient(to bottom, rgba(${L.tintRgb},0) 0%, rgba(${L.tintRgb},0.05) ${HIT_FROM}%, rgba(${L.tintRgb},0.22) 100%)`,
                boxShadow: c < COLS - 1 ? 'inset -1px 0 0 rgba(255,255,255,0.08)' : 'none',
              }}
            >
              {/* Baldosa de aterrizaje: indica claramente dónde pulsar esta cinta */}
              <div
                className="absolute bottom-0 left-1 right-1 h-3 rounded-t-md pointer-events-none"
                style={{ background: `linear-gradient(to top, ${L.dark}, rgba(${L.tintRgb},0))`, boxShadow: `0 0 14px rgba(${L.tintRgb},0.55)` }}
              />
              {tiles.current.filter(t => t.col === c).map(t => (
                <div key={t.id} className="absolute left-1/2 -ml-5 -mt-5 w-10 h-10 rounded-xl border-b-4 flex items-center justify-center text-xl"
                  style={{ top: `${t.y}%`, borderColor: L.border, background: `linear-gradient(160deg, ${L.light}, ${L.dark})`, boxShadow: `0 4px 10px rgba(${L.tintRgb},0.5), inset 0 2px 4px rgba(255,255,255,0.4)` }}>
                  {L.icon}
                </div>
              ))}
            </button>
          );
        })}
        <p className="absolute bottom-4 left-0 right-0 text-center text-white/35 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Cobra cada producto cuando pase la línea
        </p>
      </div>
    </div>
  );
}

export function RitmoCajaGame(props) {
  return (
    <GameShell
      {...props}
      day={31} title="Ritmo de Caja" emoji="🎹" accent="violet"
      instructions={[
        <span key="1">Los productos bajan por <strong>4 cintas de colores</strong> hacia tu caja.</span>,
        <span key="2">Toca la cinta de su color cuando crucen la <strong>línea de cobro</strong>.</span>,
        <span key="3">Si un producto se escapa o cobras en vacío, fin. ¡Acelera con el ritmo!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
