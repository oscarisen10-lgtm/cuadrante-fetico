import React, { useState, useEffect, useRef } from 'react';
import { Play, Gamepad2, Info, Timer } from 'lucide-react';
import { GameBackground } from './gameFx';

export function FrenoEnSecoGame({ onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt }) {
  const [gameState, setGameState] = useState('intro'); // 'intro', 'countdown', 'playing', 'finished'
  const [gameMode, setGameMode] = useState(null); // 'prueba' or 'jugar'
  const [countdown, setCountdown] = useState(3);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [score, setScore] = useState(0);
  
  const startTimeRef = useRef(null);
  const reqRef = useRef();

  // Countdown logic
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('playing');
        startTimeRef.current = Date.now();
      }
    }
  }, [countdown, gameState]);

  // Stopwatch logic
  useEffect(() => {
    if (gameState === 'playing') {
      const updateTimer = () => {
        const now = Date.now();
        setElapsedTime(now - startTimeRef.current);
        reqRef.current = requestAnimationFrame(updateTimer);
      };
      reqRef.current = requestAnimationFrame(updateTimer);
      return () => cancelAnimationFrame(reqRef.current);
    }
  }, [gameState]);

  const handleStop = () => {
    if (gameState !== 'playing') return;
    
    const finalElapsed = Date.now() - startTimeRef.current;
    cancelAnimationFrame(reqRef.current);
    setElapsedTime(finalElapsed);
    
    // Calculate Score
    const targetMs = 10000; // 10 seconds
    const diff = Math.abs(targetMs - finalElapsed);
    
    // Max score 1000. Lose 1 point per 2 milliseconds off
    let finalScore = Math.max(0, 1000 - Math.floor(diff / 2));
    setScore(finalScore);
    
    setGameState('finished');
  };

  const startGame = (mode) => {
    if (mode === 'jugar') {
      if (playAttempts <= 0) return;
      onConsumeAttempt('jugar');
    } else {
      if (practiceAttempts <= 0) return;
      onConsumeAttempt('prueba');
    }
    setGameMode(mode);
    setGameState('countdown');
  };

  const handleFinish = () => {
    onFinish(score, gameMode);
  };

  // Format time helper
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
  };

  const isHidden = elapsedTime > 3000 && gameState === 'playing';

  if (gameState === 'intro') {
    return (
      <div className="fixed inset-0 z-50 bg-[#160407] text-white flex flex-col p-6 overflow-y-auto font-sans">
        <GameBackground theme="red" />
        <div className="relative z-10 flex items-center justify-between bg-black/25 backdrop-blur-md p-4 rounded-2xl mb-6 border border-white/10">
          <div className="flex items-center gap-2 text-white">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
              <Timer size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Día 3</p>
              <p className="text-sm font-black leading-none">Freno en Seco</p>
            </div>
          </div>
          <div className="w-10 h-10"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center pb-12">
          <div className="bg-black/40 border border-red-500/30 p-6 rounded-3xl backdrop-blur-md text-center mb-8 max-w-sm w-full relative">
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none">
              <Timer size={200} className="text-red-500" />
            </div>
            <h2 className="text-white text-2xl font-black mb-4 z-10 relative">Freno en Seco</h2>
            <div className="text-red-100 text-sm space-y-4 text-left z-10 relative">
              <p className="flex items-start gap-3">
                <span className="bg-red-500/20 text-red-400 p-1.5 rounded-lg shrink-0 mt-0.5"><Info size={16} /></span>
                <span>Un cronómetro empezará a contar y <strong>se ocultará a los 3 segundos</strong>.</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="bg-red-500/20 text-red-400 p-1.5 rounded-lg shrink-0 mt-0.5"><Timer size={16} /></span>
                <span>Tu objetivo es detenerlo <strong>exactamente en 10:00 segundos</strong>.</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="bg-red-500/20 text-red-400 p-1.5 rounded-lg shrink-0 mt-0.5"><Gamepad2 size={16} /></span>
                <span>¡Cuanto más te acerques, más puntos ganarás!</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <div className="flex gap-4">
              <button 
                onClick={() => startGame('prueba')}
                disabled={practiceAttempts <= 0}
                className="flex-1 bg-white/10 text-white font-bold py-4 rounded-2xl disabled:opacity-30 disabled:scale-100 active:scale-95 transition-all flex flex-col items-center justify-center"
              >
                <span className="text-lg mb-1">Prueba</span>
                <span className="text-[10px] text-white/50 bg-black/30 px-2 py-0.5 rounded-full">{practiceAttempts} INTENTOS</span>
              </button>
              <button 
                onClick={() => startGame('jugar')}
                disabled={playAttempts <= 0}
                className="flex-1 bg-gradient-to-b from-red-400 to-red-600 text-white font-bold py-4 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] disabled:opacity-30 disabled:scale-100 active:scale-95 transition-all flex flex-col items-center justify-center"
              >
                <span className="text-lg mb-1 flex items-center gap-1"><Play size={18} fill="currentColor" /> Jugar</span>
                <span className="text-[10px] text-red-100 bg-black/20 px-2 py-0.5 rounded-full">{playAttempts} INTENTOS</span>
              </button>
            </div>
            <button 
              onClick={onCancel}
              className="w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border border-red-500/30 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95"
            >
              VOLVER ATRÁS
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#160407] flex flex-col font-sans overflow-hidden">
      <GameBackground theme="red" />
      {/* Header */}
      <div className="relative pt-12 pb-4 px-6 flex items-center justify-between z-10 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <Timer size={16} className="text-red-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Día 3</p>
            <p className="text-sm font-black leading-none">Freno en Seco</p>
          </div>
        </div>
        <div className="w-10 h-10"></div> {/* Empty space to keep flex-between balanced */}
      </div>

      {gameState === 'playing' && (
        <div className="flex-1 flex flex-col items-center justify-around relative z-10 px-6 py-12">
          <div className="text-center">
            <p className="text-red-400 font-bold uppercase tracking-widest mb-2 text-sm">Objetivo</p>
            <p className="text-white text-3xl font-black">10:00 Segundos</p>
          </div>

          <div className={`text-[6rem] font-black tabular-nums transition-all duration-300 ${isHidden ? 'text-white/10 blur-sm scale-90' : 'text-white scale-100 drop-shadow-[0_0_25px_rgba(239,68,68,0.9)]'}`}>
            {isHidden ? '??:??' : formatTime(elapsedTime)}
          </div>

          <div className="w-full flex justify-center pb-8">
            <button
              onClick={handleStop}
              className="relative w-52 h-52 rounded-full flex items-center justify-center active:scale-90 transition-transform z-20 border-4 border-red-300/40"
              style={{ background: 'radial-gradient(circle at 38% 30%, #fb7185, #ef4444 55%, #b91c1c)', boxShadow: '0 0 60px rgba(239,68,68,0.7), inset 0 4px 12px rgba(255,255,255,0.45), inset 0 -8px 18px rgba(0,0,0,0.35)' }}
            >
              <span className="absolute inset-3 rounded-full border-2 border-white/20" />
              <span className="absolute top-7 left-12 w-12 h-5 bg-white/40 rounded-full blur-[2px]" />
              <span className="text-white text-3xl font-black uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">Frenar</span>
            </button>
          </div>
        </div>
      )}

      {gameState === 'countdown' && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col">
          <p className="text-red-400 font-bold uppercase tracking-widest mb-4 text-center px-8">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="text-9xl font-black text-white animate-bounce drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
            {countdown}
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center px-6">
          <div className="text-center mb-12">
            <p className="text-white/60 font-bold uppercase tracking-widest mb-2">Has parado en</p>
            <p className="text-[5rem] font-black text-white tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] leading-none mb-4">
              {formatTime(elapsedTime)}
            </p>
            <p className={`text-xl font-bold ${Math.abs(10000 - elapsedTime) < 500 ? 'text-green-400' : 'text-red-400'}`}>
              Diferencia: {(Math.abs(10000 - elapsedTime) / 1000).toFixed(3)}s
            </p>
          </div>
          
          <div className="bg-[#1e1b4b] border border-red-500/30 p-8 rounded-[2rem] text-center w-full max-w-sm mb-8 shadow-2xl">
            <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-2">Puntuación obtenida</p>
            <p className="text-6xl font-black text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              {score}
            </p>
            <p className="text-red-400 text-sm mt-2 font-bold">PUNTOS</p>
          </div>

          <button 
            onClick={handleFinish}
            className="w-full max-w-sm bg-gradient-to-r from-red-500 to-orange-500 text-white font-black py-5 rounded-[1.5rem] text-lg shadow-[0_0_30px_rgba(239,68,68,0.3)] active:scale-95 transition-transform"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
