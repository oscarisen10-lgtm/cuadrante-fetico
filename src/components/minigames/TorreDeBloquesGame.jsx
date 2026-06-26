import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Play, Gamepad2, Trophy, RotateCcw, Award, X } from 'lucide-react';
import { GameBackground, ScoreBurst } from './gameFx';

// ───────── Constantes del mundo 3D ─────────
const BH = 0.5;          // altura de cada bloque
const BASE = 3;          // tamaño (ancho/fondo) del bloque base
const SPAWN_OFFSET = 4.6; // desde dónde entra el bloque deslizante
const RANGE = 4.6;        // límite de rebote
const PERFECT_TOL = 0.12; // tolerancia para "toque perfecto"
const CAM_BASE_Y = 4.2;

const damp = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));
const blockColor = (level) => `hsl(${(150 + level * 14) % 360}, 62%, 56%)`;
const speedFor = (level) => 2.4 + Math.min(4.2, level * 0.16);

// ───────── Vigía de FPS (apaga el bloom si el móvil va lento) ─────────
function PerfGuard({ onSlow }) {
  const f = useRef(0), e = useRef(0), low = useRef(0), warm = useRef(0), done = useRef(false);
  useFrame((_, dt) => {
    if (done.current) return;
    if (warm.current < 1.2) { warm.current += dt; return; }
    f.current++; e.current += dt;
    if (e.current >= 1) {
      const fps = f.current / e.current; f.current = 0; e.current = 0;
      if (fps < 45) low.current++; else low.current = 0;
      if (low.current >= 2) { done.current = true; onSlow(); }
    }
  });
  return null;
}

// ───────── Caja (bloque colocado) ─────────
function Block({ x, z, w, d, y, color }) {
  return (
    <mesh position={[x, y * BH + BH / 2, z]} scale={[w, BH, d]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} metalness={0.18} roughness={0.45} />
    </mesh>
  );
}

// ───────── Trozo recortado que cae ─────────
function Debris({ data, onDone }) {
  const ref = useRef();
  const v = useRef({ vy: 1.5, vr: (Math.random() - 0.5) * 4, t: 0 });
  useFrame((_, dt) => {
    const m = ref.current; if (!m) return;
    v.current.vy -= 14 * dt;          // gravedad
    m.position.y += v.current.vy * dt;
    m.position[data.axis === 'x' ? 'x' : 'z'] += data.fall * dt * 2.2;
    m.rotation.z += v.current.vr * dt * (data.axis === 'x' ? 1 : 0);
    m.rotation.x += v.current.vr * dt * (data.axis === 'z' ? 1 : 0);
    v.current.t += dt;
    if (v.current.t > 2.2) onDone(data.id);
  });
  return (
    <mesh ref={ref} position={[data.x, data.y * BH + BH / 2, data.z]} scale={[data.w, BH, data.d]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={data.color} metalness={0.18} roughness={0.45} />
    </mesh>
  );
}

// ───────── Cámara que asciende con la torre ─────────
function Rig({ climbRef }) {
  const { camera } = useThree();
  const started = useRef(false);
  useFrame((_, dt) => {
    if (!started.current) { camera.lookAt(0, 1, 0); started.current = true; }
    camera.position.y = damp(camera.position.y, CAM_BASE_Y + climbRef.current, 4, dt);
  });
  return null;
}

// ───────── Bloque activo (se desliza) + sacudida + flash perfecto ─────────
function ActiveAndFx({ activeRef, view, shakeRef, flashRef, rootRef }) {
  const mesh = useRef();
  const flash = useRef();
  useFrame((_, dt) => {
    const a = activeRef.current;
    const m = mesh.current;
    if (a && m) {
      // movimiento de vaivén en el eje activo
      const lim = RANGE;
      a.pos += a.dir * a.speed * dt;
      if (a.pos > lim) { a.pos = lim; a.dir = -1; }
      if (a.pos < -lim) { a.pos = -lim; a.dir = 1; }
      const x = a.axis === 'x' ? a.pos : a.baseX;
      const z = a.axis === 'z' ? a.pos : a.baseZ;
      m.visible = true;
      m.position.set(x, a.level * BH + BH / 2, z);
      m.scale.set(a.w, BH, a.d);
    } else if (m) {
      m.visible = false;
    }
    // sacudida del mundo
    const r = rootRef.current;
    if (r) {
      if (shakeRef.current > 0.001) {
        shakeRef.current = damp(shakeRef.current, 0, 7, dt);
        r.position.x = (Math.random() - 0.5) * shakeRef.current * 0.4;
        r.position.z = (Math.random() - 0.5) * shakeRef.current * 0.4;
      } else { r.position.x = 0; r.position.z = 0; }
    }
    // flash de toque perfecto
    const fl = flash.current;
    if (fl) {
      flashRef.current = damp(flashRef.current, 0, 6, dt);
      fl.material.opacity = flashRef.current * 0.5;
      const s = 1 + (1 - flashRef.current) * 4;
      fl.scale.set(s, s, s);
      fl.position.copy(mesh.current ? mesh.current.position : fl.position);
    }
  });
  return (
    <>
      <mesh ref={mesh}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={view.color} emissive={view.color} emissiveIntensity={0.35} metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh ref={flash} scale={[0.001, 0.001, 0.001]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#fff7cc" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

// ───────── Escena 3D ─────────
function StackScene({ placed, view, activeRef, climbRef, shakeRef, flashRef, debris, removeDebris, postFx, onSlow }) {
  const rootRef = useRef();
  return (
    <>
      <color attach="background" args={['#0b0518']} />
      <fog attach="fog" args={['#0b0518', 12, 26]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 12, 4]} intensity={1.4} />
      <pointLight position={[-6, 6, -2]} intensity={30} color="#a855f7" distance={30} />

      <Rig climbRef={climbRef} />
      <PerfGuard onSlow={onSlow} />

      <group ref={rootRef}>
        {placed.map((b) => <Block key={b.id} {...b} />)}
        {debris.map((d) => <Debris key={d.id} data={d} onDone={removeDebris} />)}
        <ActiveAndFx activeRef={activeRef} view={view} shakeRef={shakeRef} flashRef={flashRef} rootRef={rootRef} />
      </group>

      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.3} intensity={0.8} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

export function TorreDeBloquesGame({ onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt }) {
  const [gameState, setGameState] = useState('intro');
  const [gameMode, setGameMode] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [perfectCombos, setPerfectCombos] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [postFx, setPostFx] = useState(true);

  // Estado de render de la torre
  const [placed, setPlaced] = useState([]);
  const [view, setView] = useState({ color: blockColor(1) }); // geometría/color del bloque activo
  const [debris, setDebris] = useState([]);

  // Refs del bucle (no provocan re-render)
  const activeRef = useRef(null);
  const placedRef = useRef([]);
  const climbRef = useRef(0);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const scoreRef = useRef(0);
  const debrisId = useRef(0);
  const audioCtxRef = useRef(null);

  placedRef.current = placed;

  const playSound = (type) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === 'perfect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
      } else if (type === 'place') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(261.63 * Math.pow(1.059, Math.min(12, comboRef.current)), now);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      }
    } catch (e) { /* audio bloqueado */ }
  };

  useEffect(() => { scoreRef.current = score; }, [score]);

  // Countdown
  useEffect(() => {
    if (gameState === 'countdown') {
      if (countdown > 0) {
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
      }
      setGameState('playing');
      initGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, gameState]);

  const spawn = (level) => {
    const top = placedRef.current[placedRef.current.length - 1];
    const axis = level % 2 === 0 ? 'x' : 'z';
    activeRef.current = {
      axis, level, w: top.w, d: top.d, baseX: top.x, baseZ: top.z,
      pos: -SPAWN_OFFSET, dir: 1, speed: speedFor(level),
    };
    setView({ color: blockColor(level) });
    climbRef.current = level * BH; // la cámara sube hacia la nueva cima
  };

  const initGame = () => {
    const base = { id: 0, x: 0, z: 0, w: BASE, d: BASE, y: 0, color: blockColor(0) };
    placedRef.current = [base];
    setPlaced([base]);
    setDebris([]);
    comboRef.current = 0; maxComboRef.current = 0; scoreRef.current = 0;
    setScore(0); setCombo(0); setPerfectCombos(0); setMaxCombo(0);
    climbRef.current = 0; shakeRef.current = 0; flashRef.current = 0;
    spawn(1);
  };

  const addDebris = (x, z, w, d, y, color, axis, fall) => {
    const id = ++debrisId.current;
    setDebris(prev => [...prev, { id, x, z, w, d, y, color, axis, fall }]);
  };
  const removeDebris = (id) => setDebris(prev => prev.filter(d => d.id !== id));

  const drop = () => {
    if (gameState !== 'playing') return;
    const a = activeRef.current;
    if (!a) return;
    const top = placedRef.current[placedRef.current.length - 1];
    const level = a.level;

    const axis = a.axis;
    const aCenter = a.pos;                       // centro del activo en el eje
    const aSize = axis === 'x' ? a.w : a.d;
    const tCenter = axis === 'x' ? top.x : top.z;
    const tSize = axis === 'x' ? top.w : top.d;

    const aMin = aCenter - aSize / 2, aMax = aCenter + aSize / 2;
    const tMin = tCenter - tSize / 2, tMax = tCenter + tSize / 2;
    const oMin = Math.max(aMin, tMin), oMax = Math.min(aMax, tMax);
    const overlap = oMax - oMin;

    activeRef.current = null; // detiene el deslizamiento

    if (overlap <= 0) {
      // Game over: cae el bloque entero
      playSound('gameover');
      const gx = axis === 'x' ? aCenter : a.baseX;
      const gz = axis === 'z' ? aCenter : a.baseZ;
      addDebris(gx, gz, a.w, a.d, level, blockColor(level), axis, aCenter > tCenter ? 1 : -1);
      setTimeout(() => setGameState('finished'), 1100);
      return;
    }

    const perfect = Math.abs(aCenter - tCenter) <= PERFECT_TOL;
    const color = blockColor(level);
    let nx = top.x, nz = top.z, nw = top.w, nd = top.d;

    if (perfect) {
      comboRef.current += 1;
      if (comboRef.current > maxComboRef.current) { maxComboRef.current = comboRef.current; setMaxCombo(comboRef.current); }
      setPerfectCombos(c => c + 1);
      setScore(s => s + 200 + comboRef.current * 50);
      setCombo(comboRef.current);
      playSound('perfect');
      shakeRef.current = 1;
      flashRef.current = 1;
    } else {
      comboRef.current = 0; setCombo(0);
      setScore(s => s + 100);
      playSound('place');
      const newCenter = (oMin + oMax) / 2;
      if (axis === 'x') { nx = newCenter; nw = overlap; nz = top.z; nd = top.d; }
      else { nz = newCenter; nd = overlap; nx = top.x; nw = top.w; }
      // trozo sobrante -> debris
      const cutSize = aSize - overlap;
      const cutCenter = aCenter > tCenter ? oMax + cutSize / 2 : oMin - cutSize / 2;
      const dx = axis === 'x' ? cutCenter : a.baseX;
      const dz = axis === 'z' ? cutCenter : a.baseZ;
      addDebris(dx, dz, axis === 'x' ? cutSize : a.w, axis === 'z' ? cutSize : a.d, level, color, axis, aCenter > tCenter ? 1 : -1);
    }

    const nb = { id: level, x: nx, z: nz, w: nw, d: nd, y: level, color };
    placedRef.current = [...placedRef.current, nb];
    setPlaced(placedRef.current);
    spawn(level + 1);
  };

  const startGame = (mode) => {
    if (mode === 'jugar') { if (playAttempts <= 0) return; onConsumeAttempt('jugar'); }
    else { if (practiceAttempts <= 0) return; onConsumeAttempt('prueba'); }
    setGameMode(mode); setGameState('countdown'); setCountdown(3);
  };
  const handleFinish = () => onFinish(scoreRef.current, gameMode);

  // ───────── Pantalla de introducción ─────────
  if (gameState === 'intro') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0e071c] text-white flex flex-col p-6 overflow-y-auto font-sans">
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
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"><X size={16} /></button>
        </div>

        <div className="flex flex-col items-center pb-12 flex-1 justify-center">
          <div className="bg-gradient-to-br from-[#1b0838] to-[#0f0424] border border-fuchsia-500/30 p-8 rounded-3xl backdrop-blur-md text-center mb-8 max-w-sm w-full relative overflow-hidden shadow-2xl">
            <div className="absolute -right-16 -bottom-16 w-44 h-44 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none"></div>
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
                <span className="leading-relaxed">Lo que sobresalga <strong>se recorta y cae al vacío</strong>, dejando el bloque más pequeño para el próximo turno.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-lg shrink-0 font-bold text-[10px] uppercase">Perfecto</span>
                <span className="leading-relaxed">Alinéalo al milímetro para un <strong>Toque Perfecto</strong>: mantienes el tamaño completo y sumas combos.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <div className="flex gap-4">
              <button onClick={() => startGame('prueba')} disabled={practiceAttempts <= 0} className="flex-1 bg-white/5 border border-white/10 text-white font-black py-4 rounded-2xl disabled:opacity-20 active:scale-95 transition-transform flex flex-col items-center justify-center hover:bg-white/10">
                <span className="text-base uppercase tracking-wider">Prueba</span>
                <span className="text-[9px] text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full mt-1">{practiceAttempts} INTENTOS</span>
              </button>
              <button onClick={() => startGame('jugar')} disabled={playAttempts <= 0} className="flex-1 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-black py-4 rounded-2xl shadow-[0_0_25px_rgba(217,70,239,0.35)] disabled:opacity-20 active:scale-95 transition-transform flex flex-col items-center justify-center border-b-4 border-fuchsia-700">
                <span className="text-base uppercase tracking-wider flex items-center gap-1.5"><Play size={16} fill="currentColor" /> Jugar</span>
                <span className="text-[9px] text-fuchsia-100 font-bold hud-chip px-2 py-0.5 rounded-full mt-1">{playAttempts} INTENTOS</span>
              </button>
            </div>
            <button onClick={onCancel} className="w-full py-3.5 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-transform border border-fuchsia-500/25 flex items-center justify-center gap-2 bg-fuchsia-500/10 text-fuchsia-400 active:scale-95">VOLVER ATRÁS</button>
          </div>
        </div>
      </div>
    );
  }

  // ───────── Pantalla de juego / countdown / fin ─────────
  return (
    <div className="fixed inset-0 z-50 bg-[#090514] flex flex-col font-sans overflow-hidden select-none touch-none">
      <GameBackground theme="fuchsia" />

      <div className="pt-10 pb-4 px-6 flex items-center justify-between z-10 bg-gradient-to-b from-[#090514] to-transparent pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center"><Gamepad2 size={16} className="text-fuchsia-400" /></div>
          <div>
            <p className="text-[9px] text-fuchsia-400 font-black uppercase tracking-widest leading-none">Día 4</p>
            <p className="text-xs font-black text-white leading-tight uppercase">Torre de Bloques</p>
          </div>
        </div>
        {gameState === 'playing' && combo > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1 animate-bounce">🔥 COMBO x{combo}</div>
        )}
        <div className="flex flex-col items-end">
          <p className="text-[8px] text-indigo-400 font-black uppercase tracking-wider leading-none mb-1">SCORE</p>
          <p className="text-xl font-black text-white leading-none tabular-nums tracking-tighter">{score}</p>
        </div>
      </div>

      {gameState === 'countdown' && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center flex-col animate-in fade-in duration-200">
          <p className="text-fuchsia-400 font-black uppercase tracking-widest mb-3 text-xs">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-pink-300 animate-pulse">{countdown > 0 ? countdown : '¡YA!'}</div>
        </div>
      )}

      {/* Lienzo 3D */}
      <div className="flex-1 w-full relative z-10 cursor-pointer active:brightness-110 transition-all" onPointerDown={drop}>
        <ScoreBurst value={score} color="#e879f9" />
        <Canvas dpr={[1, 2]} camera={{ position: [4.4, CAM_BASE_Y, 4.4], fov: 42 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
          <Suspense fallback={null}>
            <StackScene
              placed={placed} view={view} activeRef={activeRef}
              climbRef={climbRef} shakeRef={shakeRef} flashRef={flashRef}
              debris={debris} removeDebris={removeDebris}
              postFx={postFx} onSlow={() => setPostFx(false)}
            />
          </Suspense>
        </Canvas>

        {gameState === 'playing' && placed.length === 1 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white/5 border border-white/10 px-6 py-2.5 rounded-full pointer-events-none backdrop-blur-md animate-pulse flex flex-col items-center">
            <span className="text-white text-xs font-black uppercase tracking-wider">TAP EN LA PANTALLA</span>
            <span className="text-indigo-300 text-[9px] font-bold mt-0.5">Para soltar el bloque</span>
          </div>
        )}
      </div>

      {gameState === 'finished' && (
        <div className="absolute inset-0 z-40 bg-[#090514]/95 backdrop-blur-md flex flex-col items-center justify-center px-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 rotate-12"><Trophy size={32} className="text-white fill-white" /></div>
          <h2 className="text-white text-3xl font-black uppercase tracking-tighter mb-1">PARTIDA COMPLETADA</h2>
          <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-8">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="bg-gradient-to-b from-[#1b0a2d] to-[#120521] border border-fuchsia-500/30 p-8 rounded-[2rem] text-center w-full max-w-sm shadow-2xl relative overflow-hidden mb-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-fuchsia-500/5 via-transparent to-transparent pointer-events-none"></div>
            <p className="text-fuchsia-400 font-bold uppercase tracking-widest text-[9px] mb-2">Puntuación Total</p>
            <p className="text-6xl font-black text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-indigo-200 leading-none">{score}</p>
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/5">
              <div>
                <p className="text-indigo-400/70 font-semibold text-[8px] uppercase tracking-wider mb-1">Altura de Torre</p>
                <p className="text-lg font-black text-white">{Math.max(0, placed.length - 1)} <span className="text-[10px] text-indigo-300 font-bold">Bloques</span></p>
              </div>
              <div>
                <p className="text-indigo-400/70 font-semibold text-[8px] uppercase tracking-wider mb-1">Toques Perfectos</p>
                <p className="text-lg font-black text-yellow-400">⚡ {perfectCombos}</p>
              </div>
            </div>
            {maxCombo > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black py-1.5 px-3 rounded-full uppercase mt-4 flex items-center justify-center gap-1">🔥 Racha de Combos Max: {maxCombo}</div>
            )}
          </div>
          <div className="w-full max-w-sm space-y-3">
            {gameMode === 'prueba' && (
              <button onClick={() => setGameState('intro')} className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform text-sm uppercase tracking-wider"><RotateCcw size={16} /> Volver a Intentar</button>
            )}
            <button onClick={handleFinish} className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-black py-4.5 rounded-2xl text-base shadow-[0_0_35px_rgba(217,70,239,0.3)] active:scale-95 transition-transform border-b-4 border-fuchsia-700 uppercase tracking-wide">Continuar</button>
          </div>
        </div>
      )}
    </div>
  );
}
