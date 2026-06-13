import React, { useState, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const ARROWS = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
const KEYS = ['up', 'down', 'left', 'right'];
const makeSeq = (len) => Array.from({ length: len }, () => KEYS[rand(0, 3)]);

function Play({ end }) {
  const [level, setLevel] = useState(1);
  const [seq, setSeq] = useState(() => makeSeq(3));
  const [idx, setIdx] = useState(0);
  const [bad, setBad] = useState(false);

  const seqRef = useRef(seq);
  const idxRef = useRef(0);
  const levelRef = useRef(1);
  const lockRef = useRef(false);
  const startRef = useRef(null);
  const endRef = useRef(end);
  endRef.current = end;

  const newSeq = (lvl) => {
    const s = makeSeq(2 + lvl); // crece con el nivel
    seqRef.current = s;
    idxRef.current = 0;
    setSeq(s);
    setIdx(0);
    setBad(false);
    lockRef.current = false;
  };

  const onDown = (e) => { if (!lockRef.current) startRef.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!startRef.current || lockRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    startRef.current = null;
    if (Math.abs(dx) < 28 && Math.abs(dy) < 28) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');

    if (dir === seqRef.current[idxRef.current]) {
      idxRef.current += 1;
      setIdx(idxRef.current);
      if (idxRef.current >= seqRef.current.length) {
        const nl = levelRef.current + 1;
        levelRef.current = nl;
        setLevel(nl);
        lockRef.current = true;
        setTimeout(() => newSeq(nl), 250);
      }
    } else {
      lockRef.current = true;
      setBad(true);
      setTimeout(() => endRef.current(clamp((levelRef.current - 1) * 150, 0, 2000)), 550);
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 select-none touch-none transition-colors duration-150 ${bad ? 'bg-rose-500/25' : ''}`}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="bg-black/30 text-pink-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <span className="bg-black/30 text-white font-black px-4 py-1.5 rounded-full text-sm">{seq.length} flechas</span>
      </div>
      <p className="text-white/70 font-bold uppercase tracking-widest text-xs mb-7 text-center max-w-[280px] leading-relaxed">Desliza en el sentido de cada <strong className="text-pink-300">flecha</strong>, en orden</p>

      {/* Secuencia */}
      <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-sm">
        {seq.map((d, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div
              key={i}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-150 ${current ? 'scale-125' : ''}`}
              style={done
                ? { background: 'linear-gradient(160deg,#34d399,#059669)', boxShadow: '0 0 12px rgba(16,185,129,0.5)' }
                : current
                ? { background: 'linear-gradient(160deg,#f9a8d4,#db2777)', boxShadow: '0 0 22px rgba(219,39,119,0.8)' }
                : { background: 'rgba(255,255,255,0.08)' }}
            >
              {ARROWS[d]}
            </div>
          );
        })}
      </div>

      {/* Zona de deslizamiento */}
      <div className="w-44 h-44 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 40% 30%, rgba(236,72,153,0.18), rgba(0,0,0,0.2))', boxShadow: 'inset 0 0 30px rgba(236,72,153,0.25), 0 0 20px rgba(0,0,0,0.3)' }}>
        <span className="text-5xl opacity-70">👆</span>
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-6">Desliza arriba / abajo / izquierda / derecha</p>
    </div>
  );
}

export function ComboFlechasGame(props) {
  return (
    <GameShell
      {...props}
      day={30} title="Combo de Flechas" emoji="🕹️" accent="pink"
      instructions={[
        <span key="1">Aparece una <strong>secuencia de flechas</strong>. Repítela <strong>deslizando</strong> en cada sentido, en orden.</span>,
        <span key="2">Cada nivel completado añade <strong>una flecha más</strong>.</span>,
        <span key="3">Rapidez y precisión. ¡Un deslizamiento equivocado y eliminado!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
