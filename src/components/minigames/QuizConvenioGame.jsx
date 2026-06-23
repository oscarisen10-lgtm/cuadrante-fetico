import React, { useState, useEffect, useRef } from 'react';
import { GameShell, shuffle, fx , ScoreBurst } from './GameShell';

// Banco de afirmaciones basadas en el convenio/acuerdos (V/F)
const BANK = [
  { t: 'Por matrimonio o pareja de hecho corresponden 15 días naturales.', v: true },
  { t: 'Por hospitalización de un familiar corresponden 5 días hábiles.', v: true },
  { t: 'El permiso por fallecimiento de un familiar es de 10 días.', v: false },
  { t: 'Por traslado de domicilio habitual corresponde 1 día.', v: true },
  { t: 'El examen de conducir no da derecho a permiso.', v: false },
  { t: 'Por firmas notariales corresponde 1 día al año.', v: true },
  { t: 'El cuidado del lactante es 1 hora diaria hasta los 9 meses.', v: true },
  { t: 'La bolsa de acompañamiento médico es de 40 horas.', v: false },
  { t: 'La fuerza mayor familiar permite hasta 4 días laborables al año.', v: true },
  { t: 'Los cuñados son parientes de primer grado.', v: false },
  { t: 'Los abuelos son parientes de segundo grado.', v: true },
  { t: 'Por matrimonio de un pariente corresponde 1 día hábil.', v: true },
  { t: 'El permiso por fallecimiento puede ampliarse a 4 días con desplazamiento.', v: true },
  { t: 'Los suegros son parientes de segundo grado.', v: false },
  { t: 'Por mudanza corresponden 5 días de permiso.', v: false },
  { t: 'Los exámenes oficiales dan derecho al tiempo indispensable.', v: true },
];
const TOTAL = 10;
const TIME_PER_Q = 10;

function Play({ end }) {
  const [questions] = useState(() => shuffle(BANK).slice(0, TOTAL));
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [feedback, setFeedback] = useState(null); // 'ok' | 'ko'
  const okRef = useRef(0);
  const lockRef = useRef(false);

  // Temporizador por pregunta
  useEffect(() => {
    setTimeLeft(TIME_PER_Q);
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); answer(null); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const answer = (val) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const good = val === questions[idx].v;
    if (good) okRef.current += 1;
    setFeedback(good ? 'ok' : 'ko');
    setTimeout(() => {
      setFeedback(null);
      lockRef.current = false;
      if (idx >= TOTAL - 1) end(okRef.current * 100);
      else setIdx(i => i + 1);
    }, 800);
  };

  const q = questions[idx];
  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 pb-8 transition-colors ${feedback === 'ok' ? 'bg-emerald-500/10' : feedback === 'ko' ? 'bg-rose-500/20' : ''}`}>
      <div className="flex items-center gap-4 mb-6">
        <span className="hud-chip text-white font-black px-4 py-1.5 rounded-full text-sm">{idx + 1}/{TOTAL}</span>
        <span className={`hud-chip font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 3 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="hud-chip text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {okRef.current}</span>
        <ScoreBurst value={okRef.current} color="#6ee7b7" />
      </div>
      <div className="rounded-3xl px-6 py-8 mb-8 min-h-[140px] flex items-center max-w-sm w-full" style={fx.panel}>
        <p className="text-white text-lg font-bold text-center leading-relaxed w-full">
          {feedback ? (feedback === 'ok' ? '✅ ¡Correcto!' : `❌ Era ${q.v ? 'VERDADERO' : 'FALSO'}`) : q.t}
        </p>
      </div>
      <div className="flex gap-4 w-full max-w-xs">
        <button onPointerDown={() => answer(true)} className="flex-1 text-emerald-950 font-black text-lg py-5 rounded-2xl border-b-4 border-emerald-800 active:scale-95 transition-transform" style={fx.tile('#6ee7b7', '#10b981', 'rgba(16,185,129,0.45)')}>VERDADERO</button>
        <button onPointerDown={() => answer(false)} className="flex-1 text-rose-950 font-black text-lg py-5 rounded-2xl border-b-4 border-rose-800 active:scale-95 transition-transform" style={fx.tile('#fda4af', '#f43f5e', 'rgba(244,63,94,0.45)')}>FALSO</button>
      </div>
    </div>
  );
}

export function QuizConvenioGame(props) {
  return (
    <GameShell
      {...props}
      day={25} title="Quiz del Convenio" emoji="⚖️" accent="emerald"
      instructions={[
        <span key="1">10 afirmaciones sobre <strong>tus derechos del convenio</strong>: ¿verdadero o falso?</span>,
        <span key="2">Tienes <strong>10 segundos</strong> por pregunta. Sin responder cuenta como fallo.</span>,
        <span key="3">Cada acierto son 100 puntos… y de paso te aprendes el convenio. 😉</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
