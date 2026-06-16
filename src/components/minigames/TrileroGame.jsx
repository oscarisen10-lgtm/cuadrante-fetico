import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const slotX = (slot) => 18 + slot * 32; // % horizontal de los 3 huecos: 18, 50, 82

// Dificultad: empieza fácil y acelera cada vez más rápido (geométrico)
const swapsFor = (lvl) => 3 + Math.round((lvl - 1) * 1.5);
const delayFor = (lvl) => Math.max(150, Math.round(740 * Math.pow(0.85, lvl - 1)));

function Play({ end }) {
  const [cups, setCups] = useState([{ id: 0, slot: 0 }, { id: 1, slot: 1 }, { id: 2, slot: 2 }]);
  const [phase, setPhase] = useState('reveal'); // reveal | shuffle | guess | result
  const [lift, setLift] = useState(null);        // id de la taza levantada
  const [level, setLevel] = useState(1);
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState(false);
  const [swapMs, setSwapMs] = useState(280);     // duración de la animación de movimiento

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
    const swaps = swapsFor(lvl);
    const delay = delayFor(lvl);
    setSwapMs(clamp(Math.round(delay * 0.85), 110, 300));
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
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-black/30 text-rose-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">{swapsFor(level)} mezclas</span>
      </div>
      <p className={`font-bold uppercase tracking-widest text-xs mb-2 h-5 ${phase === 'guess' ? 'text-rose-300 animate-pulse' : 'text-white/70'}`}>{hint}</p>

      {/* Mesa con perspectiva */}
      <div className="relative w-full max-w-sm flex-1 min-h-[280px]" style={{ perspective: '900px' }}>
        {/* superficie de la mesa */}
        <div className="absolute left-1/2 -translate-x-1/2 rounded-[50%]" style={{ bottom: '16%', width: '94%', height: 70, background: 'radial-gradient(ellipse at 50% 35%, rgba(120,40,60,0.45), rgba(0,0,0,0) 72%)' }} />

        {/* sombras elípticas en el suelo */}
        {[0, 1, 2].map(s => (
          <div key={`sh${s}`} className="absolute rounded-[50%]" style={{ left: `${slotX(s)}%`, bottom: '24%', width: 72, height: 16, transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.55), rgba(0,0,0,0) 70%)' }} />
        ))}

        {/* Pelota 3D (visible cuando la taza correcta está levantada) */}
        <div
          className="absolute w-10 h-10 rounded-full transition-opacity duration-200"
          style={{
            left: `${slotX(ballSlot)}%`, bottom: '25%', transform: 'translateX(-50%)',
            opacity: showBall ? 1 : 0,
            background: 'radial-gradient(circle at 34% 28%, #ffe4e6 0%, #fb7185 35%, #dc2626 70%, #7f1d1d 100%)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.5), 0 0 22px rgba(220,38,38,0.7), inset 0 -4px 8px rgba(0,0,0,0.4), inset 0 3px 6px rgba(255,255,255,0.7)',
          }}
        />

        {/* Vasos 3D */}
        {cups.map(cup => {
          const lifted = lift === cup.id;
          const isWrongPick = wrong && picked === cup.id;
          const bodyGrad = isWrongPick
            ? 'linear-gradient(90deg, #4c0519 0%, #9f1239 30%, #fb7185 50%, #9f1239 70%, #4c0519 100%)'
            : 'linear-gradient(90deg, #7f1d1d 0%, #e11d48 30%, #fecdd3 50%, #e11d48 70%, #7f1d1d 100%)';
          return (
            <button
              key={cup.id}
              onPointerDown={() => pick(cup)}
              className="absolute p-0 border-0 bg-transparent"
              style={{
                left: `${slotX(cup.slot)}%`, bottom: '22%',
                width: 84, height: 100, marginLeft: -42,
                transform: `translateY(${lifted ? '-48%' : '0'})`,
                transition: `left ${swapMs}ms cubic-bezier(.45,.05,.55,.95), transform 0.25s ease-out`,
                zIndex: lifted ? 5 : 10,
                filter: lifted ? 'drop-shadow(0 14px 16px rgba(0,0,0,0.5))' : 'drop-shadow(0 8px 10px rgba(0,0,0,0.45))',
              }}
            >
              {/* apertura inferior (boca apoyada en la mesa) */}
              <div className="absolute left-1/2 -translate-x-1/2 rounded-[50%]" style={{ bottom: 2, width: 80, height: 20, background: 'radial-gradient(ellipse at 50% 38%, #2a0410, #120207)', boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.7)' }} />
              {/* cuerpo cilíndrico (estrecho arriba, ancho abajo) */}
              <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 10, width: 80, height: 80, clipPath: 'polygon(26% 0, 74% 0, 100% 100%, 0% 100%)', background: bodyGrad, boxShadow: 'inset 0 -10px 16px rgba(0,0,0,0.4)' }}>
                {/* anillos sutiles para dar volumen */}
                <div className="absolute left-0 right-0" style={{ top: '34%', height: 2, background: 'rgba(255,255,255,0.18)' }} />
                <div className="absolute left-0 right-0" style={{ top: '64%', height: 2, background: 'rgba(0,0,0,0.18)' }} />
              </div>
              {/* tapa superior abombada */}
              <div className="absolute left-1/2 -translate-x-1/2 rounded-[50%]" style={{ top: 4, width: 44, height: 16, background: isWrongPick ? 'radial-gradient(ellipse at 42% 30%, #fda4af, #9f1239)' : 'radial-gradient(ellipse at 42% 30%, #fff1f2, #e11d48)', boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.8)' }} />
            </button>
          );
        })}
      </div>

      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-2 text-center px-6">Empieza fácil y acelera · acierta para subir de nivel · un fallo y eliminado</p>
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
        <span key="2">Los vasos se <strong>mezclan</strong>. ¡No la pierdas de vista!</span>,
        <span key="3">Empieza fácil y cada nivel va <strong>más rápido y con más mezclas</strong>. Un fallo y fin.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
