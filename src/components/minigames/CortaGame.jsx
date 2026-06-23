import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const DURATION = 60;
const FRUITS = ['🍎', '🍊', '🍋', '🍉', '🍓', '🥝', '🍇', '🍌', '🥥', '🍅', '🫐'];

function Play({ end }) {
  const [, render] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);

  const arenaRef = useRef(null);
  const itemsRef = useRef([]); // { id, x, y, vx, vy, bomb, emoji, sliced }
  const bladeRef = useRef({ x: 0, y: 0, lx: 0, ly: 0, down: false });
  const scoreRef = useRef(0);
  const idRef = useRef(0);
  const stRef = useRef({ t: 0, nextSpawn: 0, alive: true });
  const endRef = useRef(end);
  endRef.current = end;

  const finish = () => { stRef.current.alive = false; endRef.current(clamp(scoreRef.current, 0, 2500)); };

  // Temporizador
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; }), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Física + generación + corte (rAF, una sola vez)
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      if (!stRef.current.alive) return;
      const dt = Math.min(40, now - last); last = now;
      const st = stRef.current; st.t += dt;

      // lanzar productos en arco
      if (st.t > st.nextSpawn) {
        const bomb = Math.random() < Math.min(0.12 + st.t / 320000, 0.26);
        const x = rand(15, 85);
        itemsRef.current.push({
          id: idRef.current++, x, y: 106,
          vx: (50 - x) * 0.0011 + (Math.random() - 0.5) * 0.018,
          vy: -(0.112 + Math.random() * 0.016),
          bomb, emoji: bomb ? '💣' : FRUITS[rand(0, FRUITS.length - 1)], sliced: false,
        });
        st.nextSpawn = st.t + Math.max(360, 820 - st.t / 110);
      }

      // gravedad
      for (const it of itemsRef.current) {
        it.vy += 0.00008 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
      }

      // corte con la cuchilla (dedo en movimiento)
      const b = bladeRef.current;
      if (b.down) {
        const speed = Math.abs(b.x - b.lx) + Math.abs(b.y - b.ly);
        if (speed > 0.8) {
          for (const it of itemsRef.current) {
            if (it.sliced) continue;
            if (Math.abs(it.x - b.x) < 11 && Math.abs(it.y - b.y) < 11) {
              it.sliced = true;
              if (it.bomb) { finish(); return; }
              scoreRef.current += 15; setScore(scoreRef.current);
            }
          }
        }
        b.lx = b.x; b.ly = b.y;
      }

      itemsRef.current = itemsRef.current.filter(it => it.y < 122 && !it.sliced);
      render(n => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toPct = (cx, cy) => {
    const r = arenaRef.current.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 };
  };
  const onDown = (e) => { const p = toPct(e.clientX, e.clientY); bladeRef.current = { x: p.x, y: p.y, lx: p.x, ly: p.y, down: true }; };
  const onMove = (e) => { if (!bladeRef.current.down) return; const p = toPct(e.clientX, e.clientY); bladeRef.current.x = p.x; bladeRef.current.y = p.y; };
  const onUp = () => { bladeRef.current.down = false; };

  return (
    <div className="flex-1 flex flex-col px-5 pb-5 select-none">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className={`hud-chip font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="hud-chip text-lime-400 font-black px-4 py-1.5 rounded-full text-sm">🔪 {score}</span>
      </div>
      <div
        ref={arenaRef}
        className="flex-1 relative rounded-3xl overflow-hidden touch-none"
        style={{ background: 'radial-gradient(circle at 50% 120%, rgba(132,204,22,0.14), rgba(0,0,0,0.25) 65%)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4)' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      >
        {itemsRef.current.map(it => (
          <div key={it.id} className="absolute text-6xl -ml-7 -mt-7 pointer-events-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)]" style={{ left: `${it.x}%`, top: `${it.y}%` }}>{it.emoji}</div>
        ))}
        {bladeRef.current.down && (
          <div className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full pointer-events-none" style={{ left: `${bladeRef.current.x}%`, top: `${bladeRef.current.y}%`, background: 'radial-gradient(circle, rgba(255,255,255,0.95), transparent 70%)', boxShadow: '0 0 18px #fff, 0 0 34px #a3e635' }} />
        )}
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">Desliza para cortar · ¡no cortes las 💣!</p>
      </div>
    </div>
  );
}

export function CortaGame(props) {
  return (
    <GameShell
      {...props}
      day={16} title="Corta" emoji="🔪" accent="lime"
      instructions={[
        <span key="1">Los productos salen volando por el aire en arcos.</span>,
        <span key="2"><strong>Desliza el dedo</strong> para cortarlos al vuelo (15 puntos cada uno).</span>,
        <span key="3">¡Cuidado con las <strong>bombas 💣</strong>! Si cortas una, fin de la partida. Tienes 60 s.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
