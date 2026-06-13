import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const PADDLE_Y = 88;   // % vertical de la pala
const PADDLE_W = 26;   // ancho de la pala (%)

function Play({ end }) {
  const [, render] = useState(0);
  const arenaRef = useRef(null);
  const ball = useRef({ x: 50, y: 30, vx: 0.028, vy: 0.045 });
  const paddle = useRef({ x: 50 });
  const st = useRef({ hits: 0 });

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      const b = ball.current;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Rebotes en paredes y techo
      if (b.x < 3) { b.x = 3; b.vx = Math.abs(b.vx); }
      if (b.x > 97) { b.x = 97; b.vx = -Math.abs(b.vx); }
      if (b.y < 3) { b.y = 3; b.vy = Math.abs(b.vy); }

      // Rebote en la pala
      if (b.vy > 0 && b.y >= PADDLE_Y - 3 && b.y <= PADDLE_Y + 3 && Math.abs(b.x - paddle.current.x) < PADDLE_W / 2 + 3) {
        b.y = PADDLE_Y - 3;
        st.current.hits += 1;
        const speedup = 1 + Math.min(0.5, st.current.hits * 0.02);
        b.vy = -Math.abs(b.vy) * 1.015;
        b.vx += (b.x - paddle.current.x) * 0.004 * speedup;
        b.vx = clamp(b.vx, -0.09, 0.09);
      }

      // Bola perdida
      if (b.y > 108) {
        end(clamp(st.current.hits * 30, 0, 1500));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [end]);

  const moveTo = (clientX) => {
    const rect = arenaRef.current?.getBoundingClientRect();
    if (!rect) return;
    paddle.current.x = clamp(((clientX - rect.left) / rect.width) * 100, PADDLE_W / 2, 100 - PADDLE_W / 2);
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6">
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        Toques: <span className="text-violet-400">{st.current.hits}</span>
      </p>
      <div
        ref={arenaRef}
        className="flex-1 relative bg-black/30 border-2 border-violet-500/30 rounded-3xl overflow-hidden touch-none"
        onTouchStart={(e) => moveTo(e.touches[0].clientX)}
        onTouchMove={(e) => moveTo(e.touches[0].clientX)}
        onMouseMove={(e) => e.buttons === 1 && moveTo(e.clientX)}
        onMouseDown={(e) => moveTo(e.clientX)}
      >
        <div className="absolute text-3xl -ml-4 -mt-4" style={{ left: `${ball.current.x}%`, top: `${ball.current.y}%` }}>🍉</div>
        <div
          className="absolute h-3.5 rounded-full border-b-2 border-violet-700"
          style={{ left: `${paddle.current.x - PADDLE_W / 2}%`, width: `${PADDLE_W}%`, top: `${PADDLE_Y}%`, background: 'linear-gradient(180deg, #c4b5fd, #7c3aed)', boxShadow: '0 0 14px rgba(124,58,237,0.6)' }}
        />
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Arrastra para mover la bandeja
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
        <span key="1">¡Que no caiga la sandía! Mantenla en el aire con tu <strong>bandeja</strong>.</span>,
        <span key="2"><strong>Arrastra el dedo</strong> para mover la bandeja por la pantalla.</span>,
        <span key="3">Cada toque son 30 puntos… y la bola va cada vez más rápida.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
