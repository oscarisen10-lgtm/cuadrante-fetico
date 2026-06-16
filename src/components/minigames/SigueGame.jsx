import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const MAX_STRIKES = 3;
const LOCK_R = 12;      // radio de enganche (%)
const GRACE = 520;      // ms fuera del objetivo antes de fallo
const MAX_TIME = 90000;
const PRODUCTS = ['📦', '🧴', '🥫', '🧃', '🍫'];

function Play({ end }) {
  const [, render] = useState(0);
  const arenaRef = useRef(null);
  const orb = useRef({ x: 50, y: 35, vx: 0.02, vy: 0.018, emoji: PRODUCTS[0] });
  const player = useRef({ x: 50, y: 50, down: false });
  const st = useRef({ t: 0, scoreMs: 0, offMs: 0, strikes: 0, jitter: 900, alive: true });
  const [strikes, setStrikes] = useState(0);
  const endRef = useRef(end);
  endRef.current = end;

  const finish = () => {
    if (!st.current.alive) return;
    st.current.alive = false;
    endRef.current(clamp(Math.round(st.current.scoreMs / 40), 0, 2000)); // ~25 pts/s enganchado
  };

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (!st.current.alive) return;
      const dt = Math.min(40, now - last); last = now;
      const s = st.current; s.t += dt;
      const o = orb.current;

      // velocidad creciente
      const sp = 0.02 + s.t / 38000;
      const mag = Math.hypot(o.vx, o.vy) || 1;
      o.vx = (o.vx / mag) * sp; o.vy = (o.vy / mag) * sp;
      // pequeños cambios de rumbo para que no sea predecible
      if (s.t > s.jitter) {
        const a = Math.atan2(o.vy, o.vx) + (Math.random() - 0.5) * 0.9;
        o.vx = Math.cos(a) * sp; o.vy = Math.sin(a) * sp;
        s.jitter = s.t + 700 + Math.random() * 700;
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.x < 6) { o.x = 6; o.vx = Math.abs(o.vx); }
      if (o.x > 94) { o.x = 94; o.vx = -Math.abs(o.vx); }
      if (o.y < 8) { o.y = 8; o.vy = Math.abs(o.vy); }
      if (o.y > 92) { o.y = 92; o.vy = -Math.abs(o.vy); }

      // ¿enganchado?
      const p = player.current;
      const locked = p.down && Math.hypot(p.x - o.x, p.y - o.y) < LOCK_R;
      if (locked) { s.scoreMs += dt; s.offMs = 0; }
      else {
        s.offMs += dt;
        if (s.offMs >= GRACE) {
          s.offMs = 0;
          s.strikes += 1; setStrikes(s.strikes);
          if (s.strikes >= MAX_STRIKES) { finish(); return; }
        }
      }
      if (s.t > MAX_TIME) { finish(); return; }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toPct = (e) => {
    const r = arenaRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const onDown = (e) => { const q = toPct(e); player.current = { x: q.x, y: q.y, down: true }; };
  const onMove = (e) => { if (!player.current.down) return; const q = toPct(e); player.current.x = q.x; player.current.y = q.y; };
  const onUp = () => { player.current.down = false; };

  const o = orb.current, p = player.current;
  const locked = p.down && Math.hypot(p.x - o.x, p.y - o.y) < LOCK_R;
  const livesLeft = Math.max(0, MAX_STRIKES - strikes);

  return (
    <div className="flex-1 flex flex-col px-5 pb-6 select-none">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">🎯 {Math.round(st.current.scoreMs / 40)}</span>
        <span className="bg-black/30 font-black px-3 py-1.5 rounded-full text-sm">{'❤️'.repeat(livesLeft)}{'🖤'.repeat(strikes)}</span>
      </div>
      <div
        ref={arenaRef}
        className="flex-1 relative rounded-3xl overflow-hidden touch-none"
        style={{ background: 'radial-gradient(circle at 50% 40%, rgba(16,185,129,0.12), rgba(0,0,0,0.3) 70%)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.45)' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      >
        {/* halo de enganche del objetivo */}
        <div className="absolute w-24 h-24 -ml-12 -mt-12 rounded-full pointer-events-none" style={{ left: `${o.x}%`, top: `${o.y}%`, border: `2px dashed ${locked ? 'rgba(110,231,183,0.6)' : 'rgba(255,255,255,0.18)'}` }} />
        {/* objetivo (producto) */}
        <div className="absolute -ml-6 -mt-6 w-12 h-12 rounded-full flex items-center justify-center text-2xl pointer-events-none" style={{ left: `${o.x}%`, top: `${o.y}%`, background: locked ? 'radial-gradient(circle at 38% 30%, #6ee7b7, #059669)' : 'radial-gradient(circle at 38% 30%, #fcd34d, #d97706)', boxShadow: locked ? '0 0 24px rgba(16,185,129,0.8)' : '0 0 18px rgba(245,158,11,0.6)' }}>{o.emoji}</div>
        {/* cursor del dedo */}
        {p.down && (
          <div className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%`, border: `3px solid ${locked ? '#34d399' : '#f43f5e'}`, boxShadow: `0 0 14px ${locked ? '#34d399' : '#f43f5e'}` }} />
        )}
        {!p.down && (
          <p className="absolute inset-0 flex items-center justify-center text-white/40 text-sm font-bold uppercase tracking-widest pointer-events-none">Pon el dedo sobre el producto</p>
        )}
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">No lo pierdas: cada vez va más rápido</p>
      </div>
    </div>
  );
}

export function SigueGame(props) {
  return (
    <GameShell
      {...props}
      day={17} title="Rastreo" emoji="📡" accent="emerald"
      instructions={[
        <span key="1">Un producto se mueve por la pantalla. <strong>Mantén el dedo encima</strong> sin soltarlo.</span>,
        <span key="2">Mientras lo tengas <strong>enganchado</strong> (cerco verde) sumas puntos sin parar.</span>,
        <span key="3">Va cada vez <strong>más rápido</strong> y cambia de rumbo. Si lo pierdes 3 veces, eliminado.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
