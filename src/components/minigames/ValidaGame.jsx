import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp } from './GameShell';

const MAX_STRIKES = 3;

function Play({ end }) {
  const [sym, setSym] = useState(null);   // 'go' | 'stop'
  const [hits, setHits] = useState(0);
  const [strikes, setStrikes] = useState(0);

  const curRef = useRef(null);
  const respondedRef = useRef(false);
  const hitsRef = useRef(0);
  const strikesRef = useRef(0);
  const endedRef = useRef(false);
  const endRef = useRef(end);
  endRef.current = end;

  const doStrike = () => {
    strikesRef.current += 1;
    setStrikes(strikesRef.current);
    if (strikesRef.current >= MAX_STRIKES && !endedRef.current) {
      endedRef.current = true;
      setTimeout(() => endRef.current(clamp(hitsRef.current * 70, 0, 2000)), 260);
    }
  };

  // Ciclo auto-programado (varía el ritmo); se monta una sola vez.
  useEffect(() => {
    let to;
    const cycle = () => {
      if (endedRef.current) return;
      // ¿se escapó un verde sin pulsar? → strike
      if (curRef.current && curRef.current.good && !respondedRef.current) doStrike();
      if (endedRef.current) return;
      const good = Math.random() < 0.55;
      curRef.current = { good };
      respondedRef.current = false;
      setSym(good ? 'go' : 'stop');
      to = setTimeout(cycle, Math.max(560, 1100 - hitsRef.current * 16)); // acelera con los aciertos
    };
    cycle();
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = () => {
    if (endedRef.current || !curRef.current || respondedRef.current) return;
    respondedRef.current = true;
    if (curRef.current.good) { hitsRef.current += 1; setHits(hitsRef.current); }
    else doStrike();
  };

  const livesLeft = Math.max(0, MAX_STRIKES - strikes);
  const go = sym === 'go';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 select-none" onPointerDown={tap}>
      <div className="flex items-center gap-3 mb-8">
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {hits}</span>
        <span className="bg-black/30 font-black px-3 py-1.5 rounded-full text-sm">{'❤️'.repeat(livesLeft)}{'🖤'.repeat(strikes)}</span>
      </div>
      <p className="text-white/70 font-bold uppercase tracking-widest text-xs mb-7 text-center max-w-[280px] leading-relaxed">Pulsa SOLO con el <strong className="text-emerald-300">✓ verde</strong>. ¡No toques el <strong className="text-rose-300">⛔ rojo</strong>!</p>
      <div
        className="w-56 h-56 rounded-[2.5rem] flex items-center justify-center text-8xl transition-colors duration-100"
        style={go
          ? { background: 'radial-gradient(circle at 40% 30%, #34d399, #059669)', boxShadow: '0 0 50px rgba(16,185,129,0.6), inset 0 4px 12px rgba(255,255,255,0.4)' }
          : { background: 'radial-gradient(circle at 40% 30%, #fb7185, #be123c)', boxShadow: '0 0 50px rgba(225,29,72,0.5), inset 0 4px 12px rgba(255,255,255,0.3)' }}
      >
        {go ? '✅' : '⛔'}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-7">Toca en cualquier sitio · cada vez más rápido</p>
    </div>
  );
}

export function ValidaGame(props) {
  return (
    <GameShell
      {...props}
      day={17} title="Valida" emoji="✅" accent="emerald"
      instructions={[
        <span key="1">Aparecen productos para validar: <strong>✓ verde = válido</strong>, <strong>⛔ rojo = rechazado</strong>.</span>,
        <span key="2">Pulsa <strong>solo cuando salga el verde</strong>. Si tocas el rojo o se te escapa un verde, fallo.</span>,
        <span key="3">Va cada vez <strong>más rápido</strong>. ¡A los 3 fallos, eliminado!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
