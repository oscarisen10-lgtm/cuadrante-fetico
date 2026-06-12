import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const DURATION = 30;
const TARGET_LIFE = 1400; // ms antes de desaparecer

function Play({ end }) {
  const [targets, setTargets] = useState([]); // {id, x, y, born}
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const idRef = useRef(0);

  // Cronómetro
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          end(clamp(scoreRef.current, 0, 1200));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [end]);

  // Aparición y caducidad de dianas
  useEffect(() => {
    const spawn = setInterval(() => {
      const t = { id: idRef.current++, x: rand(8, 78), y: rand(8, 74), born: Date.now() };
      setTargets(prev => [...prev.filter(p => Date.now() - p.born < TARGET_LIFE), t].slice(-6));
    }, 600);
    const cleanup = setInterval(() => {
      setTargets(prev => prev.filter(p => Date.now() - p.born < TARGET_LIFE));
    }, 200);
    return () => { clearInterval(spawn); clearInterval(cleanup); };
  }, []);

  const hit = (t) => {
    const age = Date.now() - t.born;
    const pts = age < 500 ? 30 : age < 900 ? 20 : 10;
    scoreRef.current += pts;
    setScore(scoreRef.current);
    setTargets(prev => prev.filter(p => p.id !== t.id));
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-6">
      <div className="flex items-center justify-center gap-4 mb-3">
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-red-400 font-black px-4 py-1.5 rounded-full text-sm">🎯 {score}</span>
      </div>
      <div className="flex-1 relative bg-black/30 border-2 border-red-500/30 rounded-3xl overflow-hidden touch-none">
        {targets.map(t => {
          const age = Date.now() - t.born;
          const scale = Math.max(0.35, 1 - age / TARGET_LIFE);
          return (
            <button
              key={t.id}
              onPointerDown={() => hit(t)}
              className="absolute w-16 h-16 -ml-8 -mt-8 rounded-full flex items-center justify-center text-4xl transition-transform"
              style={{ left: `${t.x + 8}%`, top: `${t.y + 8}%`, transform: `scale(${scale})` }}
            >
              🎯
            </button>
          );
        })}
        <p className="absolute bottom-3 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">
          Cuanto antes la toques, más puntos (30 → 10)
        </p>
      </div>
    </div>
  );
}

export function DianaGame(props) {
  return (
    <GameShell
      {...props}
      day={19} title="Diana" emoji="🎯" accent="red"
      instructions={[
        <span key="1">Las dianas aparecen y <strong>se encogen hasta desaparecer</strong>.</span>,
        <span key="2">Tócalas lo antes posible: recién salidas valen <strong>30 puntos</strong>, al final solo 10.</span>,
        <span key="3">30 segundos de puntería. ¡A por todas!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
