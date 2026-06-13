import React, { useState, useEffect, useRef } from 'react';
import { GameShell, clamp, rand } from './GameShell';

const DURATION = 60;
const MAX_FAILS = 3;
const COLD = ['🥛', '🧀', '🍦', '🥩', '🐟', '🧈', '🍗', '🥚', '🧃', '🍮'];   // nevera (frío)
const DRY = ['🍞', '🍫', '🥫', '🍝', '☕', '🍪', '🧂', '🫘', '🥔', '🧅'];      // estante (seco)

const makeItem = () => {
  const cold = Math.random() < 0.5;
  const list = cold ? COLD : DRY;
  return { emoji: list[rand(0, list.length - 1)], cold };
};

function Play({ end }) {
  const [item, setItem] = useState(makeItem);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [hits, setHits] = useState(0);
  const [fails, setFails] = useState(0);
  const [flash, setFlash] = useState(null); // 'ok' | 'ko'
  const [drag, setDrag] = useState(0);       // desplazamiento visual de la carta

  const okRef = useRef(0);
  const failsRef = useRef(0);
  const lockRef = useRef(false);
  const startXRef = useRef(null);
  const endRef = useRef(end);
  endRef.current = end;

  const finish = () => endRef.current(clamp(okRef.current * 50, 0, 1500));

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolve = (toCold) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const good = toCold === item.cold;
    setDrag(toCold ? -160 : 160);
    if (good) {
      okRef.current += 1;
      setHits(okRef.current);
      setFlash('ok');
    } else {
      failsRef.current += 1;
      setFails(failsRef.current);
      setFlash('ko');
    }
    setTimeout(() => {
      setFlash(null);
      if (!good && failsRef.current >= MAX_FAILS) { finish(); return; }
      setDrag(0);
      setItem(makeItem());
      lockRef.current = false;
    }, 240);
  };

  const onDown = (e) => { startXRef.current = e.clientX; };
  const onMove = (e) => { if (startXRef.current != null && !lockRef.current) setDrag(clamp(e.clientX - startXRef.current, -170, 170)); };
  const onUp = () => {
    if (startXRef.current == null) return;
    const d = drag;
    startXRef.current = null;
    if (d < -55) resolve(true);
    else if (d > 55) resolve(false);
    else setDrag(0);
  };

  const livesLeft = Math.max(0, MAX_FAILS - fails);

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 select-none transition-colors duration-150 ${flash === 'ok' ? 'bg-emerald-500/10' : flash === 'ko' ? 'bg-rose-500/25' : ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <span className={`bg-black/30 font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="bg-black/30 text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {hits}</span>
        <span className="bg-black/30 font-black px-3 py-1.5 rounded-full text-sm">{'❤️'.repeat(livesLeft)}{'🖤'.repeat(fails)}</span>
      </div>

      <div className="flex items-center justify-between w-full max-w-sm mb-4">
        <div className="flex flex-col items-center text-sky-300"><span className="text-3xl">❄️</span><span className="text-[10px] font-black uppercase">Frío</span></div>
        <p className="text-white/60 font-bold uppercase tracking-widest text-[10px] text-center px-2">Desliza al sitio correcto</p>
        <div className="flex flex-col items-center text-amber-300"><span className="text-3xl">📦</span><span className="text-[10px] font-black uppercase">Seco</span></div>
      </div>

      {/* Carta del producto (arrastrable) */}
      <div
        className="w-44 h-52 rounded-3xl flex items-center justify-center text-7xl touch-none cursor-grab active:cursor-grabbing"
        style={{
          background: 'linear-gradient(160deg, #f1f5f9, #cbd5e1)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.4), inset 0 2px 6px rgba(255,255,255,0.8)',
          transform: `translateX(${drag}px) rotate(${drag / 18}deg)`,
          transition: lockRef.current || startXRef.current != null ? 'none' : 'transform 0.2s',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {item.emoji}
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-6">Arrastra la carta · izquierda = frío · derecha = seco</p>
    </div>
  );
}

export function ClasificaGame(props) {
  return (
    <GameShell
      {...props}
      day={16} title="Clasifica" emoji="🧊" accent="blue"
      instructions={[
        <span key="1">Llega un producto: decide si va a la <strong>nevera (frío ❄️)</strong> o al <strong>estante (seco 📦)</strong>.</span>,
        <span key="2"><strong>Desliza</strong> la carta a la izquierda (frío) o a la derecha (seco).</span>,
        <span key="3"><strong>60 segundos</strong> clasificando a toda prisa. ¡A los 3 fallos, eliminado!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
