import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Clock, Trophy, AlertTriangle, Play, Gamepad2, Info } from 'lucide-react';

export function CatchTheShiftGame({ onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt }) {
  const [gameState, setGameState] = useState('intro'); // 'intro', 'countdown', 'playing', 'gameover', 'finished'
  const [gameMode, setGameMode] = useState(null); // 'prueba' or 'jugar'
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [items, setItems] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const itemsIdCounter = useRef(0);
  const gameAreaRef = useRef(null);
  const scoreRef = useRef(0);
  const timeLeftRef = useRef(60);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Countdown logic
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('playing');
      }
    }
  }, [gameState, countdown]);

  // Main game timer
  useEffect(() => {
    if (gameState === 'playing') {
      if (timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('finished');
      }
    }
  }, [gameState, timeLeft]);

  // Item generation logic with progressive speed
  useEffect(() => {
    if (gameState !== 'playing') return;

    let timeoutId;

    const generateItem = () => {
      // Calculate speed multiplier based on remaining time (1.0 at 60s -> 0.3 at 0s)
      const progress = 1 - (timeLeftRef.current / 60);
      const speedMult = 1 - (progress * 0.7); // Ends up at 0.3 speed multiplier

      const types = ['target', 'target', 'target', 'decoy', 'alarm'];
      const type = types[Math.floor(Math.random() * types.length)];
      const id = itemsIdCounter.current++;
      const left = Math.floor(Math.random() * 80) + 10;
      
      // Fall duration gets faster
      const baseDuration = Math.random() * 1.5 + 2.0;
      const duration = baseDuration * speedMult;

      setItems(prev => [...prev, { id, type, left, duration }]);

      // Auto remove item after it falls off screen
      setTimeout(() => {
        setItems(prev => prev.filter(item => item.id !== id));
      }, duration * 1000 + 500);

      // Next spawn gets faster too
      const nextSpawnBase = Math.random() * 300 + 400; // 400-700ms
      const nextSpawn = nextSpawnBase * Math.max(speedMult, 0.4); // clamp min spawn rate
      timeoutId = setTimeout(generateItem, nextSpawn);
    };

    generateItem();

    return () => clearTimeout(timeoutId);
  }, [gameState]);

  const handlePointerDown = (item, e) => {
    if (gameState !== 'playing') return;
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    if (item.type === 'target') {
      setScore(s => s + 10);
      showFloatingText('+10', x, y, 'text-emerald-400');
    } else if (item.type === 'alarm' || item.type === 'decoy') {
      // Instant death
      showFloatingText('¡ELIMINADO!', x, y, 'text-rose-500');
      if (gameAreaRef.current) {
        gameAreaRef.current.classList.add('shake-animation');
      }
      setGameState('gameover');
    }

    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const showFloatingText = (text, x, y, colorClass) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, text, x, y, colorClass }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 1000);
  };

  const handleStartMode = (mode) => {
    setGameMode(mode);
    if (onConsumeAttempt) onConsumeAttempt(mode);
    setGameState('countdown');
  };

  const handleEnd = () => {
    if (onFinish) onFinish(scoreRef.current, gameMode);
  };

  // --- INTRO SCREEN ---
  if (gameState === 'intro') {
    return (
      <div className="fixed inset-0 z-[100] bg-[#1a0b2e] text-white flex flex-col p-6 overflow-y-auto animate-in fade-in">
        <button onClick={onCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-30">
          <X size={24} className="text-white" />
        </button>

        <div className="mt-12 flex flex-col items-center pb-24">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.5)] mb-6 border-b-4 border-indigo-800 rotate-12">
            <Gamepad2 size={40} className="text-white" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 text-center">Atrapa el Turno</h2>
          
          <div className="bg-white/5 rounded-3xl p-6 border border-white/10 w-full max-w-sm mt-4 mb-8">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Info size={16} /> Reglas del Juego
            </h3>
            <ul className="space-y-4 text-sm font-medium text-slate-300">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-500 rounded flex-shrink-0 flex items-center justify-center font-black text-white text-xs mt-0.5 border-b-2 border-emerald-700">M</div>
                <p>Toca los <strong className="text-white">turnos verdes</strong> para ganar +10 puntos. ¡Sé preciso!</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded flex-shrink-0 flex items-center justify-center font-black text-white text-xs mt-0.5 border-b-2 border-blue-700">T</div>
                <p>No toques los <strong className="text-white">turnos azules</strong> o estarás <span className="text-rose-400 font-bold">eliminado al instante</span>.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-rose-500 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 border-b-2 border-rose-700">
                  <AlertTriangle size={12} className="text-white" />
                </div>
                <p>Tampoco toques las <strong className="text-white">alarmas rojas</strong>. Te eliminarán.</p>
              </li>
              <li className="bg-indigo-900/40 p-3 rounded-xl border border-indigo-500/30">
                <p className="text-xs text-indigo-200">El juego <strong className="text-white">se acelera</strong> con el tiempo. El que consiga más puntos se pondrá primero en el ranking.</p>
              </li>
            </ul>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <button 
              onClick={() => handleStartMode('prueba')}
              disabled={practiceAttempts <= 0}
              className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2
                ${practiceAttempts > 0 
                  ? 'bg-slate-700 text-white border-slate-900 active:scale-95 shadow-lg hover:bg-slate-600' 
                  : 'bg-slate-800 text-slate-500 border-slate-900 opacity-50 cursor-not-allowed'}`}
            >
              Prueba ({practiceAttempts} oportunidad)
            </button>
            <button 
              onClick={() => handleStartMode('jugar')}
              disabled={playAttempts <= 0}
              className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2
                ${playAttempts > 0 
                  ? 'bg-emerald-500 text-white border-emerald-700 active:scale-95 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400' 
                  : 'bg-slate-800 text-slate-500 border-slate-900 opacity-50 cursor-not-allowed'}`}
            >
              <Play size={18} className={playAttempts > 0 ? 'fill-white' : ''} /> JUGAR PARA RANKING ({playAttempts} op.)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- GAMEOVER / FINISHED SCREEN ---
  if (gameState === 'gameover' || gameState === 'finished') {
    const isEliminated = gameState === 'gameover';
    return (
      <div className="fixed inset-0 z-[100] bg-[#1a0b2e] text-white flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
        {isEliminated ? (
          <AlertTriangle size={80} className="text-rose-500 mb-6 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse" />
        ) : (
          <Trophy size={80} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" />
        )}
        
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-center">
          {isEliminated ? '¡ELIMINADO!' : '¡TIEMPO!'}
        </h2>
        
        {isEliminated && (
          <p className="text-rose-400 font-bold mb-6 text-center max-w-xs">Has tocado un turno incorrecto. Debes ser preciso.</p>
        )}

        <div className="bg-white/10 rounded-3xl p-8 text-center backdrop-blur-md border border-white/20 shadow-2xl mb-8 w-full max-w-sm">
          <p className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-2">Puntos conseguidos</p>
          <p className={`text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br drop-shadow-lg
            ${isEliminated ? 'from-slate-300 to-slate-500' : 'from-emerald-300 to-emerald-600'}`}>
            {score}
          </p>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-indigo-300">
            Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}
          </p>
        </div>
        <button 
          onClick={handleEnd} 
          className="bg-white text-indigo-900 font-black px-10 py-4 rounded-full uppercase text-sm shadow-[0_10px_20px_rgba(255,255,255,0.2)] active:scale-95 transition-all w-full max-w-sm"
        >
          Continuar
        </button>
      </div>
    );
  }

  // --- PLAYING / COUNTDOWN SCREEN ---
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 overflow-hidden font-sans touch-none" ref={gameAreaRef}>
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-lg">
          <Clock size={16} className={timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'} />
          <span className={`font-black text-lg tracking-widest ${timeLeft <= 10 ? 'text-rose-400' : 'text-white'}`}>
            00:{timeLeft.toString().padStart(2, '0')}
          </span>
        </div>
        
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-lg">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">Puntos</span>
          <span className="font-black text-lg text-white">{score}</span>
        </div>
      </div>

      <button 
        onClick={onCancel} 
        className="absolute top-16 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-30"
      >
        <X size={20} className="text-white/60" />
      </button>

      <div className="absolute inset-0 pt-20 pb-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2b087a]/40 to-[#1a0b2e] pointer-events-none"></div>
        
        {items.map(item => (
          <div
            key={item.id}
            onPointerDown={(e) => handlePointerDown(item, e)}
            className="absolute cursor-pointer touch-none active:scale-90"
            style={{
              left: `${item.left}%`,
              top: '0px',
              animation: `game-fall ${item.duration}s linear forwards`,
              transform: 'translateX(-50%)',
            }}
          >
            {item.type === 'target' && (
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-white text-3xl shadow-[0_0_20px_rgba(16,185,129,0.5)] border-b-4 border-emerald-700">
                M
              </div>
            )}
            {item.type === 'decoy' && (
              <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center font-black text-white text-3xl shadow-[0_0_20px_rgba(59,130,246,0.5)] border-b-4 border-blue-700">
                T
              </div>
            )}
            {item.type === 'alarm' && (
              <div className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.5)] border-b-4 border-rose-700 animate-pulse">
                <AlertTriangle size={32} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {floatingTexts.map(ft => (
          <div
            key={ft.id}
            className={`fixed font-black text-3xl z-50 pointer-events-none game-float-up drop-shadow-md ${ft.colorClass}`}
            style={{ left: ft.x - 20, top: ft.y - 20 }}
          >
            {ft.text}
          </div>
        ))}
      </div>

      {gameState === 'countdown' && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col">
          <p className="text-emerald-400 font-bold uppercase tracking-widest mb-4 text-center px-8">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="text-9xl font-black text-white animate-bounce drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
            {countdown > 0 ? countdown : '¡YA!'}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes game-fall {
          0% { transform: translateX(-50%) translateY(-80px) rotate(0deg); }
          100% { transform: translateX(-50%) translateY(110vh) rotate(180deg); }
        }
        @keyframes game-float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-50px) scale(1.5); opacity: 0; }
        }
        .game-float-up {
          animation: game-float-up 0.8s ease-out forwards;
        }
        .shake-animation {
          animation: game-shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes game-shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}} />
    </div>
  );
}
