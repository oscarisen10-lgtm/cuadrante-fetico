import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const SIZE = 13; // tablero 13x13

function Play({ end }) {
  const [, forceRender] = useState(0);
  const snake = useRef([{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }]);
  const dir = useRef({ x: 1, y: 0 });
  const nextDir = useRef({ x: 1, y: 0 });
  const food = useRef({ x: 9, y: 6 });
  const apples = useRef(0);
  const touchStart = useRef(null);

  const placeFood = () => {
    let p;
    do { p = { x: rand(0, SIZE - 1), y: rand(0, SIZE - 1) }; }
    while (snake.current.some(s => s.x === p.x && s.y === p.y));
    food.current = p;
  };

  useEffect(() => {
    const id = setInterval(() => {
      dir.current = nextDir.current;
      const head = snake.current[0];
      const nh = { x: head.x + dir.current.x, y: head.y + dir.current.y };
      const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= SIZE || nh.y >= SIZE;
      const hitSelf = snake.current.some(s => s.x === nh.x && s.y === nh.y);
      if (hitWall || hitSelf) {
        clearInterval(id);
        end(clamp(apples.current * 50, 0, 1500));
        return;
      }
      snake.current = [nh, ...snake.current];
      if (nh.x === food.current.x && nh.y === food.current.y) {
        apples.current += 1;
        placeFood();
      } else {
        snake.current.pop();
      }
      forceRender(n => n + 1);
    }, 170);
    return () => clearInterval(id);
  }, [end]);

  const turn = (dx, dy) => {
    // No permitir giro de 180º
    if (dx === -dir.current.x && dy === -dir.current.y) return;
    nextDir.current = { x: dx, y: dy };
  };

  const onTouchStart = (e) => { const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy));
    touchStart.current = null;
  };

  const cell = 100 / SIZE;
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pb-4 select-none">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-3">🍎 Manzanas: <span className="text-lime-400">{apples.current}</span></p>
      <div
        className="relative w-full max-w-sm aspect-square bg-black/40 border-2 border-lime-500/30 rounded-2xl overflow-hidden touch-none"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        {snake.current.map((s, i) => (
          <div key={i} className={`absolute rounded ${i === 0 ? 'bg-lime-300' : 'bg-lime-500'}`}
            style={{ left: `${s.x * cell}%`, top: `${s.y * cell}%`, width: `${cell}%`, height: `${cell}%`, transform: 'scale(0.9)' }} />
        ))}
        <div className="absolute flex items-center justify-center text-base"
          style={{ left: `${food.current.x * cell}%`, top: `${food.current.y * cell}%`, width: `${cell}%`, height: `${cell}%` }}>🍎</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 w-44">
        <div></div>
        <button onPointerDown={() => turn(0, -1)} className="bg-white/10 text-white rounded-xl py-2.5 font-black active:bg-white/30">▲</button>
        <div></div>
        <button onPointerDown={() => turn(-1, 0)} className="bg-white/10 text-white rounded-xl py-2.5 font-black active:bg-white/30">◀</button>
        <button onPointerDown={() => turn(0, 1)} className="bg-white/10 text-white rounded-xl py-2.5 font-black active:bg-white/30">▼</button>
        <button onPointerDown={() => turn(1, 0)} className="bg-white/10 text-white rounded-xl py-2.5 font-black active:bg-white/30">▶</button>
      </div>
    </div>
  );
}

export function SerpienteGame(props) {
  return (
    <GameShell
      {...props}
      day={11} title="La Serpiente" emoji="🐍" accent="lime"
      instructions={[
        <span key="1">Guía a la serpiente para <strong>comer manzanas</strong> (50 puntos cada una).</span>,
        <span key="2">Controla con <strong>deslizamientos</strong> sobre el tablero o con las flechas.</span>,
        <span key="3">No choques contra las paredes ni contra ti mismo.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
