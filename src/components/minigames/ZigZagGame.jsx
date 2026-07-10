import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { X, Clock, Trophy, AlertTriangle, Play, Gamepad2, Info } from 'lucide-react';

const EMOJIS = ['🍎', '🥦', '🍗', '🥛', '📦', '🛒', '🛍️', '🍅', '🧴', '🥚'];
const VW = 4.8, VH = 7.6;     // área de juego en el mundo 3D
const BALL_Y = 82;            // altura lógica de la bola (0 arriba, 100 abajo)
const toWX = (x) => (x / 100 - 0.5) * VW;
const toWY = (y) => (0.5 - y / 100) * VH;
const damp = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));

function makeEmojiTex(emoji) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  // disco blanco de "bandeja"
  ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
  ctx.font = '74px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function makeBeltTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#1e293b'); g.addColorStop(0.5, '#64748b'); g.addColorStop(1, '#1e293b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 64, 10);
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1, 4); return t;
}

function PerfGuard({ onSlow }) {
  const f = useRef(0), e = useRef(0), low = useRef(0), warm = useRef(0), done = useRef(false);
  useFrame((_, dt) => {
    if (done.current) return;
    if (warm.current < 1.2) { warm.current += dt; return; }
    f.current++; e.current += dt;
    if (e.current >= 1) { const fps = f.current / e.current; f.current = 0; e.current = 0; if (fps < 45) low.current++; else low.current = 0; if (low.current >= 2) { done.current = true; onSlow(); } }
  });
  return null;
}

function Belt({ progressRef }) {
  const tex = useMemo(() => makeBeltTex(), []);
  useFrame((_, dt) => { tex.offset.y -= dt * (0.6 + progressRef.current * 1.4); });
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <>
      <mesh position={[0, 0, -0.3]}>
        <planeGeometry args={[VW, VH + 2]} />
        <meshStandardMaterial map={tex} metalness={0.5} roughness={0.5} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (VW / 2 - 0.06), 0, -0.1]}>
          <boxGeometry args={[0.12, VH + 2, 0.18]} />
          <meshStandardMaterial color="#0891b2" emissive="#22d3ee" emissiveIntensity={1.1} />
        </mesh>
      ))}
    </>
  );
}

function Ball({ playerXRef, hitRef }) {
  const ref = useRef();
  const mat = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.position.x = damp(ref.current.position.x, toWX(playerXRef.current), 18, dt);
    if (mat.current) mat.current.emissiveIntensity = damp(mat.current.emissiveIntensity, hitRef.current ? 0.2 : 1.2, 8, dt);
  });
  return (
    <mesh ref={ref} position={[0, toWY(BALL_Y), 0.25]}>
      <sphereGeometry args={[0.42, 32, 32]} />
      <meshStandardMaterial ref={mat} color="#10b981" emissive="#34d399" emissiveIntensity={1.2} metalness={0.2} roughness={0.25} />
    </mesh>
  );
}

function Item({ data, itemsRef, tex }) {
  const ref = useRef();
  useFrame(() => {
    const it = itemsRef.current.find(i => i.id === data.id);
    const m = ref.current; if (!m || !it) return;
    m.position.set(toWX(it.x), toWY(it.y), 0.1);
    m.rotation.z = it.rot;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[0.9, 0.9]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.1} />
    </mesh>
  );
}

function Scene({ playerXRef, hitRef, progressRef, itemsRef, items, texMap, postFx, onSlow }) {
  return (
    <>
      <color attach="background" args={['#060a14']} />
      <fog attach="fog" args={['#060a14', 10, 20]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 6]} intensity={1.1} />
      <pointLight position={[0, 0, 5]} intensity={14} color="#22d3ee" distance={18} />
      <PerfGuard onSlow={onSlow} />
      <Belt progressRef={progressRef} />
      <Ball playerXRef={playerXRef} hitRef={hitRef} />
      {items.map(it => <Item key={it.id} data={it} itemsRef={itemsRef} tex={texMap[it.emoji]} />)}
      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.3} intensity={0.8} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

export function ZigZagGame({ onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt }) {
  const [gameState, setGameState] = useState('intro');
  const [gameMode, setGameMode] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [items, setItems] = useState([]);
  const [postFx, setPostFx] = useState(true);

  const scoreRef = useRef(0);
  const timeLeftRef = useRef(60);
  const playerXRef = useRef(50);
  const dirRef = useRef(1);
  const itemsRef = useRef([]);
  const idRef = useRef(0);
  const idsRef = useRef('');
  const hitRef = useRef(false);
  const progressRef = useRef(0);
  const aliveRef = useRef(false);
  const stRef = useRef({ t: 0, nextSpawn: 0 });

  const texMap = useMemo(() => { const m = {}; EMOJIS.forEach(e => { m[e] = makeEmojiTex(e); }); return m; }, []);
  useEffect(() => () => Object.values(texMap).forEach(t => t.dispose()), [texMap]);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Countdown
  useEffect(() => {
    if (gameState !== 'countdown') return;
    if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c - 1), 1000); return () => clearTimeout(t); }
    setGameState('playing');
  }, [gameState, countdown]);

  // Timer + score
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (timeLeft > 0) {
      const t = setTimeout(() => { setTimeLeft(s => s - 1); setScore(s => s + 15); }, 1000);
      return () => clearTimeout(t);
    }
    aliveRef.current = false;
    setGameState('finished');
  }, [gameState, timeLeft]);

  // Bucle de física (coordenadas lógicas)
  useEffect(() => {
    if (gameState !== 'playing') return;
    aliveRef.current = true;
    playerXRef.current = 50; dirRef.current = 1; hitRef.current = false;
    itemsRef.current = []; idsRef.current = ''; setItems([]);
    stRef.current = { t: 0, nextSpawn: 0 };
    let raf, last = performance.now();
    const sync = () => { const ids = itemsRef.current.map(i => i.id).join(','); if (ids !== idsRef.current) { idsRef.current = ids; setItems(itemsRef.current.map(i => ({ id: i.id, emoji: i.emoji }))); } };
    const loop = (now) => {
      if (!aliveRef.current) return;
      const dt = Math.min(40, now - last) / 16; last = now;
      const progress = 1 - timeLeftRef.current / 60;
      progressRef.current = progress;
      const st = stRef.current; st.t += dt * 16;

      // bola en zigzag
      playerXRef.current += dirRef.current * (1.3 + progress * 3.0) * dt;
      if (playerXRef.current < 6) { playerXRef.current = 6; dirRef.current = 1; }
      if (playerXRef.current > 94) { playerXRef.current = 94; dirRef.current = -1; }

      // spawn de productos
      if (st.t > st.nextSpawn) {
        const dur = Math.max(1, (3 - progress * 1.7) + Math.random() * 0.5);
        itemsRef.current.push({ id: idRef.current++, x: 8 + Math.random() * 84, y: -8, vy: 112 / (dur * 60), rot: 0, vrot: (Math.random() - 0.5) * 0.05, emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] });
        st.nextSpawn = st.t + Math.max(220, 1100 - progress * 900) + (Math.random() * 160 - 80);
      }

      // caída + colisión
      for (const it of itemsRef.current) { it.y += it.vy * dt; it.rot += it.vrot * dt; }
      for (const it of itemsRef.current) {
        if (Math.abs(it.x - playerXRef.current) < 8.5 && Math.abs(it.y - BALL_Y) < 8.5) {
          hitRef.current = true; aliveRef.current = false;
          setTimeout(() => setGameState('gameover'), 120);
          return;
        }
      }
      itemsRef.current = itemsRef.current.filter(it => it.y < 112);
      sync();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { aliveRef.current = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const flipDir = () => { if (gameState === 'playing') dirRef.current *= -1; };
  const handleStartMode = (mode) => { setGameMode(mode); if (onConsumeAttempt) onConsumeAttempt(mode); setCountdown(3); setGameState('countdown'); };
  const handleEnd = () => { if (onFinish) onFinish(scoreRef.current, gameMode); };

  // INTRO
  if (gameState === 'intro') {
    return (
      <div className="fixed inset-0 z-[100] bg-[#1a0b2e] text-white flex flex-col p-6 overflow-y-auto animate-in fade-in">
        <button onClick={onCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-30"><X size={24} className="text-white" /></button>
        <div className="mt-12 flex flex-col items-center pb-24">
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] mb-6 border-b-4 border-emerald-800 rotate-12"><Gamepad2 size={40} className="text-white" /></div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 text-center">Cinta ZigZag</h2>
          <div className="bg-white/5 rounded-3xl p-6 border border-white/10 w-full max-w-sm mt-4 mb-8">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Info size={16} /> Reglas del Juego</h3>
            <ul className="space-y-4 text-sm font-medium text-slate-300">
              <li className="flex items-start gap-3"><div className="w-6 h-6 bg-emerald-500 rounded-full flex-shrink-0 mt-0.5 border-b-2 border-emerald-700" /><p>Tú eres la <strong className="text-white">bola verde</strong>. No para de moverse, <strong className="text-amber-400">toca la pantalla</strong> para cambiar su dirección.</p></li>
              <li className="flex items-start gap-3"><div className="w-6 h-6 bg-slate-200 rounded flex-shrink-0 flex items-center justify-center text-xs mt-0.5">🛒</div><p><strong className="text-white">Esquiva</strong> los productos que caen por la cinta. Si tocas uno, fin del juego.</p></li>
              <li className="flex items-start gap-3"><div className="w-6 h-6 bg-amber-500 rounded flex-shrink-0 flex items-center justify-center font-black text-white text-xs mt-0.5 border-b-2 border-amber-700">+</div><p>Ganas <strong className="text-emerald-400">15 puntos</strong> por cada segundo que sobrevivas.</p></li>
              <li className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-500/30"><p className="text-xs text-emerald-200">La cinta <strong className="text-white">se acelera</strong> con el tiempo. ¿Aguantarás los 60 segundos?</p></li>
            </ul>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <button onClick={() => handleStartMode('prueba')} disabled={practiceAttempts <= 0} className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 ${practiceAttempts > 0 ? 'bg-slate-700 text-white border-slate-900 active:scale-95 shadow-lg hover:bg-slate-600' : 'bg-slate-800 text-slate-500 border-slate-900 opacity-50 cursor-not-allowed'}`}>Prueba ({practiceAttempts} oportunidad)</button>
            <button onClick={() => handleStartMode('jugar')} disabled={playAttempts <= 0} className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 ${playAttempts > 0 ? 'bg-emerald-500 text-white border-emerald-700 active:scale-95 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400' : 'bg-slate-800 text-slate-500 border-slate-900 opacity-50 cursor-not-allowed'}`}><Play size={18} className={playAttempts > 0 ? 'fill-white' : ''} /> JUGAR PARA RANKING ({playAttempts} op.)</button>
            <button onClick={onCancel} className="w-full py-4 mt-2 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 active:scale-95">VOLVER ATRÁS</button>
          </div>
        </div>
      </div>
    );
  }

  // GAMEOVER / FINISHED
  if (gameState === 'gameover' || gameState === 'finished') {
    const isEliminated = gameState === 'gameover';
    return (
      <div className="fixed inset-0 z-[100] bg-[#1a0b2e] text-white flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
        {isEliminated ? <AlertTriangle size={80} className="text-rose-500 mb-6 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse" /> : <Trophy size={80} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" />}
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-center">{isEliminated ? '¡CHOCASTE!' : '¡TIEMPO!'}</h2>
        {isEliminated && <p className="text-rose-400 font-bold mb-6 text-center max-w-xs">Un producto te ha aplastado. Más suerte la próxima.</p>}
        <div className="bg-white/10 rounded-3xl p-8 text-center backdrop-blur-md border border-white/20 shadow-2xl mb-8 w-full max-w-sm">
          <p className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-2">Puntos conseguidos</p>
          <p className={`text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br drop-shadow-lg ${isEliminated ? 'from-slate-300 to-slate-500' : 'from-emerald-300 to-emerald-600'}`}>{score}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-indigo-300">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
        </div>
        <button onClick={handleEnd} className="bg-white text-indigo-900 font-black px-10 py-4 rounded-full uppercase text-sm shadow-[0_10px_20px_rgba(255,255,255,0.2)] active:scale-95 transition-all w-full max-w-sm">Continuar</button>
      </div>
    );
  }

  // PLAYING / COUNTDOWN
  return (
    <div className="fixed inset-0 z-[100] bg-[#060a14] overflow-hidden font-sans touch-none" onPointerDown={flipDir}>
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-lg">
          <Clock size={16} className={timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'} />
          <span className={`font-black text-lg tracking-widest ${timeLeft <= 10 ? 'text-rose-400' : 'text-white'}`}>00:{timeLeft.toString().padStart(2, '0')}</span>
        </div>
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-lg">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">Puntos</span>
          <span className="font-black text-lg text-white">{score}</span>
        </div>
      </div>
      <button onClick={onCancel} className="absolute top-16 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-30"><X size={20} className="text-white/60" /></button>

      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 9], fov: 46 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <Suspense fallback={null}>
          <Scene playerXRef={playerXRef} hitRef={hitRef} progressRef={progressRef} itemsRef={itemsRef} items={items} texMap={texMap} postFx={postFx} onSlow={() => setPostFx(false)} />
        </Suspense>
      </Canvas>

      <p className="absolute bottom-3 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none z-20">Toca para cambiar de dirección · esquiva los productos</p>

      {gameState === 'countdown' && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col">
          <p className="text-emerald-400 font-bold uppercase tracking-widest mb-4 text-center px-8">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="text-9xl font-black text-white animate-bounce drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">{countdown > 0 ? countdown : '¡YA!'}</div>
        </div>
      )}
    </div>
  );
}
