import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const DURATION = 60;
const REST = { x: 50, y: 86 };
const GRAVITY = 0.00013;   // %/ms²
const K = 0.0062;          // sensibilidad del tirachinas
const TRUCK_Y = 22;        // línea de "canasta" (borde de la caja)
const BED_HALF = 11;       // medio ancho del remolque

function Play({ end }) {
  const [, render] = useState(0);
  const arenaRef = useRef(null);
  const box = useRef({ x: REST.x, y: REST.y, vx: 0, vy: 0, flying: false, lastY: REST.y });
  const truck = useRef({ x: 30, dir: 1 });
  const aim = useRef({ active: false, cx: REST.x, cy: REST.y });
  const st = useRef({ baskets: 0, flash: 0 });
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const endRef = useRef(end);
  endRef.current = end;
  const overRef = useRef(false);

  const finish = () => { if (overRef.current) return; overRef.current = true; endRef.current(clamp(st.current.baskets * 80, 0, 2000)); };

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; }), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (overRef.current) return;
      const dt = Math.min(40, now - last); last = now;

      // Furgoneta en movimiento (acelera con los aciertos)
      const tk = truck.current;
      const sp = 0.022 + st.current.baskets * 0.0016;
      tk.x += tk.dir * sp * dt;
      if (tk.x < BED_HALF + 2) { tk.x = BED_HALF + 2; tk.dir = 1; }
      if (tk.x > 98 - BED_HALF) { tk.x = 98 - BED_HALF; tk.dir = -1; }

      // Caja en vuelo
      const b = box.current;
      if (b.flying) {
        b.lastY = b.y;
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx) * 0.7; }
        if (b.x > 98) { b.x = 98; b.vx = -Math.abs(b.vx) * 0.7; }

        // ¿entra en el remolque?
        const crossing = b.vy > 0 && b.lastY < TRUCK_Y && b.y >= TRUCK_Y;
        if (crossing && Math.abs(b.x - tk.x) < BED_HALF) {
          st.current.baskets += 1;
          st.current.flash = performance.now();
          resetBox();
        } else if (b.y > 106) {
          resetBox();
        }
      }
      if (st.current.flash && performance.now() - st.current.flash > 600) st.current.flash = 0;

      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetBox = () => { box.current = { x: REST.x, y: REST.y, vx: 0, vy: 0, flying: false, lastY: REST.y }; };

  const toPct = (e) => {
    const r = arenaRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const onDown = (e) => { if (box.current.flying) return; const p = toPct(e); aim.current = { active: true, cx: p.x, cy: p.y }; };
  const onMove = (e) => { if (!aim.current.active) return; const p = toPct(e); aim.current.cx = p.x; aim.current.cy = p.y; render(n => n + 1); };
  const onUp = () => {
    if (!aim.current.active) return;
    const a = aim.current; a.active = false;
    const vx = (REST.x - a.cx) * K;
    const vy = (REST.y - a.cy) * K;
    if (Math.abs(vx) + Math.abs(vy) < 0.012) return; // tirón mínimo
    box.current = { x: REST.x, y: REST.y, vx: clamp(vx, -0.12, 0.12), vy: clamp(vy, -0.13, -0.02), flying: true, lastY: REST.y };
  };

  // Previsualización de la trayectoria
  const preview = [];
  if (aim.current.active && !box.current.flying) {
    let px = REST.x, py = REST.y, pvx = (REST.x - aim.current.cx) * K, pvy = (REST.y - aim.current.cy) * K;
    pvy = clamp(pvy, -0.13, -0.02); pvx = clamp(pvx, -0.12, 0.12);
    for (let i = 0; i < 16; i++) {
      pvy += GRAVITY * 26; px += pvx * 26; py += pvy * 26;
      if (py > 100 || px < 0 || px > 100) break;
      preview.push({ x: px, y: py });
    }
  }

  const b = box.current;
  const flash = !!st.current.flash;

  return (
    <div className="flex-1 flex flex-col px-5 pb-6 select-none">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className={`hud-chip font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="hud-chip text-sky-300 font-black px-4 py-1.5 rounded-full text-sm">🎯 {st.current.baskets}</span>
      </div>
      <div
        ref={arenaRef}
        className="flex-1 relative rounded-3xl overflow-hidden touch-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.16), rgba(0,0,0,0.28) 70%)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4)' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      >
        {/* Zona de canasta (coincide exactamente con la colisión) */}
        <div
          className="absolute h-2 rounded-full pointer-events-none"
          style={{ left: `${truck.current.x - BED_HALF}%`, width: `${BED_HALF * 2}%`, top: `${TRUCK_Y}%`, marginTop: -4, background: flash ? 'linear-gradient(90deg,#6ee7b7,#059669)' : 'linear-gradient(90deg,#38bdf8,#0284c7)', boxShadow: flash ? '0 0 18px rgba(16,185,129,0.8)' : '0 0 14px rgba(56,189,248,0.6)' }}
        />
        {/* Furgoneta */}
        <span className="absolute text-5xl -ml-6 drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)] pointer-events-none" style={{ left: `${truck.current.x}%`, top: `${TRUCK_Y}%`, marginTop: 2 }}>🚚</span>

        {/* Previsualización de trayectoria */}
        {preview.map((p, i) => (
          <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-white/60 -ml-0.5 -mt-0.5 pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: 1 - i / 18 }} />
        ))}

        {/* Caja */}
        <div className="absolute -ml-4 -mt-4 w-8 h-8 rounded-md flex items-center justify-center text-lg pointer-events-none" style={{ left: `${b.x}%`, top: `${b.y}%`, background: 'linear-gradient(160deg,#fcd34d,#d97706)', boxShadow: '0 3px 8px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.5)' }}>📦</div>

        {flash && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-300 font-black text-3xl gfx-pop pointer-events-none">¡ENCESTA! 🎉</div>}

        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Tira hacia atrás y suelta para lanzar la caja a la furgoneta
        </p>
      </div>
    </div>
  );
}

export function EncestaGame(props) {
  return (
    <GameShell
      {...props}
      day={20} title="Encesta" emoji="🚚" accent="blue"
      instructions={[
        <span key="1">Carga la furgoneta lanzando <strong>cajas 📦</strong> a su remolque.</span>,
        <span key="2"><strong>Mantén y arrastra hacia atrás</strong> (como un tirachinas) y suelta para lanzar. Verás la trayectoria.</span>,
        <span key="3">La furgoneta se mueve y acelera. 60 segundos: ¡mete las máximas! (80 pts cada una)</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
