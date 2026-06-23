import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand , ScoreBurst } from './GameShell';

const GRAVITY = 0.0021;
const FLAP_V = -0.62;
const GAP = 30;        // hueco entre estanterías (%)
const PIPE_W = 12;     // ancho de estantería (%)
const CART_X = 22;     // posición horizontal del carrito (%)

function Play({ end }) {
  const [, render] = useState(0);
  const cart = useRef({ y: 45, vy: 0 });
  const pipes = useRef([]); // {id, x, gapY, passed}
  const st = useRef({ t: 0, score: 0, nextSpawn: 0, alive: true });
  const idRef = useRef(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      const s = st.current;
      s.t += dt;

      // Física del carrito
      const c = cart.current;
      c.vy += GRAVITY * dt;
      c.y += c.vy * dt * 0.12;
      if (c.y < 2 || c.y > 94) s.alive = false;

      // Estanterías
      if (s.t > s.nextSpawn) {
        pipes.current.push({ id: idRef.current++, x: 108, gapY: rand(16, 84 - GAP), passed: false });
        s.nextSpawn = s.t + 2100;
      }
      const speed = 0.032 + s.t / 200000;
      for (const p of pipes.current) {
        p.x -= speed * dt;
        // Colisión con la estantería (parte superior o inferior)
        if (p.x < CART_X + 5 && p.x + PIPE_W > CART_X - 5) {
          if (c.y < p.gapY || c.y > p.gapY + GAP) s.alive = false;
        }
        if (!p.passed && p.x + PIPE_W < CART_X - 5) {
          p.passed = true;
          s.score += 1;
        }
      }
      pipes.current = pipes.current.filter(p => p.x > -20);

      if (!s.alive) {
        end(clamp(s.score * 70, 0, 1500));
        return;
      }
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flap = () => { cart.current.vy = FLAP_V; };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6 select-none" onPointerDown={flap}>
      <ScoreBurst value={st.current.score} color="#67e8f9" />
      <p className="text-center text-white/60 font-bold uppercase tracking-widest text-xs mb-3">
        Pasillos cruzados: <span className="text-cyan-400">{st.current.score}</span>
      </p>
      <div className="flex-1 relative bg-black/30 border-2 border-cyan-500/30 rounded-3xl overflow-hidden touch-none">
        {pipes.current.map(p => (
          <React.Fragment key={p.id}>
            <div className="absolute bg-cyan-800/80 border-2 border-cyan-600 rounded-b-xl flex items-end justify-center pb-1 text-lg"
              style={{ left: `${p.x}%`, top: 0, width: `${PIPE_W}%`, height: `${p.gapY}%` }}>🗄️</div>
            <div className="absolute bg-cyan-800/80 border-2 border-cyan-600 rounded-t-xl flex items-start justify-center pt-1 text-lg"
              style={{ left: `${p.x}%`, top: `${p.gapY + GAP}%`, width: `${PIPE_W}%`, bottom: 0 }}>🗄️</div>
          </React.Fragment>
        ))}
        <div className="absolute text-4xl -ml-5 -mt-5" style={{ left: `${CART_X}%`, top: `${cart.current.y}%`, transform: `rotate(${clamp(cart.current.vy * 40, -25, 45)}deg)` }}>🛒</div>
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Toca para impulsar el carrito hacia arriba
        </p>
      </div>
    </div>
  );
}

export function CarritoVoladorGame(props) {
  return (
    <GameShell
      {...props}
      day={22} title="Carrito Volador" emoji="🛒" accent="cyan"
      instructions={[
        <span key="1">Tu carrito vuela por el almacén. <strong>Toca para impulsarlo</strong> hacia arriba.</span>,
        <span key="2">Pasa entre los huecos de las <strong>estanterías</strong> sin chocar.</span>,
        <span key="3">Cada pasillo cruzado son 70 puntos. ¡No toques el suelo ni el techo!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
