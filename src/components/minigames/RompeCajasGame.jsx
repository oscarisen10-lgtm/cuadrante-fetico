import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const PADDLE_Y = 90;
const PADDLE_W = 24;
const COLS = 6, ROWS = 5;
const BRICK_W = 100 / COLS, BRICK_H = 5;
const BRICK_TOP = 8;
const BRICK_COLORS = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500'];

function Play({ end }) {
  const [, render] = useState(0);
  const arenaRef = useRef(null);
  const ball = useRef({ x: 50, y: 60, vx: 0.03, vy: -0.05 });
  const paddle = useRef({ x: 50 });
  const bricks = useRef(Array.from({ length: COLS * ROWS }, (_, i) => i)); // índices vivos
  const st = useRef({ score: 0 });

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      const b = ball.current;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx); }
      if (b.x > 98) { b.x = 98; b.vx = -Math.abs(b.vx); }
      if (b.y < 2) { b.y = 2; b.vy = Math.abs(b.vy); }

      // Colisión con ladrillos
      const hitIdx = bricks.current.find(i => {
        const r = Math.floor(i / COLS), c = i % COLS;
        const bx = c * BRICK_W, by = BRICK_TOP + r * (BRICK_H + 1);
        return b.x > bx - 1 && b.x < bx + BRICK_W + 1 && b.y > by - 2 && b.y < by + BRICK_H + 2;
      });
      if (hitIdx !== undefined) {
        bricks.current = bricks.current.filter(i => i !== hitIdx);
        st.current.score += 20;
        b.vy = -b.vy;
        if (bricks.current.length === 0) {
          end(clamp(st.current.score + 300, 0, 1000));
          return;
        }
      }

      // Pala
      if (b.vy > 0 && b.y >= PADDLE_Y - 2.5 && b.y <= PADDLE_Y + 3 && Math.abs(b.x - paddle.current.x) < PADDLE_W / 2 + 3) {
        b.y = PADDLE_Y - 2.5;
        b.vy = -Math.abs(b.vy) * 1.01;
        b.vx = clamp(b.vx + (b.x - paddle.current.x) * 0.004, -0.08, 0.08);
      }

      // Bola perdida
      if (b.y > 108) {
        end(clamp(st.current.score, 0, 1000));
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
        Puntos: <span className="text-orange-400">{st.current.score}</span> · Cajas: {bricks.current.length}
      </p>
      <div
        ref={arenaRef}
        className="flex-1 relative bg-black/30 border-2 border-orange-500/30 rounded-3xl overflow-hidden touch-none"
        onTouchStart={(e) => moveTo(e.touches[0].clientX)}
        onTouchMove={(e) => moveTo(e.touches[0].clientX)}
        onMouseMove={(e) => e.buttons === 1 && moveTo(e.clientX)}
        onMouseDown={(e) => moveTo(e.clientX)}
      >
        {bricks.current.map(i => {
          const r = Math.floor(i / COLS), c = i % COLS;
          return (
            <div
              key={i}
              className={`absolute rounded ${BRICK_COLORS[r]} border-b-2 border-black/30`}
              style={{ left: `${c * BRICK_W + 0.5}%`, top: `${BRICK_TOP + r * (BRICK_H + 1)}%`, width: `${BRICK_W - 1}%`, height: `${BRICK_H}%` }}
            />
          );
        })}
        <div className="absolute w-4 h-4 -ml-2 -mt-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ left: `${ball.current.x}%`, top: `${ball.current.y}%` }} />
        <div className="absolute h-3.5 rounded-full border-b-2 border-orange-700" style={{ left: `${paddle.current.x - PADDLE_W / 2}%`, width: `${PADDLE_W}%`, top: `${PADDLE_Y}%`, background: 'linear-gradient(180deg, #fdba74, #ea580c)', boxShadow: '0 0 14px rgba(249,115,22,0.6)' }} />
      </div>
    </div>
  );
}

export function RompeCajasGame(props) {
  return (
    <GameShell
      {...props}
      day={24} title="Rompe Cajas" emoji="🧱" accent="orange"
      instructions={[
        <span key="1">Destruye todas las <strong>cajas del almacén</strong> rebotando la bola.</span>,
        <span key="2"><strong>Arrastra</strong> para mover la pala. Solo tienes 1 bola, ¡no la pierdas!</span>,
        <span key="3">Cada caja son 20 puntos. Vaciar el almacén da +300 de bonus.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
