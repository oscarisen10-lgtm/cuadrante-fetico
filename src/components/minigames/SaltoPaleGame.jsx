import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const GROUND = 74;        // % vertical del suelo (pies del corredor)
const GRAVITY = 0.0030;
const JUMP_V = -1.18;
const MAX_TIME = 60000;

function Play({ end }) {
  const [, render] = useState(0);
  const runner = useRef({ y: GROUND, vy: 0, onGround: true });
  const holdRef = useRef(false);
  const obstacles = useRef([]);  // {id, x, h}  h = alto del palé (%)
  const coins = useRef([]);      // {id, x, y}
  const shelves = useRef([{ x: 30 }, { x: 75 }, { x: 120 }]);
  const st = useRef({ t: 0, passed: 0, picked: 0, nextOb: 700, nextCoin: 1400, alive: true });
  const idRef = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (!st.current.alive) return;
      const dt = Math.min(40, now - last); last = now;
      const s = st.current;
      s.t += dt;
      const speed = 0.045 + s.t / 130000;

      // Física: salto de altura variable (flota mientras mantienes pulsado y subes)
      const r = runner.current;
      if (!r.onGround) {
        const g = (holdRef.current && r.vy < 0) ? GRAVITY * 0.45 : GRAVITY;
        r.vy += g * dt;
        r.y += r.vy * dt * 0.1;
        if (r.y >= GROUND) { r.y = GROUND; r.vy = 0; r.onGround = true; }
      }

      // Estanterías de fondo (parallax lento)
      for (const sh of shelves.current) { sh.x -= speed * dt * 0.35; if (sh.x < -25) sh.x += 150; }

      // Generar palés
      if (s.t > s.nextOb) {
        obstacles.current.push({ id: idRef.current++, x: 106, h: rand(0, 2) === 0 ? 13 : 8 });
        s.nextOb = s.t + Math.max(680, 1350 - s.t / 70) + Math.random() * 500;
      }
      // Generar cajas coleccionables (a media altura, premian saltos buenos)
      if (s.t > s.nextCoin) {
        coins.current.push({ id: idRef.current++, x: 106, y: GROUND - rand(14, 26) });
        s.nextCoin = s.t + 1200 + Math.random() * 1400;
      }

      // Mover y comprobar palés
      for (const o of obstacles.current) {
        o.x -= speed * dt;
        if (o.x > 8 && o.x < 20 && r.y > GROUND - o.h) s.alive = false;
      }
      const before = obstacles.current.length;
      obstacles.current = obstacles.current.filter(o => o.x > -8);
      s.passed += before - obstacles.current.length;

      // Mover y recoger cajas
      for (const c of coins.current) c.x -= speed * dt;
      coins.current = coins.current.filter(c => {
        if (c.x > 8 && c.x < 20 && Math.abs(r.y - c.y) < 8) { s.picked += 1; return false; }
        return c.x > -8;
      });

      if (!s.alive || s.t > MAX_TIME) {
        endRef.current(clamp(s.passed * 50 + s.picked * 25, 0, 2000));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const down = () => { const r = runner.current; if (r.onGround) { r.vy = JUMP_V; r.onGround = false; } holdRef.current = true; };
  const up = () => { holdRef.current = false; };

  const r = runner.current;
  const airborne = !r.onGround;

  return (
    <div className="flex-1 flex flex-col px-5 pb-6 select-none" onPointerDown={down} onPointerUp={up} onPointerLeave={up}>
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        Palés <span className="text-lime-400">{st.current.passed}</span> · Cajas <span className="text-amber-300">{st.current.picked}</span>
      </p>
      <div
        className="flex-1 relative rounded-3xl overflow-hidden touch-none"
        style={{ background: 'linear-gradient(180deg, #1a2e05 0%, #0f1c03 60%, #0a1402 100%)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.45)' }}
      >
        {/* Estanterías de fondo */}
        {shelves.current.map((sh, i) => (
          <div key={i} className="absolute opacity-20" style={{ left: `${sh.x}%`, top: '24%', width: '20%', height: '46%' }}>
            <div className="w-full h-full rounded" style={{ background: 'repeating-linear-gradient(180deg,#3f6212 0 8px,transparent 8px 22px)' }} />
          </div>
        ))}

        {/* Suelo */}
        <div className="absolute left-0 right-0" style={{ top: `${GROUND + 4}%`, bottom: 0, background: 'linear-gradient(180deg,#3f6212,#1a2e05)', boxShadow: 'inset 0 3px 0 rgba(163,230,53,0.4)' }} />

        {/* Cajas coleccionables */}
        {coins.current.map(c => (
          <div key={c.id} className="absolute -ml-4 -mt-4 w-8 h-8 rounded-md flex items-center justify-center text-base"
            style={{ left: `${c.x}%`, top: `${c.y}%`, background: 'linear-gradient(160deg,#fde68a,#f59e0b)', boxShadow: '0 0 14px rgba(245,158,11,0.7), inset 0 2px 3px rgba(255,255,255,0.5)' }}>📦</div>
        ))}

        {/* Corredor */}
        <div className="absolute -ml-5" style={{ left: '14%', top: `${r.y}%`, transform: `translateY(-100%) rotate(${airborne ? -18 : 0}deg)`, transition: 'transform 0.08s', fontSize: 38 }}>
          {airborne ? '🤸' : '🏃'}
        </div>

        {/* Palés */}
        {obstacles.current.map(o => (
          <div key={o.id} className="absolute -ml-5" style={{ left: `${o.x}%`, top: `${GROUND}%`, width: 40, height: `${o.h}%`, transform: 'translateY(-100%)' }}>
            <div className="w-full h-full rounded-sm" style={{ background: 'repeating-linear-gradient(90deg,#a16207 0 6px,#854d0e 6px 12px)', boxShadow: '0 3px 8px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.25)', border: '1px solid #713f12' }} />
          </div>
        ))}

        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Mantén pulsado para saltar más alto · coge las 📦
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
        <span key="1">Corres por el almacén esquivando <strong>palés</strong> de distintas alturas.</span>,
        <span key="2"><strong>Mantén pulsado</strong> para saltar más alto y llegar a las <strong>cajas 📦</strong> (bonus).</span>,
        <span key="3">Cada palé son 50 pts y cada caja 25. La velocidad va subiendo. 🏃💨</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
