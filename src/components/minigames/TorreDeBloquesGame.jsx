import React, { useState, useEffect, useRef } from 'react';
import { Play, Gamepad2, Info, Trophy, RotateCcw, Award, X } from 'lucide-react';
import { GameBackground } from './gameFx';

export function TorreDeBloquesGame({ onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt }) {
  const [gameState, setGameState] = useState('intro'); // 'intro', 'countdown', 'playing', 'finished'
  const [gameMode, setGameMode] = useState(null); // 'prueba' or 'jugar'
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [perfectCombos, setPerfectCombos] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  
  // Game state references for loop
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const blocksRef = useRef([]);
  const activeBlockRef = useRef(null);
  const debrisRef = useRef([]);
  const particlesRef = useRef([]);
  const cameraYRef = useRef(0);
  const targetCameraYRef = useRef(0);
  const shakeTimeRef = useRef(0);
  
  // Web Audio Context for synthesizer sounds
  const audioCtxRef = useRef(null);

  // Play sound helper
  const playSound = (type) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'perfect') {
        // High-pitched crystal spark sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'place') {
        // Simple clean stack sound
        osc.type = 'sine';
        const pitch = 261.63 * Math.pow(1.059, Math.min(12, comboRef.current)); // Melodic ramp up with combo
        osc.frequency.setValueAtTime(pitch, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'gameover') {
        // Descending doom sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn("Audio not supported or blocked", e);
    }
  };

  // Sync React states with refs
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Countdown logic
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('playing');
        initGame();
      }
    }
  }, [countdown, gameState]);

  // Dimensions of logical game area
  const GAME_WIDTH = 400;
  const GAME_HEIGHT = 550;
  const BLOCK_HEIGHT = 28;

  // Initialize all game parameters
  const initGame = () => {
    // Starting base block
    blocksRef.current = [
      {
        x: 100,
        y: GAME_HEIGHT - 80,
        width: 200,
        hue: 240 // Deep blue/purple starting hue
      }
    ];

    comboRef.current = 0;
    maxComboRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    setPerfectCombos(0);
    setMaxCombo(0);

    debrisRef.current = [];
    particlesRef.current = [];
    cameraYRef.current = 0;
    targetCameraYRef.current = 0;
    shakeTimeRef.current = 0;

    spawnNextBlock();
  };

  // Spawn active sliding block
  const spawnNextBlock = () => {
    const stackSize = blocksRef.current.length;
    const topBlock = blocksRef.current[stackSize - 1];
    
    // Smoothly color gradient using HSL loop
    const hue = (topBlock.hue + 12) % 360;

    // Sliding block parameters
    const initialWidth = topBlock.width;
    const yPos = topBlock.y - BLOCK_HEIGHT;
    
    // Alternating side start
    const startFromLeft = stackSize % 2 === 0;
    const xPos = startFromLeft ? -initialWidth + 10 : GAME_WIDTH - 10;
    
    // Increase speed slowly as the tower grows
    const speed = (2.2 + Math.min(4.8, stackSize * 0.15)) * (startFromLeft ? 1 : -1);

    activeBlockRef.current = {
      x: xPos,
      y: yPos,
      width: initialWidth,
      speed: speed,
      hue: hue
    };

    // Calculate camera target. Keep the top of the tower in the middle third of screen
    const visibleTowerHeight = stackSize * BLOCK_HEIGHT;
    if (visibleTowerHeight > 220) {
      targetCameraYRef.current = visibleTowerHeight - 220;
    }
  };

  // Tap or Click handler: Drops current block
  const handleDrop = () => {
    if (gameState !== 'playing' || !activeBlockRef.current) return;

    const active = activeBlockRef.current;
    const topPlaced = blocksRef.current[blocksRef.current.length - 1];

    // Left and Right bounds
    const activeLeft = active.x;
    const activeRight = active.x + active.width;
    const topLeft = topPlaced.x;
    const topRight = topPlaced.x + topPlaced.width;

    // Overlap bounds
    const overlapLeft = Math.max(activeLeft, topLeft);
    const overlapRight = Math.min(activeRight, topRight);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Game Over: Missed the base block entirely!
      playSound('gameover');
      
      // All of the active block falls down
      debrisRef.current.push({
        x: active.x,
        y: active.y,
        width: active.width,
        hue: active.hue,
        vx: active.speed * 0.3,
        vy: -2,
        rotation: 0,
        vRot: (Math.random() - 0.5) * 0.1
      });

      activeBlockRef.current = null;
      setTimeout(() => {
        setGameState('finished');
      }, 1000);
      return;
    }

    // Check for "Perfect Match" (alignment tolerance within 4.5 pixels)
    const offset = Math.abs(active.x - topPlaced.x);
    const isPerfect = offset <= 4.5;

    let finalX, finalWidth;

    if (isPerfect) {
      // Perfect Snap! Keep full width and align perfectly
      finalX = topPlaced.x;
      finalWidth = topPlaced.width;
      comboRef.current += 1;
      
      // Update maximum combo
      if (comboRef.current > maxComboRef.current) {
        maxComboRef.current = comboRef.current;
        setMaxCombo(comboRef.current);
      }

      setPerfectCombos(c => c + 1);
      
      // Bonus points for Perfect Match! 200 pts + combo multiplier
      const perfectBonus = 200 + (comboRef.current * 50);
      setScore(s => s + perfectBonus);
      playSound('perfect');

      // Screenshake trigger
      shakeTimeRef.current = 15;

      // Sparkling particles along both edges of the block
      createPerfectParticles(finalX, active.y, finalWidth, active.hue);
    } else {
      // Normal placement: Trim overlap, slice debris
      finalX = overlapLeft;
      finalWidth = overlapWidth;
      comboRef.current = 0; // Reset perfect combo

      // Standard points: 100 pts
      setScore(s => s + 100);
      playSound('place');

      // Create falling debris for sliced portion
      let debrisX, debrisWidth;
      let direction = 1;

      if (activeLeft < topPlaced.x) {
        // Sliced left side
        debrisX = activeLeft;
        debrisWidth = topPlaced.x - activeLeft;
        direction = -1;
      } else {
        // Sliced right side
        debrisX = overlapRight;
        debrisWidth = activeRight - overlapRight;
        direction = 1;
      }

      debrisRef.current.push({
        x: debrisX,
        y: active.y,
        width: debrisWidth,
        hue: active.hue,
        vx: direction * (1 + Math.random() * 2),
        vy: -1.5,
        rotation: 0,
        vRot: direction * (0.04 + Math.random() * 0.08)
      });
    }

    // Add block to stack
    blocksRef.current.push({
      x: finalX,
      y: active.y,
      width: finalWidth,
      hue: active.hue
    });

    spawnNextBlock();
  };

  // Particles generator for Perfect Snap
  const createPerfectParticles = (x, y, width, hue) => {
    const colors = [
      `hsl(${hue}, 100%, 75%)`,
      `hsl(${(hue + 40) % 360}, 100%, 80%)`,
      '#ffffff',
      '#ffe066'
    ];

    // Left spark cluster
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x: x,
        y: y + BLOCK_HEIGHT / 2,
        vx: -2 - Math.random() * 4,
        vy: (Math.random() - 0.5) * 6,
        size: 2.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.02 + Math.random() * 0.03
      });
    }

    // Right spark cluster
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x: x + width,
        y: y + BLOCK_HEIGHT / 2,
        vx: 2 + Math.random() * 4,
        vy: (Math.random() - 0.5) * 6,
        size: 2.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.02 + Math.random() * 0.03
      });
    }
  };

  // Animation and physics render loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Animation cycle
    const tick = () => {
      // Clear Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Handle screen space scaling responsive adaptivity
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.save();
      ctx.scale(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);

      // Camera Y interpolation for fluid vertical slide
      cameraYRef.current += (targetCameraYRef.current - cameraYRef.current) * 0.085;

      // Handle Screen Shake
      if (shakeTimeRef.current > 0) {
        const shakeVal = Math.sin(shakeTimeRef.current * 1.5) * 3;
        ctx.translate(shakeVal, Math.cos(shakeTimeRef.current * 1.5) * 2);
        shakeTimeRef.current--;
      }

      // Draw Glowing Gradient Background (Slate to Deep Neon Violet)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      bgGrad.addColorStop(0, 'rgba(9,5,20,0.72)');
      bgGrad.addColorStop(0.5, 'rgba(19,8,42,0.6)');
      bgGrad.addColorStop(1, 'rgba(34,8,59,0.5)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw visual background guide lines that shift downwards
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.04)';
      ctx.lineWidth = 1;
      const bgLineOffset = (cameraYRef.current * 0.45) % 40;
      for (let y = bgLineOffset; y < GAME_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_WIDTH, y);
        ctx.stroke();
      }

      // Draw background vertical lines
      for (let x = 40; x < GAME_WIDTH; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_HEIGHT);
        ctx.stroke();
      }

      // Push context for tower camera offset
      ctx.save();
      ctx.translate(0, cameraYRef.current);

      // --- 1. Draw Placed Blocks Tower ---
      const tower = blocksRef.current;
      tower.forEach((b, index) => {
        // Make older blocks fade out slightly to focus on top area
        const distanceToTop = tower.length - 1 - index;
        const opacity = Math.max(0.2, 1 - distanceToTop * 0.06);
        
        ctx.fillStyle = `hsla(${b.hue}, 85%, 55%, ${opacity})`;
        ctx.strokeStyle = `hsla(${b.hue}, 100%, 75%, ${opacity * 0.7})`;
        ctx.lineWidth = 2.5;

        // Draw 3D-like block bevel / isometric look
        // Front face
        ctx.fillRect(b.x, b.y, b.width, BLOCK_HEIGHT);
        ctx.strokeRect(b.x, b.y, b.width, BLOCK_HEIGHT);

        // Highlight top lip
        ctx.fillStyle = `hsla(${b.hue}, 95%, 72%, ${opacity})`;
        ctx.fillRect(b.x + 2, b.y + 2, b.width - 4, 3);
      });

      // --- 2. Update and Draw Sliding Active Block ---
      const active = activeBlockRef.current;
      if (active) {
        // Slid update
        active.x += active.speed;

        // Bounce active block off wall boundaries
        if (active.x < -active.width + 12 && active.speed < 0) {
          active.speed *= -1;
        } else if (active.x > GAME_WIDTH - 12 && active.speed > 0) {
          active.speed *= -1;
        }

        // Draw Active Block
        ctx.fillStyle = `hsl(${active.hue}, 95%, 55%)`;
        ctx.strokeStyle = `hsl(${active.hue}, 100%, 75%)`;
        ctx.lineWidth = 3;

        // Glowing shadow effect for active block
        ctx.shadowColor = `hsl(${active.hue}, 100%, 65%)`;
        ctx.shadowBlur = 12;
        ctx.fillRect(active.x, active.y, active.width, BLOCK_HEIGHT);
        ctx.strokeRect(active.x, active.y, active.width, BLOCK_HEIGHT);

        // Remove shadow settings
        ctx.shadowBlur = 0;

        // Top highlight
        ctx.fillStyle = `hsl(${active.hue}, 100%, 80%)`;
        ctx.fillRect(active.x + 2, active.y + 2, active.width - 4, 3);
      }

      // --- 3. Update and Draw Sliced Debris (Physics) ---
      const debris = debrisRef.current;
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        
        // Physics update
        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.32; // Gravity pull down
        d.rotation += d.vRot;

        // Fade out as it drops far below
        const opacity = Math.max(0, 1 - (d.y - (GAME_HEIGHT - 100 + cameraYRef.current)) * 0.0035);

        if (opacity <= 0 || d.y > GAME_HEIGHT + 300) {
          debris.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(d.x + d.width / 2, d.y + BLOCK_HEIGHT / 2);
        ctx.rotate(d.rotation);

        ctx.fillStyle = `hsla(${d.hue}, 85%, 50%, ${opacity})`;
        ctx.strokeStyle = `hsla(${d.hue}, 100%, 70%, ${opacity * 0.8})`;
        ctx.lineWidth = 2;
        ctx.fillRect(-d.width / 2, -BLOCK_HEIGHT / 2, d.width, BLOCK_HEIGHT);
        ctx.strokeRect(-d.width / 2, -BLOCK_HEIGHT / 2, d.width, BLOCK_HEIGHT);

        ctx.restore();
      }

      // --- 4. Update and Draw Particles (Spark system) ---
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // Slight gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          parts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        
        // Star sparkle design
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore(); // Restore tower zoom layout
      ctx.restore(); // Restore global adaptivity scale

      // Call next animation tick
      requestRef.current = requestAnimationFrame(tick);
    };

    // Run animation
    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState]);

  // Start game trig
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
    setCountdown(3);
  };

  const handleFinish = () => {
    onFinish(scoreRef.current, gameMode);
  };

  // Render Screens
  if (gameState === 'intro') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0e071c] text-white flex flex-col p-6 overflow-y-auto font-sans">
        {/* Header decoration */}
        <div className="flex items-center justify-between bg-white/5 p-4 rounded-3xl mb-6 border border-white/10">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 animate-pulse">
              <Award size={16} className="text-fuchsia-400" />
            </div>
            <div>
              <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wider">Día 4</p>
              <p className="text-sm font-black leading-none uppercase">Torre de Bloques</p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <X size={16} />
          </button>
        </div>

        {/* Intro Body */}
        <div className="flex flex-col items-center pb-12 flex-1 justify-center">
          <div className="bg-gradient-to-br from-[#1b0838] to-[#0f0424] border border-fuchsia-500/30 p-8 rounded-3xl backdrop-blur-md text-center mb-8 max-w-sm w-full relative overflow-hidden shadow-2xl">
            <div className="absolute -right-16 -bottom-16 w-44 h-44 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none"></div>
            
            {/* Visual Icon stacking representation */}
            <div className="flex flex-col items-center gap-1.5 mb-6">
              <div className="w-20 h-6 bg-pink-500 rounded-md border-b-4 border-pink-700 shadow-md"></div>
              <div className="w-16 h-6 bg-purple-500 rounded-md border-b-4 border-purple-700 shadow-md translate-x-1 border-r border-l border-white/20"></div>
              <div className="w-16 h-6 bg-violet-500 rounded-md border-b-4 border-violet-700 shadow-md -translate-x-1.5"></div>
              <div className="w-12 h-6 bg-indigo-500 rounded-md border-b-4 border-indigo-700 shadow-md animate-bounce"></div>
            </div>

            <h2 className="text-white text-3xl font-black mb-3 leading-none uppercase tracking-tighter">Torre de Bloques</h2>
            <p className="text-fuchsia-300 text-xs font-semibold mb-6 tracking-wide uppercase">Apila y recorta con precisión</p>

            <div className="text-indigo-100 text-xs space-y-4 text-left border-t border-white/10 pt-4">
              <div className="flex items-start gap-3">
                <span className="bg-fuchsia-500/20 text-fuchsia-300 px-2 py-1 rounded-lg shrink-0 font-bold text-[10px] uppercase">Apilar</span>
                <span className="leading-relaxed">Los bloques se deslizan de lado a lado. <strong>Toca la pantalla</strong> para soltarlos justo encima de la torre.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-fuchsia-500/20 text-fuchsia-300 px-2 py-1 rounded-lg shrink-0 font-bold text-[10px] uppercase">Recorte</span>
                <span className="leading-relaxed">Lo que sobresalga del bloque inferior <strong>será recortado y caerá al vacío</strong>, reduciendo el tamaño del bloque para el próximo turno.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-lg shrink-0 font-bold text-[10px] uppercase">Perfecto</span>
                <span className="leading-relaxed">Consigue una alineación de precisión (±4px) para desatar un <strong>Toque Perfecto</strong>: mantienes el tamaño completo y ganas combos multiplicadores.</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <div className="flex gap-4">
              <button 
                onClick={() => startGame('prueba')}
                disabled={practiceAttempts <= 0}
                className="flex-1 bg-white/5 border border-white/10 text-white font-black py-4 rounded-2xl disabled:opacity-20 active:scale-95 transition-transform flex flex-col items-center justify-center hover:bg-white/10"
              >
                <span className="text-base uppercase tracking-wider">Prueba</span>
                <span className="text-[9px] text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full mt-1">{practiceAttempts} INTENTOS</span>
              </button>
              <button 
                onClick={() => startGame('jugar')}
                disabled={playAttempts <= 0}
                className="flex-1 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-black py-4 rounded-2xl shadow-[0_0_25px_rgba(217,70,239,0.35)] disabled:opacity-20 active:scale-95 transition-transform flex flex-col items-center justify-center border-b-4 border-fuchsia-700"
              >
                <span className="text-base uppercase tracking-wider flex items-center gap-1.5"><Play size={16} fill="currentColor" /> Jugar</span>
                <span className="text-[9px] text-fuchsia-100 font-bold bg-black/25 px-2 py-0.5 rounded-full mt-1">{playAttempts} INTENTOS</span>
              </button>
            </div>
            <button 
              onClick={onCancel}
              className="w-full py-3.5 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-transform border border-fuchsia-500/25 flex items-center justify-center gap-2 bg-fuchsia-500/10 text-fuchsia-400 active:scale-95"
            >
              VOLVER ATRÁS
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing / Countdown screen
  return (
    <div className="fixed inset-0 z-50 bg-[#090514] flex flex-col font-sans overflow-hidden select-none touch-none">
      <GameBackground theme="fuchsia" />
      {/* HUD Header */}
      <div className="pt-10 pb-4 px-6 flex items-center justify-between z-10 bg-gradient-to-b from-[#090514] to-transparent pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
            <Gamepad2 size={16} className="text-fuchsia-400" />
          </div>
          <div>
            <p className="text-[9px] text-fuchsia-400 font-black uppercase tracking-widest leading-none">Día 4</p>
            <p className="text-xs font-black text-white leading-tight uppercase">Torre de Bloques</p>
          </div>
        </div>

        {/* Combo Counter HUD */}
        {gameState === 'playing' && comboRef.current > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1 animate-bounce">
            🔥 COMBO x{comboRef.current}
          </div>
        )}

        {/* Score HUD */}
        <div className="flex flex-col items-end">
          <p className="text-[8px] text-indigo-400 font-black uppercase tracking-wider leading-none mb-1">SCORE</p>
          <p className="text-xl font-black text-white leading-none tabular-nums tracking-tighter">{score}</p>
        </div>
      </div>

      {/* Countdown modal overlay */}
      {gameState === 'countdown' && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center flex-col animate-in fade-in duration-200">
          <p className="text-fuchsia-400 font-black uppercase tracking-widest mb-3 text-xs">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-pink-300 animate-pulse">
            {countdown > 0 ? countdown : '¡YA!'}
          </div>
        </div>
      )}

      {/* Main Canvas view area */}
      <div
        className="flex-1 w-full relative z-10 cursor-pointer active:brightness-110 transition-all"
        onClick={handleDrop}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />
        
        {/* Floating tap visual instruction */}
        {gameState === 'playing' && blocksRef.current.length === 1 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white/5 border border-white/10 px-6 py-2.5 rounded-full pointer-events-none backdrop-blur-md animate-pulse flex flex-col items-center">
            <span className="text-white text-xs font-black uppercase tracking-wider">TAP EN LA PANTALLA</span>
            <span className="text-indigo-300 text-[9px] font-bold mt-0.5">Para soltar el bloque</span>
          </div>
        )}
      </div>

      {/* Game Finished Summary overlay */}
      {gameState === 'finished' && (
        <div className="absolute inset-0 z-40 bg-[#090514]/95 backdrop-blur-md flex flex-col items-center justify-center px-6 animate-in fade-in duration-300">
          
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 rotate-12">
            <Trophy size={32} className="text-white fill-white" />
          </div>

          <h2 className="text-white text-3xl font-black uppercase tracking-tighter mb-1">PARTIDA COMPLETADA</h2>
          <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-8">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          
          {/* Main Score box */}
          <div className="bg-gradient-to-b from-[#1b0a2d] to-[#120521] border border-fuchsia-500/30 p-8 rounded-[2rem] text-center w-full max-w-sm shadow-2xl relative overflow-hidden mb-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-fuchsia-500/5 via-transparent to-transparent pointer-events-none"></div>
            
            <p className="text-fuchsia-400 font-bold uppercase tracking-widest text-[9px] mb-2">Puntuación Total</p>
            <p className="text-6xl font-black text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-indigo-200 leading-none">
              {score}
            </p>
            
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/5">
              <div>
                <p className="text-indigo-400/70 font-semibold text-[8px] uppercase tracking-wider mb-1">Altura de Torre</p>
                <p className="text-lg font-black text-white">{blocksRef.current.length - 1} <span className="text-[10px] text-indigo-300 font-bold">Bloques</span></p>
              </div>
              <div>
                <p className="text-indigo-400/70 font-semibold text-[8px] uppercase tracking-wider mb-1">Toques Perfectos</p>
                <p className="text-lg font-black text-yellow-400">⚡ {perfectCombos}</p>
              </div>
            </div>
            
            {maxCombo > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black py-1.5 px-3 rounded-full uppercase mt-4 flex items-center justify-center gap-1">
                🔥 Racha de Combos Max: {maxCombo}
              </div>
            )}
          </div>

          <div className="w-full max-w-sm space-y-3">
            {gameMode === 'prueba' && (
              <button 
                onClick={() => setGameState('intro')}
                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform text-sm uppercase tracking-wider"
              >
                <RotateCcw size={16} /> Volver a Intentar
              </button>
            )}
            
            <button 
              onClick={handleFinish}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-black py-4.5 rounded-2xl text-base shadow-[0_0_35px_rgba(217,70,239,0.3)] active:scale-95 transition-transform border-b-4 border-fuchsia-700 uppercase tracking-wide"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
