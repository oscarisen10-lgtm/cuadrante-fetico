import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Timer, Trophy, Crown, Gem, StopCircle, Gamepad2, X } from 'lucide-react';
import { ADMIN_EMAIL } from '../constants/config';
import { submitArenaScore, subscribeToDailyScores, subscribeToStoreScores, getArenaUsage } from '../services/firebaseService';
import { toast } from './Toast';

// Registro de los 31 minijuegos (uno por día del mes).
// Carga perezosa: el código de cada juego solo se descarga cuando se juega.
const GAMES = [
  { day: 1,  id: 'catch',     title: 'ATRAPA EL TURNO',  emoji: '🧲', bgClass: 'bg-[#3a0ca3] border-[#2b087a]',  Component: lazy(() => import('./minigames/CatchTheShiftGame').then(m => ({ default: m.CatchTheShiftGame }))) },
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
  { day: 17, id: 'valida',    title: 'VALIDA',           emoji: '✅', bgClass: 'bg-[#059669] border-[#047857]',  Component: lazy(() => import('./minigames/ValidaGame').then(m => ({ default: m.ValidaGame }))) },
  { day: 18, id: 'equilibrio',title: 'EQUILIBRIO',       emoji: '⚖️', bgClass: 'bg-[#d97706] border-[#b45309]',  Component: lazy(() => import('./minigames/EquilibrioGame').then(m => ({ default: m.EquilibrioGame }))) },
  { day: 19, id: 'diana',     title: 'DIANA',            emoji: '🎯', bgClass: 'bg-[#e11d48] border-[#be123c]',  Component: lazy(() => import('./minigames/DianaGame').then(m => ({ default: m.DianaGame }))) },
  { day: 20, id: 'esquiva',   title: 'ESQUIVA CAJAS',    emoji: '📦', bgClass: 'bg-[#f97316] border-[#ea580c]',  Component: lazy(() => import('./minigames/EsquivaCajasGame').then(m => ({ default: m.EsquivaCajasGame }))) },
  { day: 21, id: 'salto',     title: 'SALTO DEL PALÉ',   emoji: '🤸', bgClass: 'bg-[#84cc16] border-[#65a30d]',  Component: lazy(() => import('./minigames/SaltoPaleGame').then(m => ({ default: m.SaltoPaleGame }))) },
  { day: 22, id: 'carrito',   title: 'CARRITO VOLADOR',  emoji: '🛒', bgClass: 'bg-[#0ea5e9] border-[#0284c7]',  Component: lazy(() => import('./minigames/CarritoVoladorGame').then(m => ({ default: m.CarritoVoladorGame }))) },
  { day: 23, id: 'malabares', title: 'MALABARES',        emoji: '🍉', bgClass: 'bg-[#a855f7] border-[#9333ea]',  Component: lazy(() => import('./minigames/MalabaresGame').then(m => ({ default: m.MalabaresGame }))) },
  { day: 24, id: 'rompe',     title: 'ROMPE CAJAS',      emoji: '🧱', bgClass: 'bg-[#fb923c] border-[#f97316]',  Component: lazy(() => import('./minigames/RompeCajasGame').then(m => ({ default: m.RompeCajasGame }))) },
  { day: 25, id: 'quiz',      title: 'QUIZ DEL CONVENIO', emoji: '⚖️', bgClass: 'bg-[#10b981] border-[#059669]', Component: lazy(() => import('./minigames/QuizConvenioGame').then(m => ({ default: m.QuizConvenioGame }))) },
  { day: 26, id: 'distinto',  title: 'EL DISTINTO',      emoji: '🔍', bgClass: 'bg-[#f472b6] border-[#ec4899]',  Component: lazy(() => import('./minigames/ElDistintoGame').then(m => ({ default: m.ElDistintoGame }))) },
  { day: 27, id: 'orden',     title: 'ORDEN 1-20',       emoji: '👆', bgClass: 'bg-[#4d7c0f] border-[#3f6212]',  Component: lazy(() => import('./minigames/OrdenaNumerosGame').then(m => ({ default: m.OrdenaNumerosGame }))) },
  { day: 28, id: 'palabra',   title: 'PALABRA OCULTA',   emoji: '🟩', bgClass: 'bg-[#16a34a] border-[#15803d]',  Component: lazy(() => import('./minigames/PalabraOcultaGame').then(m => ({ default: m.PalabraOcultaGame }))) },
  { day: 29, id: 'cuenta',    title: 'CUENTA RÁPIDA',    emoji: '🧺', bgClass: 'bg-[#b45309] border-[#92400e]',  Component: lazy(() => import('./minigames/CuentaRapidaGame').then(m => ({ default: m.CuentaRapidaGame }))) },
  { day: 30, id: 'combo',     title: 'COMBO DE FLECHAS', emoji: '🕹️', bgClass: 'bg-[#db2777] border-[#be185d]',  Component: lazy(() => import('./minigames/ComboFlechasGame').then(m => ({ default: m.ComboFlechasGame }))) },
  { day: 31, id: 'ritmo',     title: 'RITMO DE CAJA',    emoji: '🎹', bgClass: 'bg-[#6d28d9] border-[#5b21b6]',  Component: lazy(() => import('./minigames/RitmoCajaGame').then(m => ({ default: m.RitmoCajaGame }))) },
];

export function ArenaView({ user, onPlayingChange }) {
  const [activeTab, setActiveTab] = useState('puntuacion'); // 'clasificacion' or 'puntuacion'
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null); // juego a lanzar (null = el de hoy)
  const [showPicker, setShowPicker] = useState(false);     // selector de TODOS los juegos (admin)
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [gameNumberStr, setGameNumberStr] = useState('');
  const [players, setPlayers] = useState([]);
  const [stores, setStores] = useState([]);
  const [playsUsed, setPlaysUsed] = useState(0);

  const ARENA_DAILY_PLAYS = 3; // debe coincidir con la Cloud Function
  const isAdmin = !!(user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  const todayStr = new Date().toISOString().split('T')[0]; // misma base de fecha (UTC) que el backend

  useEffect(() => {
    // Calculate game number (day of month / total days in month)
    const now = new Date();
    const currentDay = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setGameNumberStr(`# ${currentDay.toString().padStart(2, '0')}/${totalDays}`);

    // Calculate time until next 05:00 AM
    const updateCountdown = () => {
      const d = new Date();
      let nextReset = new Date(d);
      nextReset.setHours(5, 0, 0, 0);
      
      // If we are past 05:00 AM today, next reset is tomorrow at 05:00 AM
      if (d > nextReset) {
        nextReset.setDate(nextReset.getDate() + 1);
      }
      
      const diff = nextReset - d;
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeftStr(`${h}h ${m}m ${s}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  // Juego del día (1-31, uno distinto cada día del mes)
  const currentDay = new Date().getDate();
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
    if (user?.uid) getArenaUsage(user.uid, todayStr).then(setPlaysUsed);
    return () => { unsubP(); unsubS(); };
  }, [user?.uid, todayStr]);

  // Avisa al contenedor para ocultar cabecera/barra mientras se juega una partida.
  useEffect(() => { onPlayingChange?.(isPlaying); }, [isPlaying]);
  useEffect(() => () => onPlayingChange?.(false), []);

  const playAttemptsLeft = isAdmin ? 99 : Math.max(0, ARENA_DAILY_PLAYS - playsUsed);
  const myEntry = players.find(p => p.uid === user?.uid);
  const myRank = myEntry ? players.indexOf(myEntry) + 1 : null;

  const RANK_COLORS = ['bg-[#e56b6f]', 'bg-[#1b998b]', 'bg-[#9d8df1]', 'bg-[#4a4e69]', 'bg-[#577590]'];
  const initialsOf = (n) => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

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
    <div className="h-full bg-[#f6f5ef] text-slate-800 overflow-y-auto scrollbar-hide relative font-sans">
      {/* Cabecera */}
      <header className="flex justify-center items-center gap-2 py-2 sticky top-0 bg-[#f6f5ef]/90 backdrop-blur-md z-50 border-b border-slate-200/50 px-4">
         <div className="bg-white rounded-full px-4 py-1.5 font-black text-[13px] flex items-center gap-2 shadow-sm text-slate-800">
           <span className="flex items-center gap-1" title="Partidas que te quedan hoy">🎮 {isAdmin ? '∞' : playAttemptsLeft}</span>
           <span className="text-slate-200 px-1">|</span>
           <span className="flex items-center gap-1" title="Tu posición en el ranking de hoy">{myRank ? `#${myRank}` : '—'} <Trophy size={14} className="text-amber-500 fill-amber-500"/></span>
         </div>
         {isAdmin && (
           <button onClick={() => setShowPicker(true)} className="bg-violet-600 text-white rounded-full px-3 py-1.5 font-black text-[11px] flex items-center gap-1.5 shadow-sm active:scale-95">
             <Gamepad2 size={14}/> TODOS
           </button>
         )}
      </header>

      {/* Título Principal */}
      <h1 className="text-center font-black text-5xl uppercase tracking-tighter mt-3 mb-4 text-black" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.1)' }}>HOY</h1>

      {/* Tarjeta del Minijuego */}
      <div
        onClick={() => launchGame(activeGame)}
        className={`mx-6 ${activeGame.bgClass} rounded-[2rem] relative shadow-2xl mb-12 flex flex-col items-center justify-center min-h-[220px] border cursor-pointer active:scale-95 transition-transform`}
      >
        <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none z-0">
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
        <div className="absolute top-4 left-4 bg-black/40 text-white text-[11px] font-black px-3 py-1.5 rounded-full z-10">{gameNumberStr}</div>
        <div className="absolute top-4 right-4 bg-black/40 text-white text-[11px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 z-10">
          <Timer size={14} className="animate-pulse" /> {timeLeftStr}
        </div>
        
        {/* Gráfico decorativo: Botones cayendo o Productos según el juego */}
        <div className="relative mt-6 w-full h-28 pointer-events-none flex items-center justify-center">
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
             <div className="flex flex-col items-center justify-center h-full pt-4">
               <div className="w-20 h-5 bg-pink-500 rounded border-b-2 border-pink-700 shadow-md"></div>
               <div className="w-16 h-5 bg-purple-500 rounded border-b-2 border-purple-700 shadow-md border-x border-white/10 mt-0.5 animate-pulse"></div>
               <div className="w-16 h-5 bg-violet-500 rounded border-b-2 border-violet-700 shadow-md border-x border-white/10 mt-0.5" style={{ animation: 'bounce 2.5s infinite 0.2s' }}></div>
               <div className="w-12 h-5 bg-indigo-500 rounded border-b-2 border-indigo-700 shadow-md border-x border-white/10 mt-0.5 animate-bounce"></div>
             </div>
          )}
          {!['zigzag', 'catch', 'freno', 'torre'].includes(activeGame.id) && (
            <>
              <div className="absolute top-0 left-1/4 text-4xl opacity-70 animate-bounce">{activeGame.emoji}</div>
              <div className="text-7xl drop-shadow-2xl z-10" style={{ animation: 'bounce 2.6s infinite 0.1s' }}>{activeGame.emoji}</div>
              <div className="absolute bottom-2 right-1/4 text-4xl opacity-70" style={{ animation: 'bounce 2.2s infinite 0.5s' }}>{activeGame.emoji}</div>
            </>
          )}
        </div>

        <div className="absolute -bottom-5 bg-white text-black font-black uppercase tracking-tighter px-8 py-3 rounded-full text-sm shadow-[0_4px_15px_rgba(0,0,0,0.1)] border-2 border-slate-100 z-20">
          JUGAR: {activeGame.title}
        </div>
      </div>

      {/* Podio (Top 3) */}
      {players.length === 0 ? (
        <div className="text-center px-8 mb-8 mt-2">
          <p className="text-slate-400 font-bold text-sm leading-relaxed">Aún no hay puntuaciones hoy.<br/>¡Sé el primero en jugar! 🏆</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center items-end gap-5 mb-8 px-4 mt-6">
            {players[1] && (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#1b998b] border-2 border-[#f6f5ef] shadow-lg z-10 flex items-center justify-center text-white font-black text-sm">{initialsOf(players[1].name)}</div>
                <span className="text-[10px] font-bold text-slate-500 mt-2 truncate max-w-[70px]">{players[1].name}</span>
                <span className="text-[10px] font-bold text-slate-400">{players[1].score} pts</span>
              </div>
            )}
            <div className="flex flex-col items-center relative">
              <Crown size={28} className="text-amber-400 fill-amber-400 absolute -top-7 z-20 drop-shadow-md" />
              <div className="w-16 h-16 rounded-full bg-[#e56b6f] border-4 border-[#f6f5ef] shadow-lg z-10 flex items-center justify-center text-white font-black text-lg">{initialsOf(players[0].name)}</div>
              <div className="bg-white px-3 py-1 rounded-full shadow-md mt-2 z-20 border border-slate-100 text-center">
                <span className="text-[11px] font-black text-black block truncate max-w-[90px]">{players[0].name}</span>
                <span className="text-[10px] font-bold text-slate-500">{players[0].score} pts</span>
              </div>
            </div>
            {players[2] && (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#9d8df1] border-2 border-[#f6f5ef] shadow-lg z-10 flex items-center justify-center text-white font-black text-sm">{initialsOf(players[2].name)}</div>
                <span className="text-[10px] font-bold text-slate-500 mt-2 truncate max-w-[70px]">{players[2].name}</span>
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
      <div className="mx-6 bg-[#2a2a2a] rounded-full p-1 flex mb-6 shadow-inner">
        <button 
          onClick={() => setActiveTab('clasificacion')}
          className={`flex-1 py-3 rounded-full text-[13px] font-bold transition-all ${activeTab === 'clasificacion' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          Clasificación
        </button>
        <button 
          onClick={() => setActiveTab('puntuacion')}
          className={`flex-1 py-3 rounded-full text-[13px] font-bold transition-all ${activeTab === 'puntuacion' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          Puntuación
        </button>
      </div>

      {/* Lista de Ranking */}
      <div className="flex flex-col gap-3 px-6 pb-6">
        {activeTab === 'puntuacion' ? (
          players.length === 0 ? (
            <p className="text-center text-slate-400 font-bold text-sm py-6">Nadie ha jugado todavía hoy.</p>
          ) : players.map((p, i) => (
            <div key={p.uid} className={`${RANK_COLORS[i % RANK_COLORS.length]} rounded-[1.25rem] p-4 flex items-center text-white relative shadow-sm ${p.uid === user?.uid ? 'ring-2 ring-amber-400' : ''}`}>
              <span className="text-xl font-black w-10 opacity-90">#{i + 1}</span>
              <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/20 mr-3 flex items-center justify-center font-bold shadow-sm">{initialsOf(p.name)}</div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[15px]">{p.score} Puntos</span>
                <span className="text-sm font-medium opacity-90 truncate">{p.name}{p.uid === user?.uid ? ' (tú)' : ''}</span>
              </div>
            </div>
          ))
        ) : (
          stores.length === 0 ? (
            <p className="text-center text-slate-400 font-bold text-sm py-6">Todavía no hay tiendas en el ranking.</p>
          ) : stores.map((s, i) => (
            <div key={s.id} className={`${RANK_COLORS[i % RANK_COLORS.length]} rounded-[1.25rem] p-4 flex items-center text-white relative shadow-sm`}>
              <span className="text-xl font-black w-10 opacity-90">#{i + 1}</span>
              <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/20 mr-3 flex items-center justify-center font-bold shadow-sm text-lg">🏪</div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[15px]">{s.total} Puntos</span>
                <span className="text-sm font-medium opacity-90 truncate">{s.store}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info de la competición */}
      <div className="mx-6 bg-[#e6e4df] rounded-[2rem] p-6 text-center mb-8 relative border-b-4 border-slate-300/50">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm">
          <Trophy size={10} className="fill-white" /> Juego de hoy
        </div>
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2 mt-2">{activeGame.emoji} {activeGame.title}</h4>
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
                  className={`${g.bgClass} rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 aspect-square border active:scale-95 transition-transform text-white`}
                >
                  <span className="text-3xl">{g.emoji}</span>
                  <span className="text-[8px] font-black uppercase tracking-tight leading-tight text-center">{g.title}</span>
                  <span className="text-[7px] font-bold opacity-60">Día {g.day}</span>
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
