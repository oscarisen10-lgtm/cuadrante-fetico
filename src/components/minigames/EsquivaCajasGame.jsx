import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const MAX_TIME = 60; // tope de partida en segundos

function Play({ end }) {
  const [, render] = useState(0);
  const arenaRef = useRef(null);
  const player = useRef({ x: 50 }); // % horizontal
  const boxes = useRef([]); // {id, x, y, speed}
  const stateRef = useRef({ t: 0, dodged: 0, nextSpawn: 0, alive: true });
  const idRef = useRef(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      const st = stateRef.current;
      st.t += dt;

      // Generación de cajas (cada vez más frecuente)
      if (st.t > st.nextSpawn) {
        boxes.current.push({ id: idRef.current++, x: rand(4, 92), y: -8, speed: 0.035 + st.t / 90000 });
        st.nextSpawn = st.t + Math.max(280, 750 - st.t / 90);
      }

      // Movimiento y colisiones (coordenadas en %)
      const px = player.current.x;
      for (const b of boxes.current) {
        b.y += b.speed * dt;
        if (b.y > 84 && b.y < 97 && Math.abs(b.x - px) < 10) {
          st.alive = false;
        }
      }
      const before = boxes.current.length;
      boxes.current = boxes.current.filter(b => b.y < 105);
      st.dodged += before - boxes.current.length;

      if (!st.alive || st.t > MAX_TIME * 1000) {
        end(clamp(Math.floor(st.t / 1000) * 20 + st.dodged * 5, 0, 1500));
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
    player.current.x = clamp(((clientX - rect.left) / rect.width) * 100, 5, 95);
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6">
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        ⏱ {Math.floor(stateRef.current.t / 1000)}s · Esquivadas: {stateRef.current.dodged}
      </p>
      <div
        ref={arenaRef}
        className="flex-1 relative bg-black/30 border-2 border-orange-500/30 rounded-3xl overflow-hidden touch-none"
        onTouchStart={(e) => moveTo(e.touches[0].clientX)}
        onTouchMove={(e) => moveTo(e.touches[0].clientX)}
        onMouseMove={(e) => e.buttons === 1 && moveTo(e.clientX)}
        onMouseDown={(e) => moveTo(e.clientX)}
      >
        {boxes.current.map(b => (
          <div key={b.id} className="absolute text-3xl -ml-4 -mt-4" style={{ left: `${b.x}%`, top: `${b.y}%` }}>📦</div>
        ))}
        <div className="absolute text-4xl -ml-5" style={{ left: `${player.current.x}%`, top: '86%' }}>🛒</div>
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Arrastra el dedo para mover el carro
        </p>
      </div>
    </div>
  );
}

export function EsquivaCajasGame(props) {
  return (
    <GameShell
      {...props}
      day={20} title="Esquiva Cajas" emoji="📦" accent="orange"
      instructions={[
        <span key="1">¡Se ha caído la estantería! Llueven cajas del almacén.</span>,
        <span key="2"><strong>Arrastra el dedo</strong> para mover tu carro y esquivarlas.</span>,
        <span key="3">Cada segundo vivo son 20 puntos. La cosa se acelera… 😅</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
