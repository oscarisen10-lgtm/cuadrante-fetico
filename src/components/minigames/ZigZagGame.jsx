import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Clock, Trophy, AlertTriangle, Play, Gamepad2, Info } from 'lucide-react';
import { GameBackground, ScoreBurst } from './gameFx';

export function ZigZagGame({ onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt }) {
  const [gameState, setGameState] = useState('intro'); // 'intro', 'countdown', 'playing', 'gameover', 'finished'
  const [gameMode, setGameMode] = useState(null); // 'prueba' or 'jugar'
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [items, setItems] = useState([]);
  const itemsIdCounter = useRef(0);
  const gameAreaRef = useRef(null);
  const scoreRef = useRef(0);
  const timeLeftRef = useRef(60);
  const reqRef = useRef();
  
  // Continuous movement state
  const playerXRef = useRef(window.innerWidth / 2);
  const playerYRef = useRef(160);
  const playerDirRef = useRef(1); // 1 = right, -1 = left

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Center player initially
  useEffect(() => {
    playerXRef.current = window.innerWidth / 2;
    playerYRef.current = 160;
    playerDirRef.current = 1;
    const playerEl = document.getElementById('player-ball');
    if (playerEl) {
      playerEl.style.left = `${playerXRef.current}px`;
      playerEl.style.bottom = `${playerYRef.current}px`;
    }
  }, [gameState]);

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

  // Main game timer and scoring
  useEffect(() => {
    if (gameState === 'playing') {
      if (timeLeft > 0) {
        const timer = setTimeout(() => {
          setTimeLeft(t => t - 1);
          setScore(s => s + 15); // 15 points per second
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('finished');
      }
    }
  }, [gameState, timeLeft]);

  // Collision Detection and Movement Loop
  const checkCollisions = useCallback(() => {
    if (gameState !== 'playing') return;
    const player = document.getElementById('player-ball');
    if (player) {
      // Update player position continuously
      let progress = 1 - (timeLeftRef.current / 60);
      let currentSpeed = 5 + (progress * 12); // Speed increases from 5 to 17
      let newX = playerXRef.current + playerDirRef.current * currentSpeed;
      
      // Vertical movement
      let climbSpeed = 0.02 + (progress * 0.06); // Slowly climb faster as time goes on
      let newY = playerYRef.current + climbSpeed;
      
      // Bounce off walls
      if (newX < 30) {
        newX = 30;
        playerDirRef.current = 1;
      } else if (newX > window.innerWidth - 30) {
        newX = window.innerWidth - 30;
        playerDirRef.current = -1;
      }
      
      playerXRef.current = newX;
      playerYRef.current = newY;
      player.style.left = `${newX}px`;
      player.style.bottom = `${newY}px`;

      const pRect = player.getBoundingClientRect();
      const obstacles = document.querySelectorAll('.game-obstacle');
      
      // Inflate bounding box slightly for forgiveness
      const margin = 8;
      const pLeft = pRect.left + margin;
      const pRight = pRect.right - margin;
      const pTop = pRect.top + margin;
      const pBottom = pRect.bottom - margin;

      for (let i = 0; i < obstacles.length; i++) {
        const oRect = obstacles[i].getBoundingClientRect();
        if (
          pLeft < oRect.right - margin &&
          pRight > oRect.left + margin &&
          pTop < oRect.bottom - margin &&
          pBottom > oRect.top + margin
        ) {
          // Collision!
          if (gameAreaRef.current) {
            gameAreaRef.current.classList.add('shake-animation');
          }
          setGameState('gameover');
          return; // Stop checking
        }
      }
    }
    reqRef.current = requestAnimationFrame(checkCollisions);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      reqRef.current = requestAnimationFrame(checkCollisions);
    }
    return () => cancelAnimationFrame(reqRef.current);
  }, [gameState, checkCollisions]);

  // Item generation logic with progressive speed
  useEffect(() => {
    if (gameState !== 'playing') return;

    let timeoutId;

    const generateItem = () => {
      const progress = 1 - (timeLeftRef.current / 60);

      const emojis = ['🍎', '🥦', '🍗', '🥛', '📦', '🛒', '🛍️', '🍅', '🧴', '🥚'];
      const icon = emojis[Math.floor(Math.random() * emojis.length)];
      const id = itemsIdCounter.current++;
      
      // Random starting X
      const maxLeft = window.innerWidth - 60;
      const left = Math.floor(Math.random() * maxLeft) + 10;
      
      // Fall duration gets faster
      // Start at ~3.5 seconds, but scales down faster to ~1.0 seconds
      const baseDuration = Math.random() * 0.5 + 3.0; 
      const duration = Math.max(1.0, baseDuration - (progress * 2.5));

      setItems(prev => [...prev, { id, icon, left, duration }]);

      // Auto remove item after it falls off screen
      setTimeout(() => {
        setItems(prev => prev.filter(item => item.id !== id));
      }, duration * 1000 + 500);

      // Spawn rate gets faster
      // Start at 1.2s, drop quickly down to ~200ms
      const spawnBase = 1200 - (progress * 1000); 
      const nextSpawn = spawnBase + (Math.random() * 200 - 100); 
      timeoutId = setTimeout(generateItem, Math.max(nextSpawn, 200));
    };

    generateItem();

    return () => clearTimeout(timeoutId);
  }, [gameState]);

  const handlePointerDown = (e) => {
    if (gameState !== 'playing') return;
    // Tap to switch direction
    playerDirRef.current *= -1;
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
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] mb-6 border-b-4 border-emerald-800 rotate-12">
            <Gamepad2 size={40} className="text-white" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 text-center">Cinta ZigZag</h2>
          
          <div className="bg-white/5 rounded-3xl p-6 border border-white/10 w-full max-w-sm mt-4 mb-8">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Info size={16} /> Reglas del Juego
            </h3>
            <ul className="space-y-4 text-sm font-medium text-slate-300">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex-shrink-0 flex items-center justify-center font-black text-white text-xs mt-0.5 border-b-2 border-emerald-700"></div>
                <p>Tú eres la <strong className="text-white">bola verde</strong>. No para de moverse, <strong className="text-amber-400">toca la pantalla</strong> para cambiar su dirección y evitar los choques.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-slate-200 rounded flex-shrink-0 flex items-center justify-center text-xs mt-0.5">🛒</div>
                <p><strong className="text-white">Esquiva</strong> los productos que caen por la cinta de caja. Si tocas uno, fin del juego.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-500 rounded flex-shrink-0 flex items-center justify-center font-black text-white text-xs mt-0.5 border-b-2 border-amber-700">+</div>
                <p>Ganas <strong className="text-emerald-400">15 puntos</strong> por cada segundo que sobrevivas.</p>
              </li>
              <li className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-500/30">
                <p className="text-xs text-emerald-200">La cinta <strong className="text-white">se acelera</strong> con el tiempo. ¿Aguantarás los 60 segundos completos?</p>
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
            <button 
              onClick={onCancel}
              className="w-full py-4 mt-2 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 active:scale-95"
            >
              VOLVER ATRÁS
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
          {isEliminated ? '¡CHOCASTE!' : '¡TIEMPO!'}
        </h2>
        
        {isEliminated && (
          <p className="text-rose-400 font-bold mb-6 text-center max-w-xs">Un producto te ha aplastado. Más suerte la próxima.</p>
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
    <div
      className="fixed inset-0 z-[100] bg-[#060a14] overflow-hidden font-sans touch-none"
      ref={gameAreaRef}
      onPointerDown={handlePointerDown}
    >
      <ScoreBurst value={score} color="#67e8f9" />
      <GameBackground theme="slate" />
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 pointer-events-none">
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

      {/* Cinta transportadora */}
      <div className="absolute inset-0 pt-20 pb-10 pointer-events-none flex justify-center z-10">
        {/* Cinta metálica con rieles brillantes */}
        <div className="w-[84%] h-full relative overflow-hidden rounded-t-[2rem]"
          style={{ background: 'linear-gradient(90deg, #1e293b, #475569 18%, #64748b 50%, #475569 82%, #1e293b)', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.55), 0 0 40px rgba(0,0,0,0.5)' }}>
           <div className="absolute left-0 top-0 bottom-0 w-2.5" style={{ background: 'linear-gradient(180deg, #22d3ee, #0891b2)', boxShadow: '0 0 14px #22d3ee' }} />
           <div className="absolute right-0 top-0 bottom-0 w-2.5" style={{ background: 'linear-gradient(180deg, #22d3ee, #0891b2)', boxShadow: '0 0 14px #22d3ee' }} />
           <div className="absolute inset-0 z-0 opacity-30 conveyor-lines"></div>
        </div>

        {items.map(item => (
          <div
            key={item.id}
            className="absolute z-10 game-obstacle"
            style={{
              left: `${item.left}px`,
              top: '0px',
              animation: `game-fall ${item.duration}s linear forwards`,
            }}
          >
            <div className="gfx-pop w-14 h-14 rounded-2xl flex items-center justify-center text-4xl border-b-4 border-slate-400"
              style={{ background: 'linear-gradient(145deg, #ffffff, #dbe2ea)', boxShadow: '0 8px 18px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.9)' }}>
              {item.icon}
            </div>
          </div>
        ))}

        {/* Bola del jugador */}
        <div
          id="player-ball"
          className="absolute w-12 h-12 rounded-full border-2 border-emerald-100 flex items-center justify-center transform -translate-x-1/2 z-20"
          style={{ left: playerXRef.current, bottom: playerYRef.current, background: 'radial-gradient(circle at 35% 30%, #a7f3d0, #10b981 60%, #047857)', boxShadow: '0 0 26px rgba(16,185,129,0.9), inset 0 2px 5px rgba(255,255,255,0.7)' }}
        >
          <div className="w-3.5 h-3.5 bg-white/80 rounded-full blur-[1px]"></div>
        </div>
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
          0% { transform: translateY(-80px); }
          100% { transform: translateY(110vh); }
        }
        .conveyor-lines {
          background-image: repeating-linear-gradient(0deg, transparent, transparent 40px, #475569 40px, #475569 80px);
          animation: belt-move 1s linear infinite;
        }
        @keyframes belt-move {
          0% { transform: translateY(-80px); }
          100% { transform: translateY(0); }
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
