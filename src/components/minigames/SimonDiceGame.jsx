import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand, fx } from './GameShell';

const PADS = [
  { id: 0, on: ['#6ee7b7', '#10b981'], off: ['#065f46', '#052e23'], glow: 'rgba(16,185,129,0.75)', emoji: '🍏' },
  { id: 1, on: ['#fda4af', '#f43f5e'], off: ['#9f1239', '#5c0f22'], glow: 'rgba(244,63,94,0.75)',  emoji: '🍎' },
  { id: 2, on: ['#fcd34d', '#f59e0b'], off: ['#92400e', '#5a2c08'], glow: 'rgba(245,158,11,0.75)', emoji: '🧀' },
  { id: 3, on: ['#7dd3fc', '#0ea5e9'], off: ['#075985', '#072f47'], glow: 'rgba(14,165,233,0.75)', emoji: '🐟' },
];

function Play({ end }) {
  const [seq, setSeq] = useState([rand(0, 3)]);
  const [phase, setPhase] = useState('show'); // show | input
  const [lit, setLit] = useState(null);
  const inputIdx = useRef(0);
  const timeouts = useRef([]);

  // Reproduce la secuencia iluminando cada pad
  useEffect(() => {
    if (phase !== 'show') return;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    seq.forEach((pad, i) => {
      timeouts.current.push(setTimeout(() => setLit(pad), 500 + i * 650));
      timeouts.current.push(setTimeout(() => setLit(null), 500 + i * 650 + 380));
    });
    timeouts.current.push(setTimeout(() => {
      inputIdx.current = 0;
      setPhase('input');
    }, 500 + seq.length * 650 + 200));
    return () => timeouts.current.forEach(clearTimeout);
  }, [phase, seq]);

  const tap = (id) => {
    if (phase !== 'input') return;
    setLit(id);
    setTimeout(() => setLit(null), 220);
    if (id !== seq[inputIdx.current]) {
      end(clamp((seq.length - 1) * 100, 0, 1000));
      return;
    }
    inputIdx.current += 1;
    if (inputIdx.current >= seq.length) {
      if (seq.length >= 10) { end(1000); return; }
      setTimeout(() => {
        setSeq(s => [...s, rand(0, 3)]);
        setPhase('show');
      }, 600);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-2">Nivel {seq.length}</p>
      <p className={`font-black text-xl mb-6 ${phase === 'show' ? 'text-amber-400' : 'text-emerald-400'}`}>
        {phase === 'show' ? '👀 MEMORIZA...' : '✋ ¡TU TURNO!'}
      </p>
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs aspect-square">
        {PADS.map(p => (
          <button
            key={p.id}
            onPointerDown={() => tap(p.id)}
            className={`rounded-[1.75rem] flex items-center justify-center text-5xl transition-transform duration-100 border-b-[6px] border-black/40 active:scale-95 ${lit === p.id ? 'scale-105' : ''}`}
            style={lit === p.id ? fx.orb(p.on[0], p.on[1], p.glow) : fx.tile(p.off[0], p.off[1])}
          >
            <span className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">{p.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SimonDiceGame(props) {
  return (
    <GameShell
      {...props}
      day={6} title="Simón Dice" emoji="🧠" accent="violet"
      instructions={[
        <span key="1">Memoriza la <strong>secuencia de productos</strong> que se ilumina.</span>,
        <span key="2">Repítela tocando los paneles <strong>en el mismo orden</strong>.</span>,
        <span key="3">Cada nivel añade un paso más. ¡Llega al nivel 10 para 1000 puntos!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
