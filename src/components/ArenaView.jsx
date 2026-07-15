import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Timer, Trophy, Crown, Gem, StopCircle, Gamepad2, X } from 'lucide-react';
import { isAdminUser } from '../constants/config';
import { submitArenaScore, subscribeToDailyScores, subscribeToStoreScores, getArenaUsage } from '../services/firebaseService';
import { toast } from './Toast';
import { TrileroCover } from './minigames/TrileroCover';
import { TorreCover } from './minigames/TorreCover';
import { SimonCover } from './minigames/SimonCover';
import { EscanerCover } from './minigames/EscanerCover';

// Registro de los 31 minijuegos (uno por día del mes).
// Carga perezosa: el código de cada juego solo se descarga cuando se juega.
const GAMES = [
  { day: 1,  id: 'catch',     title: 'CAJA CERTERA',     emoji: '🎯', bgClass: 'bg-[#0e7490] border-[#155e75]',  Component: lazy(() => import('./minigames/CatchTheShiftGame').then(m => ({ default: m.CatchTheShiftGame }))) },
  { day: 2,  id: 'zigzag',    title: 'CINTA ZIG ZAG',    emoji: '🛒', bgClass: 'bg-[#94a3b8] border-[#64748b]',  Component: lazy(() => import('./minigames/ZigZagGame').then(m => ({ default: m.ZigZagGame }))) },
  { day: 3,  id: 'freno',     title: 'FRENO EN SECO',    emoji: '⏱️', bgClass: 'bg-[#ef4444] border-[#b91c1c]',  Component: lazy(() => import('./minigames/FrenoEnSecoGame').then(m => ({ default: m.FrenoEnSecoGame }))) },
  { day: 4,  id: 'torre',     title: 'TORRE DE BLOQUES', emoji: '🏗️', bgClass: 'bg-gradient-to-br from-[#701a75] to-[#4a044e] border-[#701a75]', Component: lazy(() => import('./minigames/TorreDeBloquesGame').then(m => ({ default: m.TorreDeBloquesGame }))) },
  { day: 5,  id: 'reflejos',  title: 'REFLEJOS',         emoji: '⚡', bgClass: 'bg-[#059669] border-[#047857]',  Component: lazy(() => import('./minigames/ReflejosGame').then(m => ({ default: m.ReflejosGame }))) },
  { day: 6,  id: 'simon',     title: 'SIMÓN DICE',       emoji: '🧠', bgClass: 'bg-[#7c3aed] border-[#6d28d9]',  Component: lazy(() => import('./minigames/SimonDiceGame').then(m => ({ default: m.SimonDiceGame }))) },
  { day: 7,  id: 'parejas',   title: 'PAREJAS',          emoji: '🃏', bgClass: 'bg-[#db2777] border-[#be185d]',  Component: lazy(() => import('./minigames/ParejasGame').then(m => ({ default: m.ParejasGame }))) },
  { day: 8,  id: 'caja',      title: 'CAJA RÁPIDA',      emoji: '🧮', bgClass: 'bg-[#d97706] border-[#b45309]',  Component: lazy(() => import('./minigames/CajaRapidaGame').then(m => ({ default: m.CajaRapidaGame }))) },
  { day: 9,  id: 'color',     title: 'COLOR TRAMPA',     emoji: '🎨', bgClass: 'bg-[#0891b2] border-[#0e7490]',  Component: lazy(() => import('./minigames/ColorTrampaGame').then(m => ({ default: m.ColorTrampaGame }))) },
  { day: 10, id: 'ratones',   title: 'CAZA RATONES',     emoji: '🐭', bgClass: 'bg-[#ea580c] border-[#c2410c]',  Component: lazy(() => import('./minigames/CazaRatonesGame').then(m => ({ default: m.CazaRatonesGame }))) },
  { day: 11, id: 'serpiente', title: 'LA SERPIENTE',     emoji: '🐍', bgClass: 'bg-[#65a30d] border-[#4d7c0f]',  Component: lazy(() => import('./minigames/SerpienteGame').then(m => ({ default: m.SerpienteGame }))) },
  { day: 12, id: 'escaner',   title: 'ESCÁNER',          emoji: '🔦', bgClass: 'bg-[#0891b2] border-[#0e7490]',  Component: lazy(() => import('./minigames/EscanerGame').then(m => ({ default: m.EscanerGame }))) },
  { day: 13, id: 'memoria',   title: 'MEMORIA NUMÉRICA', emoji: '🔐', bgClass: 'bg-[#8b5cf6] border-[#7c3aed]',  Component: lazy(() => import('./minigames/MemoriaNumericaGame').then(m => ({ default: m.MemoriaNumericaGame }))) },
  { day: 14, id: 'ahorcado',  title: 'EL AHORCADO',      emoji: '📝', bgClass: 'bg-[#0284c7] border-[#0369a1]',  Component: lazy(() => import('./minigames/AhorcadoGame').then(m => ({ default: m.AhorcadoGame }))) },
  { day: 15, id: 'relampago', title: 'MEMORIA RELÁMPAGO', emoji: '💡', bgClass: 'bg-[#7c3aed] border-[#6d28d9]', Component: lazy(() => import('./minigames/MemoriaRelampagoGame').then(m => ({ default: m.MemoriaRelampagoGame }))) },
  { day: 16, id: 'corta',     title: 'CORTA',            emoji: '🔪', bgClass: 'bg-[#65a30d] border-[#4d7c0f]',  Component: lazy(() => import('./minigames/CortaGame').then(m => ({ default: m.CortaGame }))) },
  { day: 17, id: 'rastreo',   title: 'RASTREO',          emoji: '📡', bgClass: 'bg-[#059669] border-[#047857]',  Component: lazy(() => import('./minigames/SigueGame').then(m => ({ default: m.SigueGame }))) },
  { day: 18, id: 'equilibrio',title: 'EQUILIBRIO',       emoji: '⚖️', bgClass: 'bg-[#d97706] border-[#b45309]',  Component: lazy(() => import('./minigames/EquilibrioGame').then(m => ({ default: m.EquilibrioGame }))) },
  { day: 19, id: 'trilero',   title: 'TRILERO',          emoji: '🥤', bgClass: 'bg-gradient-to-br from-[#065f46] to-[#03190f] border-[#047857]',  Component: lazy(() => import('./minigames/TrileroGame').then(m => ({ default: m.TrileroGame }))) },
  { day: 20, id: 'encesta',   title: 'ENCESTA',          emoji: '🚚', bgClass: 'bg-[#0284c7] border-[#0369a1]',  Component: lazy(() => import('./minigames/EncestaGame').then(m => ({ default: m.EncestaGame }))) },
  { day: 21, id: 'salto',     title: 'SALTO DEL PALÉ',   emoji: '🤸', bgClass: 'bg-[#84cc16] border-[#65a30d]',  Component: lazy(() => import('./minigames/SaltoPaleGame').then(m => ({ default: m.SaltoPaleGame }))) },
  { day: 22, id: 'carrito',   title: 'CARRITO VOLADOR',  emoji: '🛒', bgClass: 'bg-[#0ea5e9] border-[#0284c7]',  Component: lazy(() => import('./minigames/CarritoVoladorGame').then(m => ({ default: m.CarritoVoladorGame }))) },
  { day: 23, id: 'malabares', title: 'MALABARES',        emoji: '🍉', bgClass: 'bg-[#a855f7] border-[#9333ea]',  Component: lazy(() => import('./minigames/MalabaresGame').then(m => ({ default: m.MalabaresGame }))) },
  { day: 24, id: 'rueda',     title: 'RUEDA',            emoji: '🎡', bgClass: 'bg-[#ea580c] border-[#c2410c]',  Component: lazy(() => import('./minigames/RuedaGame').then(m => ({ default: m.RuedaGame }))) },
  { day: 25, id: 'quiz',      title: 'QUIZ DEL CONVENIO', emoji: '⚖️', bgClass: 'bg-[#10b981] border-[#059669]', Component: lazy(() => import('./minigames/QuizConvenioGame').then(m => ({ default: m.QuizConvenioGame }))) },
  { day: 26, id: 'distinto',  title: 'EL DISTINTO',      emoji: '🔍', bgClass: 'bg-[#f472b6] border-[#ec4899]',  Component: lazy(() => import('./minigames/ElDistintoGame').then(m => ({ default: m.ElDistintoGame }))) },
  { day: 27, id: 'orden',     title: 'ORDEN 1-20',       emoji: '👆', bgClass: 'bg-[#4d7c0f] border-[#3f6212]',  Component: lazy(() => import('./minigames/OrdenaNumerosGame').then(m => ({ default: m.OrdenaNumerosGame }))) },
  { day: 28, id: 'palabra',   title: 'PALABRA OCULTA',   emoji: '🟩', bgClass: 'bg-[#16a34a] border-[#15803d]',  Component: lazy(() => import('./minigames/PalabraOcultaGame').then(m => ({ default: m.PalabraOcultaGame }))) },
  { day: 29, id: 'cuenta',    title: 'CUENTA RÁPIDA',    emoji: '🧺', bgClass: 'bg-[#b45309] border-[#92400e]',  Component: lazy(() => import('./minigames/CuentaRapidaGame').then(m => ({ default: m.CuentaRapidaGame }))) },
  { day: 30, id: 'pulso',     title: 'PULSO',            emoji: '🎯', bgClass: 'bg-[#db2777] border-[#be185d]',  Component: lazy(() => import('./minigames/PulsoGame').then(m => ({ default: m.PulsoGame }))) },
  { day: 31, id: 'ritmo',     title: 'RITMO DE CAJA',    emoji: '🎹', bgClass: 'bg-[#6d28d9] border-[#5b21b6]',  Component: lazy(() => import('./minigames/RitmoCajaGame').then(m => ({ default: m.RitmoCajaGame }))) },
];

// Cuenta atrás hasta el reinicio diario, aislada en su propio componente hoja para que
// el "tick" de cada segundo NO re-renderice toda la ArenaView (podio + 20 filas). El
// reinicio real (partidas y ranking) ocurre a MEDIANOCHE UTC, que es la misma base de
// fecha que usa el backend; antes el cartel prometía las 05:00 locales, que no era cuándo
// realmente se reiniciaba (mentía ~3-4 h). Ahora cuenta al reinicio de verdad.
const ArenaCountdown = React.memo(function ArenaCountdown() {
  const [timeLeftStr, setTimeLeftStr] = useState('');
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const nextReset = new Date(Date.UTC(
        d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0
      ));
      const diff = nextReset - d;
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeftStr(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{timeLeftStr}</>;
});

export function ArenaView({ user, onPlayingChange }) {
  const [activeTab, setActiveTab] = useState('puntuacion'); // 'clasificacion' or 'puntuacion'
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null); // juego a lanzar (null = el de hoy)
  const [showPicker, setShowPicker] = useState(false);     // selector de TODOS los juegos (admin)
  const [players, setPlayers] = useState([]);
  const [stores, setStores] = useState([]);

  const ARENA_DAILY_PLAYS = 3; // debe coincidir con la Cloud Function
  const isAdmin = isAdminUser(user);
  const todayStr = new Date().toISOString().split('T')[0]; // misma base de fecha (UTC) que el backend

  // Partidas usadas hoy, cacheadas en el dispositivo para NO leer la cuota de Firestore
  // en cada visita a la pestaña. El backend sigue siendo la autoridad del límite real
  // (rechaza con resource-exhausted si se supera), así que una caché algo desfasada entre
  // dispositivos es inofensiva. La clave lleva la fecha UTC → se renueva sola cada día.
  const usageKey = `arena_plays_${todayStr}`;
  const [playsUsed, setPlaysUsedState] = useState(() => {
    try {
      const c = localStorage.getItem(usageKey);
      return c !== null ? (Number(c) || 0) : 0;
    } catch { return 0; }
  });
  const setPlaysUsed = useCallback((n) => {
    setPlaysUsedState(n);
    try { localStorage.setItem(usageKey, String(n)); } catch { /* almacenamiento no disponible */ }
  }, [usageKey]);

  // Número de juego (día/total del mes) en base UTC, coherente con el reinicio y con
  // el juego del día (así no divergen cerca de la medianoche UTC).
  const nowUtc = new Date();
  const currentDay = nowUtc.getUTCDate();
  const totalDaysInMonth = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 0)).getUTCDate();
  const gameNumberStr = `# ${currentDay.toString().padStart(2, '0')}/${totalDaysInMonth}`;
  const getActiveGame = (day) => {
    // Permite forzar el juego activo con parámetros en la URL (ej. ?game=torre o ?game=12)
    const hash = window.location.hash || '';
    const searchPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
    const force = new URLSearchParams(searchPart).get('game');
    if (force) {
      const byId = GAMES.find(g => g.id === force);
      if (byId) return byId;
      const n = parseInt(force, 10);
      if (n >= 1 && n <= GAMES.length) return GAMES[n - 1];
    }
    return GAMES[(((day - 1) % GAMES.length) + GAMES.length) % GAMES.length];
  };
  const activeGame = getActiveGame(currentDay);
  const ActiveGameComponent = activeGame.Component;

  // Rankings reales del día + partidas usadas hoy
  useEffect(() => {
    const unsubP = subscribeToDailyScores(todayStr, setPlayers);
    const unsubS = subscribeToStoreScores(todayStr, setStores);
    // Solo leemos la cuota de Firestore si NO la tenemos ya cacheada hoy (ahorra 1
    // lectura por cada entrada a la pestaña Competición).
    let cached = null;
    try { cached = localStorage.getItem(usageKey); } catch { /* almacenamiento no disponible */ }
    if (user?.uid && cached === null) getArenaUsage(user.uid, todayStr).then(setPlaysUsed);
    return () => { unsubP(); unsubS(); };
  }, [user?.uid, todayStr, usageKey, setPlaysUsed]);

  // Avisa al contenedor para ocultar cabecera/barra mientras se juega una partida.
  useEffect(() => { onPlayingChange?.(isPlaying); }, [isPlaying]);
  useEffect(() => () => onPlayingChange?.(false), []);

  const playAttemptsLeft = isAdmin ? 99 : Math.max(0, ARENA_DAILY_PLAYS - playsUsed);
  const myEntry = players.find(p => p.uid === user?.uid);
  const myRank = myEntry ? players.indexOf(myEntry) + 1 : null;

  const RANK_GRADIENTS = [
    { bg: 'linear-gradient(135deg,#f3989b,#d9534f)', glow: 'rgba(217,83,79,0.5)' },
    { bg: 'linear-gradient(135deg,#34c2b1,#138f80)', glow: 'rgba(19,143,128,0.5)' },
    { bg: 'linear-gradient(135deg,#b8abf9,#7c6ce8)', glow: 'rgba(124,108,232,0.5)' },
    { bg: 'linear-gradient(135deg,#5f6590,#3a3e5c)', glow: 'rgba(58,62,92,0.5)' },
    { bg: 'linear-gradient(135deg,#728fab,#46647f)', glow: 'rgba(70,100,127,0.5)' },
  ];
  const rankStyle = (i) => {
    const g = RANK_GRADIENTS[i % RANK_GRADIENTS.length];
    return { background: g.bg, boxShadow: `0 9px 20px -7px ${g.glow}, 0 2px 4px rgba(0,0,0,0.15), inset 0 1.5px 1px rgba(255,255,255,0.4), inset 0 -7px 16px rgba(0,0,0,0.22)` };
  };
  const initialsOf = (n) => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  // Color de avatar consistente por usuario (hash → paleta)
  const AVATAR_PALETTES = [['#fda4af', '#e11d48'], ['#6ee7b7', '#059669'], ['#93c5fd', '#2563eb'], ['#fcd34d', '#d97706'], ['#c4b5fd', '#7c3aed'], ['#67e8f9', '#0891b2'], ['#f9a8d4', '#db2777']];
  const avatarGrad = (key) => {
    const s = String(key || '?'); let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const [a, b] = AVATAR_PALETTES[h % AVATAR_PALETTES.length];
    return `linear-gradient(135deg,${a},${b})`;
  };

  const launchGame = (game) => { setSelectedGame(game); setShowPicker(false); setIsPlaying(true); };

  const handleFinish = async (score, mode) => {
    setIsPlaying(false);
    if (mode !== 'jugar') return; // las partidas de "prueba" no puntúan
    const g = selectedGame || activeGame;
    try {
      const res = await submitArenaScore(g.id, score);
      if (!isAdmin && res?.attemptsLeft !== undefined) setPlaysUsed(ARENA_DAILY_PLAYS - res.attemptsLeft);
      toast(res?.improved ? `¡Nueva marca: ${res.best} pts! 🎉` : `Has hecho ${score} pts`, 'success');
    } catch (e) {
      toast(e.message || 'No se pudo guardar la puntuación.', 'error');
    }
  };

  return (
    <div className="h-full text-slate-800 overflow-y-auto scrollbar-hide relative font-sans" style={{ background: 'radial-gradient(125% 90% at 50% -8%, #fffdf7 0%, #f3eddd 46%, #e6ddc8 100%)' }}>
      {/* Capa decorativa de profundidad: orbes de color + retícula sutil (gradientes estáticos = baratos) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: -1 }}>
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18), transparent 70%)' }} />
        <div className="absolute top-44 -right-24 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)' }} />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[130%] h-72 rounded-[50%]" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(16,185,129,0.14), transparent 72%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse at 50% 30%, #000 40%, transparent 85%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, #000 40%, transparent 85%)' }} />
      </div>

      {/* Cabecera */}
      <header className="flex justify-center items-center gap-2 py-2.5 sticky top-0 z-50 px-4" style={{ background: 'linear-gradient(180deg, rgba(255,253,247,0.92), rgba(243,237,221,0.72))', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 12px rgba(120,90,40,0.07)' }}>
         <div className="rounded-full px-4 py-2 font-black text-[13px] flex items-center gap-2.5 text-slate-800" style={{ background: 'linear-gradient(180deg, #ffffff, #f1ece0)', boxShadow: '0 2px 6px rgba(120,90,40,0.18), inset 0 1px 2px rgba(255,255,255,0.95), inset 0 -2px 4px rgba(120,90,40,0.08)' }}>
           <span className="flex items-center gap-1.5" title="Partidas que te quedan hoy"><span className="text-base leading-none">🎮</span> {isAdmin ? '∞' : playAttemptsLeft}</span>
           <span className="w-px h-4 bg-slate-300/70" />
           <span className="flex items-center gap-1.5" title="Tu posición en el ranking de hoy">{myRank ? `#${myRank}` : '—'} <Trophy size={14} className="text-amber-500 fill-amber-500 drop-shadow-[0_1px_1px_rgba(180,120,0,0.4)]"/></span>
         </div>
         {isAdmin && (
           <button onClick={() => setShowPicker(true)} className="btn3d text-white rounded-full px-3.5 py-2 font-black text-[11px] flex items-center gap-1.5" style={{ background: 'linear-gradient(180deg, #a78bfa, #7c3aed 60%, #6d28d9)', boxShadow: '0 4px 10px rgba(124,58,237,0.45), inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(76,29,149,0.5)' }}>
             <Gamepad2 size={14}/> TODOS
           </button>
         )}
      </header>

      {/* Título Principal */}
      <h1 className="text-center font-black text-[3.4rem] uppercase tracking-tighter mt-4 mb-5 leading-none breathe" style={{ background: 'linear-gradient(180deg, #1f2937 0%, #4b5563 55%, #1f2937 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 2px 0 rgba(255,255,255,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.18))' }}>HOY</h1>

      {/* Tarjeta del Minijuego */}
      <div
        onClick={() => launchGame(activeGame)}
        className={`group mx-6 ${activeGame.bgClass} rounded-[2.2rem] relative mb-14 flex flex-col items-center justify-center min-h-[232px] border cursor-pointer btn3d`}
        style={{ boxShadow: '0 22px 46px -14px rgba(0,0,0,0.6), 0 8px 18px rgba(0,0,0,0.25)' }}
      >
        {/* brillo superior tipo cristal + aro interior de luz (profundidad) */}
        <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-[2.2rem] pointer-events-none z-[1]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 80%)' }} />
        <div className="absolute inset-0 rounded-[2.2rem] pointer-events-none z-[1]" style={{ boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.5), inset 0 0 0 1.5px rgba(255,255,255,0.16), inset 0 -16px 32px rgba(0,0,0,0.34)' }} />
        <div className="sheen absolute inset-0 rounded-[2.2rem] overflow-hidden pointer-events-none z-0">
          {activeGame.id === 'zigzag' && (
             <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #475569 40px, #475569 80px)', animation: 'belt-move 1.5s linear infinite' }}></div>
          )}
          {activeGame.id === 'freno' && (
             <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <Timer size={180} className="text-black animate-pulse" />
             </div>
          )}
          {activeGame.id === 'torre' && (
             <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-950/40 via-transparent to-transparent flex items-end justify-center opacity-30">
               <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-fuchsia-500/20 via-transparent to-transparent"></div>
             </div>
          )}
        </div>
        <div className="absolute top-4 left-4 text-white text-[11px] font-black px-3 py-1.5 rounded-full z-10" style={{ background: 'rgba(0,0,0,0.34)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.28), 0 2px 6px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.14)' }}>{gameNumberStr}</div>
        <div className="absolute top-4 right-4 text-white text-[11px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 z-10" style={{ background: 'rgba(0,0,0,0.34)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.28), 0 2px 6px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <Timer size={14} className="animate-pulse" /> <ArenaCountdown />
        </div>

        {/* Gráfico decorativo: Botones cayendo o Productos según el juego */}
        <div className="relative z-10 mt-6 w-full h-28 pointer-events-none flex items-center justify-center">
          {activeGame.id === 'zigzag' && (
            <>
              <div className="absolute top-0 left-1/4 w-10 h-10 bg-white border-b-4 border-slate-300 rounded-xl shadow-lg rotate-12 flex items-center justify-center animate-bounce">
                <span className="text-xl">🍎</span>
              </div>
              <div className="absolute top-6 right-1/4 w-8 h-8 bg-white border-b-4 border-slate-300 rounded-xl shadow-lg -rotate-12 flex items-center justify-center" style={{ animation: 'bounce 2.2s infinite 0.5s' }}>
                <span className="text-lg">🛒</span>
              </div>
              <div className="absolute bottom-2 left-1/3 w-8 h-8 bg-white border-b-4 border-slate-300 rounded-xl shadow-lg rotate-45 flex items-center justify-center" style={{ animation: 'bounce 1.8s infinite 1s' }}>
                 <span className="text-lg">📦</span>
              </div>
              <div className="absolute bottom-6 right-1/3 w-12 h-12 bg-emerald-500 border-b-4 border-emerald-700 rounded-full shadow-lg -rotate-6 flex items-center justify-center" style={{ animation: 'bounce 2.5s infinite 0.2s' }}>
                <div className="w-4 h-4 bg-emerald-300 rounded-full animate-pulse"></div>
              </div>
            </>
          )}
          {activeGame.id === 'catch' && (
            <>
              <div className="absolute top-0 left-1/4 w-10 h-10 bg-emerald-400 border-b-4 border-emerald-600 rounded-xl shadow-lg rotate-12 flex items-center justify-center animate-bounce">
                <span className="text-emerald-900 font-black text-xs">+1</span>
              </div>
              <div className="absolute top-6 right-1/4 w-8 h-8 bg-rose-400 border-b-4 border-rose-600 rounded-full shadow-lg -rotate-12 flex items-center justify-center" style={{ animation: 'bounce 2.2s infinite 0.5s' }}>
                <span className="text-rose-900 font-black text-xs">✗</span>
              </div>
              <div className="absolute bottom-2 left-1/3 w-8 h-8 bg-blue-400 border-b-4 border-blue-600 rounded-full shadow-lg rotate-45 flex items-center justify-center" style={{ animation: 'bounce 1.8s infinite 1s' }}>
                 <span className="text-blue-900 font-black text-xs">✗</span>
              </div>
              <div className="absolute bottom-6 right-1/3 w-12 h-12 bg-emerald-400 border-b-4 border-emerald-600 rounded-xl shadow-lg -rotate-6 flex items-center justify-center" style={{ animation: 'bounce 2.5s infinite 0.2s' }}>
                <span className="text-emerald-900 font-black text-sm">+1</span>
              </div>
            </>
          )}
          {activeGame.id === 'freno' && (
             <>
               <div className="text-white text-6xl font-black drop-shadow-xl z-10">
                 10:00
               </div>
               <div className="absolute -bottom-4 bg-black/30 rounded-full px-6 py-2 border border-white/20">
                 <span className="text-white/80 font-bold tracking-widest text-sm flex items-center gap-1"><StopCircle size={14}/> FRENAR</span>
               </div>
             </>
          )}
          {activeGame.id === 'torre' && (
            <TorreCover className="w-full h-full" style={{ filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.45))' }} />
          )}
          {activeGame.id === 'trilero' && (
            <TrileroCover className="w-full h-full" style={{ filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.45))' }} />
          )}
          {activeGame.id === 'simon' && (
            <SimonCover className="w-full h-full" style={{ filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.45))' }} />
          )}
          {activeGame.id === 'escaner' && (
            <EscanerCover className="w-full h-full" style={{ filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.45))' }} />
          )}
          {!['zigzag', 'catch', 'freno', 'torre', 'trilero', 'simon', 'escaner'].includes(activeGame.id) && (
            <>
              <div className="absolute top-0 left-1/4 text-4xl opacity-60 float-soft" style={{ animationDelay: '0.6s' }}>{activeGame.emoji}</div>
              <div className="text-[5rem] float-soft z-10" style={{ filter: 'drop-shadow(0 12px 16px rgba(0,0,0,0.45))' }}>{activeGame.emoji}</div>
              <div className="absolute bottom-2 right-1/4 text-4xl opacity-60 float-soft" style={{ animationDelay: '1.1s' }}>{activeGame.emoji}</div>
            </>
          )}
        </div>

        <div className="btn3d sheen absolute -bottom-5 text-slate-900 font-black uppercase tracking-tight px-6 py-3 rounded-full text-sm z-20 flex items-center gap-2" style={{ background: 'linear-gradient(180deg, #ffffff, #ece9e1)', boxShadow: '0 9px 20px rgba(0,0,0,0.24), inset 0 2px 2px rgba(255,255,255,0.95), inset 0 -3px 6px rgba(120,90,40,0.14)', border: '1px solid rgba(255,255,255,0.85)' }}>
          <span className="grid place-items-center w-5 h-5 rounded-full text-white text-[10px] pl-0.5" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 1px 3px rgba(5,150,105,0.55), inset 0 1px 1px rgba(255,255,255,0.5)' }}>▶</span>
          {activeGame.title}
        </div>
      </div>

      {/* Podio (Top 3) */}
      {players.length === 0 ? (
        <div className="flex flex-col items-center text-center px-8 mb-8 mt-2 pop-in">
          <div className="grid place-items-center w-20 h-20 rounded-full mb-3" style={{ background: 'linear-gradient(180deg,#fef3c7,#fcd34d)', boxShadow: '0 8px 20px rgba(245,158,11,0.35), inset 0 2px 3px rgba(255,255,255,0.7)' }}>
            <Trophy size={34} className="text-amber-600 fill-amber-500/40" />
          </div>
          <p className="text-slate-500 font-black text-sm leading-relaxed">Aún no hay puntuaciones hoy</p>
          <p className="text-slate-400 font-bold text-xs mt-0.5">¡Sé el primero en jugar! 🏆</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center items-end gap-5 mb-9 px-4 mt-7">
            {players[1] && (
              <div className="flex flex-col items-center pop-in" style={{ animationDelay: '0.05s' }}>
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(160deg,#f8fafc,#94a3b8 55%,#64748b)', boxShadow: '0 7px 15px rgba(100,116,139,0.5), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 8px rgba(0,0,0,0.25)' }} />
                  <div className="absolute inset-0 grid place-items-center text-white font-black text-base" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{initialsOf(players[1].name)}</div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 grid place-items-center rounded-full text-[9px] font-black text-slate-700" style={{ background: 'linear-gradient(180deg,#fff,#cbd5e1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>2</span>
                </div>
                <span className="text-[11px] font-black text-slate-600 mt-3 truncate max-w-[72px]">{players[1].name}</span>
                <span className="text-[10px] font-bold text-slate-400">{players[1].score} pts</span>
              </div>
            )}
            <div className="flex flex-col items-center relative pop-in">
              <Crown size={30} className="text-amber-400 fill-amber-400 absolute -top-8 z-20 twinkle" style={{ filter: 'drop-shadow(0 2px 4px rgba(180,120,0,0.5))' }} />
              <div className="relative w-[4.6rem] h-[4.6rem]">
                <div className="absolute -inset-1.5 rounded-full" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.5), transparent 70%)' }} />
                <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(160deg,#fef3c7,#f59e0b 52%,#b45309)', boxShadow: '0 11px 24px rgba(245,158,11,0.55), inset 0 2px 4px rgba(255,255,255,0.95), inset 0 -5px 10px rgba(120,53,15,0.4)' }} />
                <div className="absolute inset-0 grid place-items-center text-white font-black text-xl" style={{ textShadow: '0 1px 3px rgba(120,53,15,0.6)' }}>{initialsOf(players[0].name)}</div>
              </div>
              <div className="px-3 py-1 rounded-full mt-3 z-20 text-center" style={{ background: 'linear-gradient(180deg,#fff,#f1ece0)', boxShadow: '0 4px 10px rgba(120,90,40,0.2), inset 0 1px 2px rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.8)' }}>
                <span className="text-[11px] font-black text-slate-900 block truncate max-w-[92px]">{players[0].name}</span>
                <span className="text-[10px] font-bold text-amber-600">{players[0].score} pts</span>
              </div>
            </div>
            {players[2] && (
              <div className="flex flex-col items-center pop-in" style={{ animationDelay: '0.1s' }}>
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(160deg,#fcd9b6,#d97706 55%,#9a3412)', boxShadow: '0 7px 15px rgba(217,119,6,0.5), inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -4px 8px rgba(0,0,0,0.25)' }} />
                  <div className="absolute inset-0 grid place-items-center text-white font-black text-base" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{initialsOf(players[2].name)}</div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 grid place-items-center rounded-full text-[9px] font-black text-amber-900" style={{ background: 'linear-gradient(180deg,#fde9d2,#fbbf80)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>3</span>
                </div>
                <span className="text-[11px] font-black text-slate-600 mt-3 truncate max-w-[72px]">{players[2].name}</span>
                <span className="text-[10px] font-bold text-slate-400">{players[2].score} pts</span>
              </div>
            )}
          </div>

          {/* Mejor Jugador */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-4">
              <span className="text-3xl grayscale opacity-50">🌿</span>
              <div className="text-center">
                <span className="text-xs font-bold uppercase text-slate-800 block mb-1">Mejor jugador</span>
                <span className="text-2xl font-black uppercase text-black block tracking-tighter">{players[0].name}</span>
                <span className="text-xs font-bold text-slate-500">{players[0].score} Puntos</span>
              </div>
              <span className="text-3xl grayscale opacity-50 transform scale-x-[-1]">🌿</span>
            </div>
          </div>
        </>
      )}

      {/* Tabs Clasificación / Puntuación */}
      <div className="mx-6 rounded-full p-1 mb-6 relative" style={{ background: 'linear-gradient(180deg,#2c2c2c,#191919)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06)' }}>
        {/* indicador deslizante */}
        <div
          className="absolute top-1 bottom-1 rounded-full transition-transform duration-300 ease-out pointer-events-none"
          style={{ width: 'calc(50% - 4px)', left: 4, transform: activeTab === 'clasificacion' ? 'translateX(0%)' : 'translateX(100%)', background: 'linear-gradient(180deg,#5e5e5e,#2e2e2e)', boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1.5px 1px rgba(255,255,255,0.28)' }}
        />
        <div className="relative flex">
          {[['clasificacion', 'Clasificación'], ['puntuacion', 'Puntuación']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-3 rounded-full text-[13px] font-black transition-colors duration-200 z-10 ${activeTab === id ? 'text-white' : 'text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Ranking */}
      <div className="flex flex-col gap-3 px-6 pb-6">
        {activeTab === 'puntuacion' ? (
          players.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 pop-in">
              <div className="grid place-items-center w-16 h-16 rounded-full mb-3" style={{ background: 'linear-gradient(180deg,#e2e8f0,#cbd5e1)', boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7), 0 4px 10px rgba(0,0,0,0.08)' }}>
                <Gamepad2 size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-400 font-bold text-sm">Nadie ha jugado todavía hoy.</p>
            </div>
          ) : players.map((p, i) => (
            <div key={p.uid} className={`rounded-[1.4rem] p-3.5 flex items-center text-white relative rise-in ${p.uid === user?.uid ? 'ring-2 ring-amber-300' : ''}`} style={{ ...rankStyle(i), animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}>
              <span className="w-9 h-9 mr-3 grid place-items-center rounded-full text-[15px] font-black shrink-0" style={{ background: 'rgba(0,0,0,0.22)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.28), inset 0 -2px 3px rgba(0,0,0,0.28)', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{i + 1}</span>
              <div className="w-11 h-11 rounded-full mr-3 grid place-items-center font-black shrink-0 text-white" style={{ background: avatarGrad(p.uid || p.name), boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.2)', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{initialsOf(p.name)}</div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[16px] leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{p.score} <span className="text-[11px] font-bold opacity-80">PTS</span></span>
                <span className="text-[13px] font-medium opacity-90 truncate">{p.name}{p.uid === user?.uid ? ' · tú' : ''}</span>
              </div>
            </div>
          ))
        ) : (
          stores.length === 0 ? (
            <p className="text-center text-slate-400 font-bold text-sm py-6">Todavía no hay tiendas en el ranking.</p>
          ) : stores.map((s, i) => (
            <div key={s.id} className="rounded-[1.4rem] p-3.5 flex items-center text-white relative rise-in" style={{ ...rankStyle(i), animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}>
              <span className="w-9 h-9 mr-3 grid place-items-center rounded-full text-[15px] font-black shrink-0" style={{ background: 'rgba(0,0,0,0.22)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.28), inset 0 -2px 3px rgba(0,0,0,0.28)', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{i + 1}</span>
              <div className="w-11 h-11 rounded-full mr-3 grid place-items-center text-lg shrink-0" style={{ background: 'rgba(255,255,255,0.2)', boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.35), inset 0 -3px 5px rgba(0,0,0,0.22)' }}>🏪</div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[16px] leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{s.total} <span className="text-[11px] font-bold opacity-80">PTS</span></span>
                <span className="text-[13px] font-medium opacity-90 truncate">{s.store}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info de la competición */}
      <div className="mx-6 rounded-[2rem] p-6 text-center mb-8 relative" style={{ background: 'linear-gradient(180deg,#fbfaf6,#e9e5da)', boxShadow: '0 12px 26px -12px rgba(120,90,40,0.28), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -3px 8px rgba(120,90,40,0.08)', border: '1px solid rgba(255,255,255,0.7)' }}>
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase flex items-center gap-1.5" style={{ background: 'linear-gradient(180deg,#a78bfa,#7c3aed)', boxShadow: '0 4px 10px rgba(124,58,237,0.45), inset 0 1px 1px rgba(255,255,255,0.5)' }}>
          <Trophy size={10} className="fill-white" /> Juego de hoy
        </div>
        <h4 className="text-base font-black text-slate-800 uppercase tracking-wide mb-2 mt-2 flex items-center justify-center gap-2"><span className="text-xl">{activeGame.emoji}</span> {activeGame.title}</h4>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
          Cada día, un juego distinto. Tienes {ARENA_DAILY_PLAYS} partidas para tu mejor marca.<br/>¡Compite por el orgullo de tu tienda!
        </p>
      </div>

      <p className="text-center text-[10px] text-slate-400 font-bold px-12 pb-12 leading-relaxed mb-4">
        El ranking se reinicia cada día. Solo por diversión 🎮
      </p>

      {isPlaying && (() => {
        const pg = selectedGame || activeGame;
        const PlayComp = pg.Component;
        return (
          <Suspense fallback={
            <div className="fixed inset-0 z-50 bg-[#1e1b4b] flex flex-col items-center justify-center text-white font-black gap-3">
              <span className="text-5xl animate-bounce">{pg.emoji}</span>
              <span className="text-sm uppercase tracking-widest animate-pulse">Cargando juego...</span>
            </div>
          }>
            <PlayComp
              practiceAttempts={99}
              playAttempts={playAttemptsLeft}
              bestScore={pg.id === activeGame.id ? (myEntry?.score || 0) : 0}
              onConsumeAttempt={() => {}}
              onCancel={() => setIsPlaying(false)}
              onFinish={handleFinish}
            />
          </Suspense>
        );
      })()}

      {/* Selector de TODOS los juegos (solo admin, modo pruebas) */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col p-5 overflow-y-auto" onClick={() => setShowPicker(false)}>
          <div className="max-w-md mx-auto w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 py-2">
              <h2 className="text-white font-black text-xl flex items-center gap-2"><Gamepad2 size={22} className="text-violet-400"/> Modo pruebas</h2>
              <button onClick={() => setShowPicker(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white active:scale-90"><X size={22}/></button>
            </div>
            <p className="text-white/50 text-xs font-bold mb-4 px-1">Solo tú (admin) ves esto. Prueba cualquiera de los 31 juegos sin esperar al día.</p>
            <div className="grid grid-cols-3 gap-2.5 pb-8">
              {GAMES.map(g => (
                <button
                  key={g.id}
                  onClick={() => launchGame(g)}
                  className={`btn3d ${g.bgClass} rounded-2xl p-3 flex flex-col items-center justify-center gap-1 aspect-square border text-white relative overflow-hidden`}
                  style={{ boxShadow: '0 8px 16px -6px rgba(0,0,0,0.5), inset 0 1.5px 0 rgba(255,255,255,0.3), inset 0 -8px 16px rgba(0,0,0,0.3)' }}
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.22),transparent)' }} />
                  {g.id === 'trilero'
                    ? <TrileroCover className="w-full h-12 relative" />
                    : g.id === 'torre'
                    ? <TorreCover className="w-full h-12 relative" />
                    : g.id === 'simon'
                    ? <SimonCover className="w-full h-12 relative" />
                    : g.id === 'escaner'
                    ? <EscanerCover className="w-full h-12 relative" />
                    : <span className="text-3xl relative" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.4))' }}>{g.emoji}</span>}
                  <span className="text-[8px] font-black uppercase tracking-tight leading-tight text-center relative">{g.title}</span>
                  <span className="text-[7px] font-bold opacity-70 relative">Día {g.day}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes belt-move {
          0% { transform: translateY(-80px); }
          100% { transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
