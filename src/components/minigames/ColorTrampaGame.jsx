import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, shuffle, rand, fx } from './GameShell';

const DURATION = 60; // segundos

const PALETTE = [
  { name: 'ROJO',     hex: '#f43f5e' },
  { name: 'VERDE',    hex: '#22c55e' },
  { name: 'AZUL',     hex: '#3b82f6' },
  { name: 'AMARILLO', hex: '#eab308' },
  { name: 'NARANJA',  hex: '#f97316' },
  { name: 'MORADO',   hex: '#a855f7' },
  { name: 'ROSA',     hex: '#ec4899' },
  { name: 'CIAN',     hex: '#06b6d4' },
];

// El número de colores (botones) crece con el nivel: empieza en 3 y sube hasta 8.
const makeRound = (level) => {
  const numOptions = clamp(3 + Math.floor((level - 1) / 2), 3, PALETTE.length);
  const options = shuffle(PALETTE).slice(0, numOptions);
  const ink = options[rand(0, options.length - 1)]; // color de la TINTA = respuesta correcta
  // La palabra escrita es el NOMBRE de otro color (la trampa).
  let word = PALETTE[rand(0, PALETTE.length - 1)];
  let guard = 0;
  while (word.name === ink.name && guard++ < 30) word = PALETTE[rand(0, PALETTE.length - 1)];
  return { wordText: word.name, inkHex: ink.hex, inkName: ink.name, options: shuffle(options) };
};

function Play({ end }) {
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [round, setRound] = useState(() => makeRound(1));
  const [level, setLevel] = useState(1);
  const [flash, setFlash] = useState(null); // 'ok' | 'ko'

  const okRef = useRef(0);
  const levelRef = useRef(1);
  const lockRef = useRef(false);
  const endRef = useRef(end);
  endRef.current = end;

  const finish = () => endRef.current(clamp(okRef.current * 60 + levelRef.current * 10, 0, 1500));

  // Temporizador robusto: se crea una sola vez.
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (opt) => {
    if (lockRef.current) return;
    lockRef.current = true;
    if (opt.name === round.inkName) {
      okRef.current += 1;
      levelRef.current += 1;
      setLevel(levelRef.current);
      setFlash('ok');
      setTimeout(() => { setFlash(null); lockRef.current = false; setRound(makeRound(levelRef.current)); }, 220);
    } else {
      // 1 fallo = eliminado
      setFlash('ko');
      setTimeout(() => finish(), 550);
    }
  };

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 transition-colors duration-150 ${flash === 'ok' ? 'bg-emerald-500/10' : flash === 'ko' ? 'bg-rose-500/30' : ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <span className={`hud-chip font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="hud-chip text-cyan-400 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <span className="hud-chip text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
      </div>
      <p className="text-white/70 font-bold uppercase tracking-widest text-xs mb-4 text-center max-w-[280px] leading-relaxed">Pulsa el botón del <strong className="text-white">COLOR de la tinta</strong>, no el que dice la palabra</p>
      <div className="rounded-3xl px-10 py-10 mb-8" style={fx.panel}>
        <p className="text-5xl font-black tracking-tight" style={{ color: round.inkHex, textShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>{round.wordText}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {round.options.map(opt => (
          <button
            key={opt.name}
            onPointerDown={() => answer(opt)}
            aria-label={opt.name}
            className="aspect-square rounded-2xl border-b-4 border-black/40 active:scale-90 transition-transform"
            style={{ background: opt.hex, boxShadow: `0 0 18px ${opt.hex}88, inset 0 3px 7px rgba(255,255,255,0.45), inset 0 -6px 12px rgba(0,0,0,0.3)` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ColorTrampaGame(props) {
  return (
    <GameShell
      {...props}
      day={9} title="Color Trampa" emoji="🎨" accent="cyan"
      instructions={[
        <span key="1">Aparece una palabra de color escrita <strong>en un color que la engaña</strong>.</span>,
        <span key="2">Pulsa el botón del <strong>color con el que está PINTADA</strong> (la tinta), no el que dice la palabra.</span>,
        <span key="3"><strong>60 segundos</strong>. Sube de nivel con cada acierto (más colores). ¡Un solo fallo y eliminado!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
