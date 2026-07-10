import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { X, Trophy, Play, Gamepad2, Info } from 'lucide-react';

const PRODUCTS = ['🍎', '🥦', '🍗', '🧀', '📦', '🛒', '🥚', '🍅', '🧴', '🍫'];
const TOTAL = 3;
const VW = 7, VD = 2.4;       // largo y ancho de la cinta
const toWX = (x) => (x / 100 - 0.5) * VW;
const damp = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));

function makeProductTex(emoji) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fill();
  ctx.font = '74px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function makeBeltTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#1e293b'); g.addColorStop(0.5, '#475569'); g.addColorStop(1, '#1e293b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 9, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 1); return t;
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

function Belt() {
  const tex = useMemo(() => makeBeltTex(), []);
  useFrame((_, dt) => { tex.offset.x -= dt * 0.5; });
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[VW, VD]} />
      <meshStandardMaterial map={tex} metalness={0.5} roughness={0.55} />
    </mesh>
  );
}

// Lector de la caja: arco + franja central + diana que destella al escanear.
function Reader({ flashRef }) {
  const stripe = useRef();
  const ring1 = useRef();
  const ring2 = useRef();
  useFrame((_, dt) => {
    const f = flashRef.current = damp(flashRef.current, 0, 5, dt);
    if (stripe.current) stripe.current.material.emissiveIntensity = 1.4 + f * 3;
    if (ring1.current) { const s = 1 + (1 - f) * 0.0 + f * 1.6; ring1.current.scale.set(s, s, s); ring1.current.material.opacity = 0.5 + f * 0.5; }
    if (ring2.current) { const s = 1 + f * 2.4; ring2.current.scale.set(s, s, s); ring2.current.material.opacity = f * 0.6; }
  });
  return (
    <group>
      {/* franja central (el centro exacto) */}
      <mesh ref={stripe} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.16, VD]} />
        <meshStandardMaterial ref={undefined} color="#10b981" emissive="#34d399" emissiveIntensity={1.4} />
      </mesh>
      {/* diana */}
      <mesh ref={ring1} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.52, 40]} />
        <meshBasicMaterial color="#a7f3d0" transparent opacity={0.5} />
      </mesh>
      <mesh ref={ring2} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.66, 40]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0} />
      </mesh>
      {/* arco del lector */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[0, 0.7, s * (VD / 2)]}>
          <boxGeometry args={[0.16, 1.4, 0.16]} />
          <meshStandardMaterial color="#0891b2" emissive="#22d3ee" emissiveIntensity={1} />
        </mesh>
      ))}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.16, 0.16, VD + 0.16]} />
        <meshStandardMaterial color="#0891b2" emissive="#22d3ee" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function Product({ productRef, tex }) {
  const ref = useRef();
  useFrame(() => {
    const p = productRef.current; const m = ref.current; if (!m || !p) return;
    m.visible = p.active;
    m.position.x = toWX(p.x);
  });
  return (
    <mesh ref={ref} position={[0, 0.5, 0]} visible={false}>
      <planeGeometry args={[0.95, 0.95]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.1} />
    </mesh>
  );
}

function Scene({ productRef, productTex, flashRef, postFx, onSlow }) {
  return (
    <>
      <color attach="background" args={['#060a14']} />
      <fog attach="fog" args={['#060a14', 9, 18]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 5, 3]} intensity={1.1} />
      <pointLight position={[0, 3, 2]} intensity={16} color="#22d3ee" distance={18} />
      <PerfGuard onSlow={onSlow} />
      <Belt />
      <Reader flashRef={flashRef} />
      <Product productRef={productRef} tex={productTex} />
      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.3} intensity={0.9} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

export function CatchTheShiftGame({ onFinish, onCancel, practiceAttempts, playAttempts, onConsumeAttempt }) {
  const [gameState, setGameState] = useState('intro'); // intro | countdown | playing | finished
  const [gameMode, setGameMode] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [shown, setShown] = useState(0);          // productos ya pasados (para el HUD)
  const [feedback, setFeedback] = useState(null); // { label, pts, key }
  const [productView, setProductView] = useState({ emoji: PRODUCTS[0] });
  const [postFx, setPostFx] = useState(true);

  const scoreRef = useRef(0);
  const productRef = useRef(null);
  const indexRef = useRef(0);
  const flashRef = useRef(0);
  const aliveRef = useRef(false);
  const fbKey = useRef(0);
  const endRef = useRef(onFinish);
  endRef.current = onFinish;

  const texMap = useMemo(() => { const m = {}; PRODUCTS.forEach(e => { m[e] = makeProductTex(e); }); return m; }, []);
  useEffect(() => () => Object.values(texMap).forEach(t => t.dispose()), [texMap]);

  // Countdown
  useEffect(() => {
    if (gameState !== 'countdown') return;
    if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c - 1), 1000); return () => clearTimeout(t); }
    setGameState('playing');
  }, [gameState, countdown]);

  const finish = () => { aliveRef.current = false; productRef.current = null; setTimeout(() => endRef.current(scoreRef.current, gameMode), 600); };

  const spawn = (i) => {
    const emoji = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    productRef.current = { x: -8, vx: 24 + i * 13, emoji, active: true, scanned: false };
    setProductView({ emoji });
  };

  const nextProduct = () => {
    indexRef.current += 1;
    setShown(indexRef.current);
    setFeedback(null);
    if (indexRef.current >= TOTAL) { finish(); return; }
    spawn(indexRef.current);
  };

  // Bucle: mueve el producto y detecta si se pasa de largo
  useEffect(() => {
    if (gameState !== 'playing') return;
    aliveRef.current = true;
    scoreRef.current = 0; setScore(0); indexRef.current = 0; setShown(0); setFeedback(null);
    spawn(0);
    let raf, last = performance.now();
    const loop = (now) => {
      if (!aliveRef.current) return;
      const dt = Math.min(40, now - last) / 1000; last = now;
      const p = productRef.current;
      if (p && p.active && !p.scanned) {
        p.x += p.vx * dt;
        if (p.x > 108) { p.scanned = true; p.active = false; fbKey.current++; setFeedback({ label: 'FALLASTE', pts: 0, key: fbKey.current }); setTimeout(nextProduct, 800); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { aliveRef.current = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const scan = () => {
    if (gameState !== 'playing') return;
    const p = productRef.current;
    if (!p || !p.active || p.scanned) return;
    p.scanned = true; p.active = false;
    const dist = Math.abs(p.x - 50);
    const pts = Math.max(0, Math.round(350 * (1 - dist / 30)));
    let label = dist < 2.5 ? '¡PERFECTO!' : dist < 7 ? '¡GENIAL!' : dist < 14 ? 'BIEN' : dist < 24 ? 'REGULAR' : 'CASI…';
    if (pts === 0) label = 'FALLASTE';
    scoreRef.current += pts; setScore(scoreRef.current);
    flashRef.current = 1;
    fbKey.current++; setFeedback({ label, pts, key: fbKey.current });
    setTimeout(nextProduct, 850);
  };

  const startMode = (mode) => { setGameMode(mode); if (onConsumeAttempt) onConsumeAttempt(mode); setCountdown(3); setGameState('countdown'); };

  // INTRO
  if (gameState === 'intro') {
    return (
      <div className="fixed inset-0 z-[100] bg-[#041018] text-white flex flex-col p-6 overflow-y-auto animate-in fade-in">
        <button onClick={onCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-30"><X size={24} /></button>
        <div className="mt-12 flex flex-col items-center pb-24">
          <div className="w-20 h-20 bg-cyan-600 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.5)] mb-6 border-b-4 border-cyan-800 rotate-12"><Gamepad2 size={40} className="text-white" /></div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 text-center">Caja Certera</h2>
          <div className="bg-white/5 rounded-3xl p-6 border border-white/10 w-full max-w-sm mt-4 mb-8">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Info size={16} /> Cómo se juega</h3>
            <ul className="space-y-4 text-sm font-medium text-slate-300">
              <li className="flex items-start gap-3"><span className="text-2xl">🛒</span><p>Pasan <strong className="text-white">3 productos</strong> por la cinta, uno a uno.</p></li>
              <li className="flex items-start gap-3"><span className="text-2xl">🎯</span><p><strong className="text-white">Toca</strong> cuando el producto cruce el <strong className="text-emerald-400">centro del lector</strong> (la línea verde).</p></li>
              <li className="flex items-start gap-3"><span className="text-2xl">⭐</span><p>Cuanto <strong className="text-white">más centrado</strong>, más puntos. Cada uno va <strong className="text-amber-400">más rápido</strong>.</p></li>
            </ul>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <button onClick={() => startMode('prueba')} disabled={practiceAttempts <= 0} className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 ${practiceAttempts > 0 ? 'bg-slate-700 text-white border-slate-900 active:scale-95 shadow-lg hover:bg-slate-600' : 'bg-slate-800 text-slate-500 border-slate-900 opacity-50 cursor-not-allowed'}`}>Prueba ({practiceAttempts} op.)</button>
            <button onClick={() => startMode('jugar')} disabled={playAttempts <= 0} className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 ${playAttempts > 0 ? 'bg-cyan-500 text-white border-cyan-700 active:scale-95 shadow-lg shadow-cyan-500/30 hover:bg-cyan-400' : 'bg-slate-800 text-slate-500 border-slate-900 opacity-50 cursor-not-allowed'}`}><Play size={18} className={playAttempts > 0 ? 'fill-white' : ''} /> JUGAR PARA RANKING ({playAttempts} op.)</button>
            <button onClick={onCancel} className="w-full py-4 mt-2 rounded-2xl font-black uppercase text-sm tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 active:scale-95">VOLVER ATRÁS</button>
          </div>
        </div>
      </div>
    );
  }

  // FINISHED
  if (gameState === 'finished') {
    return (
      <div className="fixed inset-0 z-[100] bg-[#041018] text-white flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
        <Trophy size={80} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" />
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-center">¡CAJA CERRADA!</h2>
        <div className="bg-white/10 rounded-3xl p-8 text-center backdrop-blur-md border border-white/20 shadow-2xl mb-8 w-full max-w-sm">
          <p className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-2">Puntos conseguidos</p>
          <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-emerald-600 drop-shadow-lg">{score}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-indigo-300">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
        </div>
        <button onClick={() => endRef.current(scoreRef.current, gameMode)} className="bg-white text-cyan-900 font-black px-10 py-4 rounded-full uppercase text-sm shadow-[0_10px_20px_rgba(255,255,255,0.2)] active:scale-95 transition-all w-full max-w-sm">Continuar</button>
      </div>
    );
  }

  // PLAYING / COUNTDOWN
  return (
    <div className="fixed inset-0 z-[100] bg-[#060a14] overflow-hidden font-sans touch-none" onPointerDown={scan}>
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-lg">
          <span className="text-cyan-400 font-bold text-xs uppercase tracking-widest">Producto</span>
          <span className="font-black text-lg text-white">{Math.min(shown + 1, TOTAL)}/{TOTAL}</span>
        </div>
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-lg">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">Puntos</span>
          <span className="font-black text-lg text-white">{score}</span>
        </div>
      </div>
      <button onClick={onCancel} className="absolute top-16 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-30"><X size={20} className="text-white/60" /></button>

      <Canvas dpr={[1, 2]} camera={{ position: [0, 3, 4.8], fov: 46 }} gl={{ antialias: false, powerPreference: 'high-performance' }} onCreated={({ camera }) => camera.lookAt(0, 0.2, -0.2)}>
        <Suspense fallback={null}>
          <Scene productRef={productRef} productTex={texMap[productView.emoji]} flashRef={flashRef} postFx={postFx} onSlow={() => setPostFx(false)} />
        </Suspense>
      </Canvas>

      {feedback && (
        <div key={feedback.key} className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-30 animate-in fade-in zoom-in duration-200">
          <span className={`text-4xl font-black uppercase tracking-tighter drop-shadow-lg ${feedback.pts === 0 ? 'text-rose-400' : feedback.pts >= 300 ? 'text-emerald-300' : 'text-cyan-200'}`}>{feedback.label}</span>
          {feedback.pts > 0 && <span className="text-2xl font-black text-amber-300 mt-1">+{feedback.pts}</span>}
        </div>
      )}

      <p className="absolute bottom-3 left-0 right-0 text-center text-white/35 text-[11px] font-bold uppercase tracking-wide pointer-events-none z-20">Toca cuando el producto cruce la línea verde</p>

      {gameState === 'countdown' && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col">
          <p className="text-cyan-400 font-bold uppercase tracking-widest mb-4 text-center px-8">Modo: {gameMode === 'jugar' ? 'Ranking' : 'Prueba'}</p>
          <div className="text-9xl font-black text-white animate-bounce drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">{countdown > 0 ? countdown : '¡YA!'}</div>
        </div>
      )}
    </div>
  );
}
