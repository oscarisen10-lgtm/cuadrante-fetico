import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp , ScoreBurst } from './GameShell';

const PADDLE_Y = 88;
const PADDLE_W = 26;
const CEIL_MIN = 4;
const CEIL_MAX = 70;
const MAX_BALLS = 5;

function Play({ end }) {
  const [, render] = useState(0);
  const arenaRef = useRef(null);
  const balls = useRef([{ x: 50, y: 40, vx: 0.028, vy: 0.045 }]);
  const paddle = useRef({ x: 50 });
  const ceil = useRef(6);            // % vertical del techo (baja con el tiempo)
  const knife = useRef(null);        // { x, y, vx }
  const st = useRef({ t: 0, hits: 0, splits: 0, nextKnife: 3500, alive: true });
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (!st.current.alive) return;
      const dt = Math.min(40, now - last); last = now;
      const s = st.current;
      s.t += dt;

      // El techo baja, cada vez más rápido
      const descend = 0.00045 + s.t / 380000;
      ceil.current = clamp(ceil.current + descend * dt, CEIL_MIN, CEIL_MAX);

      // Cuchillo
      if (!knife.current && s.t > s.nextKnife) {
        const fromLeft = Math.random() < 0.5;
        const y = clamp(ceil.current + 14 + Math.random() * 22, ceil.current + 10, PADDLE_Y - 14);
        knife.current = { x: fromLeft ? -6 : 106, y, vx: (fromLeft ? 1 : -1) * (0.035 + Math.random() * 0.02) };
      }
      if (knife.current) {
        knife.current.x += knife.current.vx * dt;
        if (knife.current.x < -10 || knife.current.x > 110) { knife.current = null; s.nextKnife = s.t + 3200 + Math.random() * 2200; }
      }

      // Bolas
      const ceilY = ceil.current;
      for (const b of balls.current) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 3) { b.x = 3; b.vx = Math.abs(b.vx); }
        if (b.x > 97) { b.x = 97; b.vx = -Math.abs(b.vx); }
        if (b.y < ceilY) { b.y = ceilY; b.vy = Math.abs(b.vy); }   // rebote en el techo (que va bajando)

        // Rebote en la bandeja
        if (b.vy > 0 && b.y >= PADDLE_Y - 3 && b.y <= PADDLE_Y + 3 && Math.abs(b.x - paddle.current.x) < PADDLE_W / 2 + 3) {
          b.y = PADDLE_Y - 3;
          s.hits += 1;
          b.vy = -Math.abs(b.vy) * 1.012;
          b.vx = clamp(b.vx + (b.x - paddle.current.x) * 0.004, -0.09, 0.09);
        }
      }

      // Colisión con el cuchillo → divide la sandía y el techo sube
      if (knife.current) {
        const k = knife.current;
        for (const b of balls.current) {
          if (Math.abs(b.x - k.x) < 6 && Math.abs(b.y - k.y) < 6) {
            ceil.current = clamp(ceil.current - 13, CEIL_MIN, CEIL_MAX);  // ¡aire!
            if (balls.current.length < MAX_BALLS) {
              balls.current.push({ x: b.x, y: b.y, vx: -b.vx || 0.03, vy: -Math.abs(b.vy) * 0.9 - 0.02 });
              s.splits += 1;
            }
            knife.current = null;
            s.nextKnife = s.t + 3200 + Math.random() * 2200;
            break;
          }
        }
      }

      // ¿Se cae alguna sandía?
      if (balls.current.some(b => b.y > 108)) {
        s.alive = false;
        endRef.current(clamp(s.hits * 20 + s.splits * 40, 0, 2000));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveTo = (clientX) => {
    const rect = arenaRef.current?.getBoundingClientRect();
    if (!rect) return;
    paddle.current.x = clamp(((clientX - rect.left) / rect.width) * 100, PADDLE_W / 2, 100 - PADDLE_W / 2);
  };

  const ceilY = ceil.current;
  const danger = ceilY > 48;

  return (
    <div className="flex-1 flex flex-col px-5 pb-6">
      <ScoreBurst value={st.current.hits} color="#c4b5fd" />
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        Toques: <span className="text-violet-400">{st.current.hits}</span> · 🍉 {balls.current.length}
      </p>
      <div
        ref={arenaRef}
        className="flex-1 relative bg-black/30 border-2 border-violet-500/30 rounded-3xl overflow-hidden touch-none"
        onTouchStart={(e) => moveTo(e.touches[0].clientX)}
        onTouchMove={(e) => moveTo(e.touches[0].clientX)}
        onMouseMove={(e) => e.buttons === 1 && moveTo(e.clientX)}
        onMouseDown={(e) => moveTo(e.clientX)}
      >
        {/* Techo descendente */}
        <div className="absolute left-0 right-0 top-0 pointer-events-none" style={{ height: `${ceilY}%`, background: danger ? 'linear-gradient(180deg, rgba(190,18,60,0.28), rgba(190,18,60,0.05))' : 'linear-gradient(180deg, rgba(124,58,237,0.22), rgba(124,58,237,0.02))' }} />
        <div className="absolute left-0 right-0 pointer-events-none" style={{ top: `${ceilY}%`, height: 6, marginTop: -6, background: danger ? 'linear-gradient(180deg,#fb7185,#be123c)' : 'linear-gradient(180deg,#c4b5fd,#7c3aed)', boxShadow: danger ? '0 4px 16px rgba(225,29,72,0.6)' : '0 4px 14px rgba(124,58,237,0.5)' }} />

        {balls.current.map((b, i) => (
          <div key={i} className="absolute text-3xl -ml-4 -mt-4 drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]" style={{ left: `${b.x}%`, top: `${b.y}%` }}>🍉</div>
        ))}

        {knife.current && (
          <div className="absolute text-3xl -ml-4 -mt-4" style={{ left: `${knife.current.x}%`, top: `${knife.current.y}%`, filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.7))', transform: `scaleX(${knife.current.vx > 0 ? -1 : 1})` }}>🔪</div>
        )}

        <div
          className="absolute h-3.5 rounded-full border-b-2 border-violet-700"
          style={{ left: `${paddle.current.x - PADDLE_W / 2}%`, width: `${PADDLE_W}%`, top: `${PADDLE_Y}%`, background: 'linear-gradient(180deg, #c4b5fd, #7c3aed)', boxShadow: '0 0 14px rgba(124,58,237,0.6)' }}
        />
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Arrastra la bandeja · toca el 🔪 con la sandía para ganar aire
        </p>
      </div>
    </div>
  );
}

export function MalabaresGame(props) {
  return (
    <GameShell
      {...props}
      day={23} title="Malabares" emoji="🍉" accent="violet"
      instructions={[
        <span key="1">¡Que no caiga la sandía! Mantenla en el aire con tu <strong>bandeja</strong> (arrastra el dedo).</span>,
        <span key="2">El <strong>techo va bajando</strong> cada vez más rápido y reduce tu espacio.</span>,
        <span key="3">Si una sandía toca el <strong>cuchillo 🔪</strong> se <strong>parte en dos</strong>… pero el techo sube y ganas aire. ¡Decide!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
