import React, { useState, useEffect, useRef } from 'react';
import { GameShell, shuffle, rand } from './GameShell';

const POOL = ['🍎', '🍌', '🥕', '🧀', '🥛', '🍞', '🐟', '🍇'];
const TOTAL_ROUNDS = 6;
const SHOW_MS = 3200;
const SHELVES = 4;
const SHELF_TOP = [22, 42, 62, 82];  // % de la superficie de cada balda

const makeRound = () => {
  const types = shuffle(POOL).slice(0, 3);
  const target = types[0];
  const targetCount = rand(4, 9);
  const items = [];
  types.forEach((t, ti) => {
    const count = ti === 0 ? targetCount : rand(3, 7);
    for (let i = 0; i < count; i++) {
      items.push({ id: `${ti}-${i}`, emoji: t, shelf: rand(0, SHELVES - 1), x: rand(8, 88) });
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
  const [phase, setPhase] = useState('show');   // show | ask | feedback
  const [picked, setPicked] = useState(null);
  const okRef = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    if (phase !== 'show') return;
    const id = setTimeout(() => setPhase('ask'), SHOW_MS);
    return () => clearTimeout(id);
  }, [phase, round]);

  const answer = (val) => {
    if (phase !== 'ask') return;
    const good = val === data.targetCount;
    if (good) okRef.current += 1;
    setPicked(val);
    setPhase('feedback');
    setTimeout(() => {
      if (round >= TOTAL_ROUNDS) {
        endRef.current(okRef.current * 150 + (okRef.current === TOTAL_ROUNDS ? 100 : 0));
      } else {
        setRound(r => r + 1);
        setData(makeRound());
        setPicked(null);
        setPhase('show');
      }
    }, 1000);
  };

  const correct = data.targetCount;

  return (
    <div className="flex-1 flex flex-col px-5 pb-6">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">Ronda {round}/{TOTAL_ROUNDS}</span>
        <span className="bg-black/30 text-amber-300 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
      </div>

      {phase === 'show' ? (
        <>
          <p className="text-center text-amber-300 font-black uppercase tracking-widest text-xs mb-2 flex items-center justify-center gap-2">
            <span className="animate-pulse">👀</span> ¡Memoriza la estantería!
          </p>
          {/* barra de cuenta atrás */}
          <div className="h-1.5 w-full max-w-sm mx-auto bg-black/30 rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full gfx-bar" style={{ background: 'linear-gradient(90deg,#fde68a,#f59e0b)', animationDuration: `${SHOW_MS}ms` }} />
          </div>

          {/* Estantería 3D */}
          <div className="flex-1 relative" style={{ perspective: '900px' }}>
            <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(7deg)' }}>
              {/* armario: fondo + laterales + marco */}
              <div className="absolute inset-0 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(160deg, #2a1c0c 0%, #160f06 100%)', boxShadow: 'inset 0 0 0 6px #5b3a16, inset 0 0 0 8px #3d2710, inset 0 6px 18px rgba(0,0,0,0.6)' }}>
                {/* veta del fondo */}
                <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 2px, transparent 2px 26px)' }} />
                {/* lateral derecho (profundidad) */}
                <div className="absolute top-0 bottom-0 right-0 w-3" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.4), rgba(0,0,0,0))' }} />

                {/* baldas con productos */}
                {SHELF_TOP.map((ty, k) => (
                  <React.Fragment key={k}>
                    {/* productos sobre la balda */}
                    {data.items.filter(it => it.shelf === k).map((it, i) => (
                      <div
                        key={it.id}
                        className="absolute text-3xl gfx-pop drop-shadow-[0_3px_2px_rgba(0,0,0,0.55)]"
                        style={{ left: `${it.x}%`, top: `${ty}%`, transform: 'translate(-50%,-100%)', animationDelay: `${Math.min(i * 26, 400)}ms` }}
                      >
                        {it.emoji}
                      </div>
                    ))}
                    {/* superficie superior de la balda (vista desde arriba) */}
                    <div className="absolute left-1 right-1" style={{ top: `${ty}%`, height: 5, marginTop: -2, background: 'linear-gradient(180deg, #d6a35a, #a16207)', transform: 'scaleY(0.9)' }} />
                    {/* canto frontal de la balda */}
                    <div className="absolute left-1 right-1" style={{ top: `${ty}%`, height: 8, background: 'linear-gradient(180deg, #7c4a16, #4a2c0c)', boxShadow: '0 4px 7px rgba(0,0,0,0.5)' }} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-5">
            {phase === 'feedback' ? (picked === correct ? '¡Correcto! 🎉' : `Eran ${correct}`) : '¿Cuántos había de este?'}
          </p>
          <div
            className="rounded-full w-28 h-28 flex items-center justify-center mb-9"
            style={{ background: 'radial-gradient(circle at 38% 28%, rgba(253,230,138,0.35), rgba(0,0,0,0.35))', boxShadow: '0 0 34px rgba(245,158,11,0.4), inset 0 2px 8px rgba(255,255,255,0.25)', border: '2px solid rgba(245,158,11,0.5)' }}
          >
            <span className="text-6xl drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]">{data.target}</span>
          </div>
          <div className="flex gap-4">
            {data.options.map(o => {
              const isFb = phase === 'feedback';
              const isCorrect = o === correct;
              const isPicked = o === picked;
              let style = { background: 'linear-gradient(160deg, #fde68a, #f59e0b)', boxShadow: '0 5px 14px rgba(245,158,11,0.4), inset 0 2px 5px rgba(255,255,255,0.5)' };
              if (isFb && isCorrect) style = { background: 'linear-gradient(160deg, #6ee7b7, #059669)', boxShadow: '0 0 22px rgba(16,185,129,0.7), inset 0 2px 5px rgba(255,255,255,0.5)' };
              else if (isFb && isPicked && !isCorrect) style = { background: 'linear-gradient(160deg, #fda4af, #be123c)', boxShadow: '0 0 22px rgba(225,29,72,0.6)' };
              return (
                <button
                  key={o}
                  onPointerDown={() => answer(o)}
                  disabled={isFb}
                  className={`w-20 h-20 font-black text-3xl rounded-2xl border-b-4 border-black/25 active:scale-90 transition-all ${isFb && isCorrect ? 'text-white scale-110' : isFb && isPicked ? 'text-white' : 'text-amber-950'}`}
                  style={style}
                >
                  {o}
                </button>
              );
            })}
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
        <span key="1">Verás una <strong>estantería</strong> con productos colocados en las baldas durante <strong>3 segundos</strong>.</span>,
        <span key="2">Después te preguntaremos <strong>cuántas unidades</strong> había de un producto.</span>,
        <span key="3">6 rondas, 150 puntos por acierto y bonus por pleno. ¡Ojo de inventario!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
