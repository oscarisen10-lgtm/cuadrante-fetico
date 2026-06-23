import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, shuffle , ScoreBurst } from './GameShell';

const SIZE = 4;
const N = SIZE * SIZE;

function Play({ end }) {
  const [phase, setPhase] = useState('show'); // 'show' | 'input'
  const [lit, setLit] = useState([]);
  const [tapped, setTapped] = useState([]);
  const [level, setLevel] = useState(1);
  const [wrong, setWrong] = useState(null);

  const litRef = useRef([]);
  const levelRef = useRef(1);
  const endRef = useRef(end);
  endRef.current = end;

  const startRound = (lvl) => {
    const k = Math.min(2 + lvl, N - 2); // casillas a memorizar (sube con el nivel)
    const cells = shuffle([...Array(N).keys()]).slice(0, k);
    litRef.current = cells;
    setLit(cells);
    setTapped([]);
    setWrong(null);
    setPhase('show');
    const t = setTimeout(() => setPhase('input'), 850 + k * 230);
    return () => clearTimeout(t);
  };

  useEffect(() => { startRound(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const tap = (i) => {
    if (phase !== 'input' || tapped.includes(i)) return;
    if (!litRef.current.includes(i)) {
      // un fallo y eliminado
      setWrong(i);
      setTimeout(() => endRef.current(clamp((levelRef.current - 1) * 120, 0, 2000)), 500);
      return;
    }
    const nt = [...tapped, i];
    setTapped(nt);
    if (nt.length === litRef.current.length) {
      const nl = levelRef.current + 1;
      levelRef.current = nl;
      setLevel(nl);
      setTimeout(() => startRound(nl), 350);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div className="flex items-center gap-3 mb-3">
        <span className="hud-chip text-violet-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <ScoreBurst value={level} color="#c4b5fd" />
        <span className="hud-chip text-white font-black px-4 py-1.5 rounded-full text-sm">{litRef.current.length} casillas</span>
      </div>
      <p className={`font-black text-lg mb-5 ${phase === 'show' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
        {phase === 'show' ? '👀 MEMORIZA' : '✋ ¡REPÍTELAS!'}
      </p>
      <div className="grid gap-2.5 w-full max-w-[300px]" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0,1fr))` }}>
        {Array.from({ length: N }, (_, i) => {
          const on = (phase === 'show' && lit.includes(i)) || tapped.includes(i);
          const bad = wrong === i;
          return (
            <button
              key={i}
              onPointerDown={() => tap(i)}
              className="aspect-square rounded-2xl transition-all duration-150 active:scale-95"
              style={bad
                ? { background: 'radial-gradient(circle at 40% 30%, #fb7185, #be123c)', boxShadow: '0 0 22px rgba(225,29,72,0.8)' }
                : on
                ? { background: 'radial-gradient(circle at 40% 28%, #ddd6fe, #7c3aed)', boxShadow: '0 0 24px rgba(124,58,237,0.85), inset 0 2px 6px rgba(255,255,255,0.5)' }
                : { background: 'linear-gradient(160deg, #2e2150, #1a1330)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }}
            />
          );
        })}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-5 text-center px-6">Cada nivel añade una casilla más. ¡Un fallo y fuera!</p>
    </div>
  );
}

export function MemoriaRelampagoGame(props) {
  return (
    <GameShell
      {...props}
      day={15} title="Memoria Relámpago" emoji="💡" accent="violet"
      instructions={[
        <span key="1">Se iluminan unas <strong>casillas</strong> durante un instante. Memorízalas.</span>,
        <span key="2">Cuando se apaguen, <strong>tócalas todas</strong> de memoria.</span>,
        <span key="3">Cada acierto añade una casilla más. ¡Un solo fallo y eliminado!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
