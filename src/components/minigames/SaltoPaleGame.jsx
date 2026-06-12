import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const GROUND = 78;     // % vertical del suelo
const GRAVITY = 0.0028;
const JUMP_V = -1.05;

function Play({ end }) {
  const [, render] = useState(0);
  const runner = useRef({ y: GROUND, vy: 0, onGround: true });
  const obstacles = useRef([]); // {id, x}
  const st = useRef({ t: 0, passed: 0, nextSpawn: 800, alive: true });
  const idRef = useRef(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      const s = st.current;
      s.t += dt;

      // Física del corredor
      const r = runner.current;
      if (!r.onGround) {
        r.vy += GRAVITY * dt;
        r.y += r.vy * dt * 0.1;
        if (r.y >= GROUND) { r.y = GROUND; r.vy = 0; r.onGround = true; }
      }

      // Obstáculos
      if (s.t > s.nextSpawn) {
        obstacles.current.push({ id: idRef.current++, x: 105 });
        s.nextSpawn = s.t + Math.max(750, 1500 - s.t / 60) + Math.random() * 500;
      }
      const speed = 0.045 + s.t / 120000;
      for (const o of obstacles.current) {
        o.x -= speed * dt;
        // Colisión: obstáculo en la zona del corredor (x≈14%) y corredor bajo
        if (o.x > 9 && o.x < 19 && r.y > GROUND - 9) s.alive = false;
      }
      const before = obstacles.current.length;
      obstacles.current = obstacles.current.filter(o => o.x > -10);
      s.passed += before - obstacles.current.length;

      if (!s.alive || s.t > 60000) {
        end(clamp(s.passed * 50, 0, 1500));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [end]);

  const jump = () => {
    const r = runner.current;
    if (r.onGround) { r.vy = JUMP_V; r.onGround = false; }
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6 select-none" onPointerDown={jump}>
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        Palés saltados: <span className="text-lime-400">{st.current.passed}</span>
      </p>
      <div className="flex-1 relative bg-black/30 border-2 border-lime-500/30 rounded-3xl overflow-hidden touch-none">
        {/* Suelo */}
        <div className="absolute left-0 right-0 bg-lime-900/40 border-t-2 border-lime-500/40" style={{ top: `${GROUND + 8}%`, bottom: 0 }} />
        {/* Corredor */}
        <div className="absolute text-4xl -ml-5 -mt-8 transition-none" style={{ left: '14%', top: `${runner.current.y}%` }}>
          {runner.current.onGround ? '🏃' : '🤸'}
        </div>
        {/* Obstáculos */}
        {obstacles.current.map(o => (
          <div key={o.id} className="absolute text-3xl -ml-4 -mt-7" style={{ left: `${o.x}%`, top: `${GROUND + 1}%` }}>🪵</div>
        ))}
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Toca en cualquier sitio para saltar
        </p>
      </div>
    </div>
  );
}

export function SaltoPaleGame(props) {
  return (
    <GameShell
      {...props}
      day={21} title="Salto del Palé" emoji="🤸" accent="lime"
      instructions={[
        <span key="1">Corres por el almacén y hay <strong>palés tirados</strong> por el camino.</span>,
        <span key="2"><strong>Toca la pantalla</strong> para saltarlos.</span>,
        <span key="3">Cada palé saltado son 50 puntos. La velocidad va subiendo. 🏃💨</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
