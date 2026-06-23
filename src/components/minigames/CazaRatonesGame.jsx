import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand , ScoreBurst } from './GameShell';

const DURATION = 45;
const MAX_LIVES = 3;

function Play({ end }) {
  const [moles, setMoles] = useState([]); // [{ id, cell, born, life, bomb }]
  const [hits, setHits] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [level, setLevel] = useState(1);

  const molesRef = useRef([]);   // fuente de verdad (evita estados obsoletos)
  const hitsRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const idRef = useRef(0);
  const overRef = useRef(false);
  const endRef = useRef(end);
  endRef.current = end;

  const finish = () => {
    if (overRef.current) return;
    overRef.current = true;
    endRef.current(clamp(hitsRef.current * 30, 0, 1500));
  };

  // Temporizador robusto: se crea una sola vez.
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generador: tick fijo; la dificultad escala con las cazas (hitsRef).
  useEffect(() => {
    const tick = setInterval(() => {
      if (overRef.current) return;
      const now = Date.now();
      // Separar vivos de caducados; un ratón que escapa cuesta una vida (la bomba no).
      const next = [];
      let escaped = 0;
      for (const m of molesRef.current) {
        if (now - m.born < m.life) next.push(m);
        else if (!m.bomb) escaped += 1;
      }
      if (escaped > 0) {
        livesRef.current = Math.max(0, livesRef.current - escaped);
        setLives(livesRef.current);
        if (livesRef.current === 0) { molesRef.current = next; setMoles([...next]); finish(); return; }
      }
      const lvl = Math.floor(hitsRef.current / 5);
      const maxSim = Math.min(1 + lvl, 4);                 // de 1 hasta 4 a la vez
      const chance = Math.min(0.32 + lvl * 0.05, 0.65);
      if (next.length < maxSim && Math.random() < chance) {
        const occupied = new Set(next.map(m => m.cell));
        const free = [];
        for (let c = 0; c < 9; c++) if (!occupied.has(c)) free.push(c);
        if (free.length) {
          const cell = free[rand(0, free.length - 1)];
          const bomb = Math.random() < Math.min(0.16 + lvl * 0.03, 0.32); // más bombas al subir
          const life = bomb ? Math.max(900, 1500 - lvl * 70) : Math.max(650, 1300 - lvl * 90);
          next.push({ id: idRef.current++, cell, born: now, life, bomb });
        }
      }
      molesRef.current = next;
      setMoles([...next]);
    }, 280);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const whack = (cell) => {
    if (overRef.current) return;
    const m = molesRef.current.find(x => x.cell === cell);
    if (!m) return; // caja vacía: no penaliza
    if (m.bomb) {   // tocar bomba = eliminado al instante
      molesRef.current = molesRef.current.filter(x => x.cell !== cell);
      setMoles([...molesRef.current]);
      finish();
      return;
    }
    molesRef.current = molesRef.current.filter(x => x.cell !== cell);
    setMoles([...molesRef.current]);
    hitsRef.current += 1;
    setHits(hitsRef.current);
    setLevel(1 + Math.floor(hitsRef.current / 5));
  };

  const cellOf = new Map(moles.map(m => [m.cell, m]));

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
      <div className="flex items-center gap-2.5 mb-5 flex-wrap justify-center">
        <span className={`hud-chip font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="hud-chip text-orange-400 font-black px-4 py-1.5 rounded-full text-sm">🐭 {hits}</span>
        <ScoreBurst value={hits} color="#fb923c" />
        <span className="hud-chip font-black px-3 py-1.5 rounded-full text-sm">{'❤️'.repeat(lives)}{'🖤'.repeat(MAX_LIVES - lives)}</span>
      </div>
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-5 text-center">¡Caza ratones y <span className="text-rose-400">NO toques las 💣</span>!</p>
      <div className="grid grid-cols-3 gap-3.5 w-full max-w-xs">
        {Array.from({ length: 9 }, (_, i) => {
          const m = cellOf.get(i);
          const up = !!m;
          const bomb = m?.bomb;
          return (
            <button
              key={i}
              onPointerDown={() => whack(i)}
              className={`aspect-square rounded-3xl flex items-center justify-center text-5xl border-b-[6px] transition-all duration-75 active:scale-95 ${up ? (bomb ? 'border-rose-900 scale-105' : 'border-orange-800 scale-105') : 'border-amber-950'}`}
              style={up
                ? (bomb
                  ? { background: 'radial-gradient(circle at 40% 28%, #fda4af, #e11d48)', boxShadow: '0 0 30px rgba(225,29,72,0.85), inset 0 2px 6px rgba(255,255,255,0.4)' }
                  : { background: 'radial-gradient(circle at 40% 28%, #fdba74, #f97316)', boxShadow: '0 0 26px rgba(249,115,22,0.7), inset 0 2px 6px rgba(255,255,255,0.45)' })
                : { background: 'linear-gradient(160deg, #c08a4f, #6b4a28)', boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.4)' }}
            >
              <span className={up ? 'gfx-pop drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]' : 'drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]'}>{up ? (bomb ? '💣' : '🐭') : '📦'}</span>
            </button>
          );
        })}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-5 text-center px-6">Si un ratón escapa pierdes ❤️ · 3 fallos o una bomba = eliminado</p>
    </div>
  );
}

export function CazaRatonesGame(props) {
  return (
    <GameShell
      {...props}
      day={10} title="Caza Ratones" emoji="🐭" accent="orange"
      instructions={[
        <span key="1">¡Hay ratones en el almacén! Salen de entre las <strong>cajas</strong>. Tócalos antes de que se escondan.</span>,
        <span key="2">Tienes <strong>3 vidas ❤️</strong>: cada ratón que se escapa te quita una. Cada caza son <strong>30 puntos</strong>.</span>,
        <span key="3">¡Cuidado con las <strong>bombas 💣</strong>! Si tocas una, <strong>eliminado</strong>. 45 segundos.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
