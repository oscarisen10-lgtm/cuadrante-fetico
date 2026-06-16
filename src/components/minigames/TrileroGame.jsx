import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const slotX = (slot) => 18 + slot * 32; // % horizontal de los 3 huecos: 18, 50, 82

function Play({ end }) {
  const [cups, setCups] = useState([{ id: 0, slot: 0 }, { id: 1, slot: 1 }, { id: 2, slot: 2 }]);
  const [phase, setPhase] = useState('reveal'); // reveal | shuffle | guess | result
  const [lift, setLift] = useState(null);        // id de la taza levantada
  const [level, setLevel] = useState(1);
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState(false);

  const ballRef = useRef(0);     // id de la taza que esconde la pelota
  const levelRef = useRef(1);
  const phaseRef = useRef('reveal');
  const timers = useRef([]);
  const endRef = useRef(end);
  endRef.current = end;

  const setPh = (p) => { phaseRef.current = p; setPhase(p); };
  const after = (ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id); };

  const doShuffle = (lvl) => {
    setPh('shuffle');
    const swaps = 4 + lvl * 2;
    const delay = Math.max(210, 520 - lvl * 28);
    let i = 0;
    const step = () => {
      if (i >= swaps) { setPh('guess'); return; }
      const a = rand(0, 2); let b = rand(0, 2); if (b === a) b = (b + 1) % 3;
      setCups(prev => {
        const nx = prev.map(c => ({ ...c }));
        const ca = nx.find(c => c.slot === a), cb = nx.find(c => c.slot === b);
        const t = ca.slot; ca.slot = cb.slot; cb.slot = t;
        return nx;
      });
      i++;
      after(delay, step);
    };
    step();
  };

  const startRound = (lvl) => {
    const ball = rand(0, 2);
    ballRef.current = ball;
    setWrong(false); setPicked(null);
    setLift(ball);          // levanta la taza con la pelota
    setPh('reveal');
    after(1000, () => {
      setLift(null);        // la baja
      after(480, () => doShuffle(lvl));
    });
  };

  useEffect(() => {
    startRound(1);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (cup) => {
    if (phaseRef.current !== 'guess') return;
    setPh('result');
    setPicked(cup.id);
    setLift(cup.id);
    const ok = cup.id === ballRef.current;
    if (ok) {
      after(1100, () => {
        const nl = levelRef.current + 1; levelRef.current = nl; setLevel(nl);
        startRound(nl);
      });
    } else {
      setWrong(true);
      after(750, () => setLift(ballRef.current));  // muestra dónde estaba
      after(1600, () => endRef.current(clamp((levelRef.current - 1) * 120, 0, 2000)));
    }
  };

  const ballSlot = cups.find(c => c.id === ballRef.current)?.slot ?? 1;
  const showBall = lift === ballRef.current;
  const hint = phase === 'reveal' ? '👀 ¡Mira dónde está la pelota!'
    : phase === 'shuffle' ? '🔀 Sigue la pelota…'
    : phase === 'guess' ? '👆 ¿Bajo qué vaso está?'
    : (wrong ? '❌ ¡Ahí no estaba!' : '✅ ¡La tenías!');

  return (
    <div className="flex-1 flex flex-col items-center px-6 pb-8 select-none">
      <div className="flex items-center gap-3 mb-6">
        <span className="bg-black/30 text-rose-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">{4 + level * 2} mezclas</span>
      </div>
      <p className={`font-bold uppercase tracking-widest text-xs mb-2 h-5 ${phase === 'guess' ? 'text-rose-300 animate-pulse' : 'text-white/70'}`}>{hint}</p>

      {/* Mesa */}
      <div className="relative w-full max-w-sm flex-1 min-h-[260px]">
        {/* sombras en el suelo */}
        {[0, 1, 2].map(s => (
          <div key={`sh${s}`} className="absolute rounded-full bg-black/40 blur-[1px]" style={{ left: `${slotX(s)}%`, bottom: '24%', width: 64, height: 12, transform: 'translateX(-50%)' }} />
        ))}

        {/* Pelota (visible cuando la taza correcta está levantada) */}
        <div
          className="absolute w-9 h-9 rounded-full transition-opacity duration-200"
          style={{
            left: `${slotX(ballSlot)}%`, bottom: '24%', transform: 'translateX(-50%)',
            opacity: showBall ? 1 : 0,
            background: 'radial-gradient(circle at 36% 30%, #fecaca, #dc2626 70%)',
            boxShadow: '0 0 18px rgba(220,38,38,0.7), inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.6)',
          }}
        />

        {/* Vasos */}
        {cups.map(cup => {
          const lifted = lift === cup.id;
          const isWrongPick = wrong && picked === cup.id;
          return (
            <button
              key={cup.id}
              onPointerDown={() => pick(cup)}
              className="absolute w-20 h-24 p-0 border-0 bg-transparent"
              style={{
                left: `${slotX(cup.slot)}%`, bottom: '20%',
                transform: `translateX(-50%) translateY(${lifted ? '-42%' : '0'})`,
                transition: 'left 0.26s ease-in-out, transform 0.25s ease-out',
                zIndex: lifted ? 5 : 10,
              }}
            >
              <div
                className="w-full h-full mx-auto"
                style={{
                  clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0% 100%)',
                  background: isWrongPick
                    ? 'linear-gradient(150deg, #fca5a5 0%, #b91c1c 55%, #7f1d1d 100%)'
                    : 'linear-gradient(150deg, #fda4af 0%, #e11d48 52%, #9f1239 100%)',
                  boxShadow: 'inset 6px 4px 10px rgba(255,255,255,0.35), inset -8px -6px 14px rgba(0,0,0,0.4), 0 8px 18px rgba(0,0,0,0.45)',
                }}
              >
                {/* brillo */}
                <div className="w-2 h-2/3 rounded-full ml-3 mt-2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.7), transparent)' }} />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-2 text-center px-6">Acierta para subir de nivel · un fallo y eliminado</p>
    </div>
  );
}

export function TrileroGame(props) {
  return (
    <GameShell
      {...props}
      day={19} title="Trilero" emoji="🥤" accent="red"
      instructions={[
        <span key="1">Te enseñamos <strong>bajo qué vaso</strong> está la pelota.</span>,
        <span key="2">Los vasos se <strong>mezclan</strong> rápidamente. ¡No la pierdas de vista!</span>,
        <span key="3">Adivina dónde quedó. Cada acierto sube el nivel (más y más rápidas mezclas). Un fallo y fin.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
