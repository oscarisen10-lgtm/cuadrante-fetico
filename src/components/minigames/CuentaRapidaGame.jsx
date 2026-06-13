import React, { useState, useEffect, useRef } from 'react';
import { GameShell, shuffle, rand } from './GameShell';

const POOL = ['🍎', '🍌', '🥕', '🧀', '🥛', '🍞', '🐟', '🍇'];
const TOTAL_ROUNDS = 6;

const makeRound = () => {
  const types = shuffle(POOL).slice(0, 3);
  const target = types[0];
  const targetCount = rand(4, 9);
  const items = [];
  types.forEach((t, ti) => {
    const count = ti === 0 ? targetCount : rand(3, 7);
    for (let i = 0; i < count; i++) {
      items.push({ id: `${ti}-${i}`, emoji: t, x: rand(5, 88), y: rand(5, 84), rot: rand(-30, 30) });
    }
  });
  const opts = new Set([targetCount]);
  while (opts.size < 3) {
    const d = targetCount + rand(1, 2) * (Math.random() < 0.5 ? -1 : 1);
    if (d > 0) opts.add(d);
  }
  return { target, targetCount, items: shuffle(items), options: shuffle([...opts]) };
};

function Play({ end }) {
  const [round, setRound] = useState(1);
  const [data, setData] = useState(makeRound);
  const [phase, setPhase] = useState('show'); // show | ask | feedback
  const okRef = useRef(0);

  useEffect(() => {
    if (phase !== 'show') return;
    const id = setTimeout(() => setPhase('ask'), 3200);
    return () => clearTimeout(id);
  }, [phase, round]);

  const answer = (val) => {
    if (phase !== 'ask') return;
    if (val === data.targetCount) okRef.current += 1;
    setPhase('feedback');
    setTimeout(() => {
      if (round >= TOTAL_ROUNDS) {
        end(okRef.current * 150 + (okRef.current === TOTAL_ROUNDS ? 100 : 0));
      } else {
        setRound(r => r + 1);
        setData(makeRound());
        setPhase('show');
      }
    }, 900);
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6">
      <div className="flex items-center justify-center gap-4 mb-3">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">Ronda {round}/{TOTAL_ROUNDS}</span>
        <span className="bg-black/30 text-amber-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
      </div>

      {phase === 'show' ? (
        <>
          <p className="text-center text-amber-400 font-black uppercase tracking-widest text-xs mb-3 animate-pulse">👀 ¡Memoriza la estantería!</p>
          <div className="flex-1 relative bg-black/30 border-2 border-amber-500/30 rounded-3xl overflow-hidden">
            {data.items.map(it => (
              <div key={it.id} className="absolute text-3xl" style={{ left: `${it.x}%`, top: `${it.y}%`, transform: `rotate(${it.rot}deg)` }}>
                {it.emoji}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-4">{phase === 'feedback' ? 'Siguiente ronda...' : '¿Cuántos había de este?'}</p>
          <div className="bg-black/40 border border-amber-500/30 rounded-full w-28 h-28 flex items-center justify-center mb-8">
            <span className="text-6xl">{data.target}</span>
          </div>
          <div className="flex gap-4">
            {data.options.map(o => (
              <button
                key={o}
                onPointerDown={() => answer(o)}
                disabled={phase === 'feedback'}
                className="w-20 h-20 text-amber-950 font-black text-3xl rounded-2xl border-b-4 border-amber-800 active:scale-90 transition-transform disabled:opacity-50"
                style={{ background: 'linear-gradient(160deg, #fde68a, #f59e0b)', boxShadow: '0 5px 14px rgba(245,158,11,0.4), inset 0 2px 5px rgba(255,255,255,0.5)' }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CuentaRapidaGame(props) {
  return (
    <GameShell
      {...props}
      day={29} title="Cuenta Rápida" emoji="🧺" accent="amber"
      instructions={[
        <span key="1">Verás una estantería revuelta durante <strong>3 segundos</strong>.</span>,
        <span key="2">Después te preguntaremos <strong>cuántas unidades</strong> había de un producto.</span>,
        <span key="3">6 rondas, 150 puntos por acierto y bonus por pleno. ¡Ojo de inventario!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
