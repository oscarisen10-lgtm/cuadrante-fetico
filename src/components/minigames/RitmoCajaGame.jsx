import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const COLS = 4;
const HIT_FROM = 55;   // zona válida de pulsación (%)
const ICONS = ['🥫', '🍞', '🥛', '🍫'];

function Play({ end }) {
  const [, render] = useState(0);
  const tiles = useRef([]); // {id, col, y}
  const st = useRef({ t: 0, hits: 0, nextSpawn: 600, alive: true });
  const idRef = useRef(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
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
        end(clamp(s.hits * 25, 0, 1500));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [end]);

  const tapCol = (col) => {
    const s = st.current;
    if (!s.alive) return;
    // El producto más bajo de esa columna dentro de la zona de cobro
    const candidates = tiles.current.filter(t => t.col === col && t.y >= HIT_FROM);
    if (candidates.length === 0) {
      s.alive = false;
      end(clamp(s.hits * 25, 0, 1500));
      return;
    }
    const lowest = candidates.reduce((a, b) => (a.y > b.y ? a : b));
    tiles.current = tiles.current.filter(t => t.id !== lowest.id);
    s.hits += 1;
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6 select-none">
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        Cobrados: <span className="text-violet-400">{st.current.hits}</span>
      </p>
      <div className="flex-1 relative bg-black/30 border-2 border-violet-500/30 rounded-3xl overflow-hidden touch-none flex">
        {/* Línea de cobro */}
        <div className="absolute left-0 right-0 border-t-2 border-dashed border-violet-400/50 z-10 pointer-events-none" style={{ top: `${HIT_FROM}%` }} />
        <div className="absolute left-0 right-0 bottom-0 bg-violet-500/10 pointer-events-none" style={{ top: `${HIT_FROM}%` }} />
        {Array.from({ length: COLS }, (_, c) => (
          <button key={c} onPointerDown={() => tapCol(c)} className="flex-1 relative border-r border-white/5 last:border-r-0 active:bg-white/5">
            {tiles.current.filter(t => t.col === c).map(t => (
              <div key={t.id} className="absolute left-1/2 -ml-5 -mt-5 w-10 h-10 rounded-xl border-b-4 border-violet-800 flex items-center justify-center text-xl"
                style={{ top: `${t.y}%`, background: 'linear-gradient(160deg, #c4b5fd, #7c3aed)', boxShadow: '0 4px 10px rgba(124,58,237,0.5), inset 0 2px 4px rgba(255,255,255,0.4)' }}>
                {ICONS[t.col]}
              </div>
            ))}
          </button>
        ))}
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
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
        <span key="1">Los productos bajan por <strong>4 cintas</strong> hacia tu caja.</span>,
        <span key="2">Toca su columna cuando crucen la <strong>línea de cobro</strong>.</span>,
        <span key="3">Si un producto se escapa o cobras en vacío, fin. ¡Acelera con el ritmo!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
