import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GameShell, clamp, rand, ScoreBurst } from './GameShell';

const MAX_FAILS = 3;
const PW = 6;     // ancho de la pista en el mundo 3D
const PH = 1.9;   // alto de la pista
const toWorldX = (pct) => (pct / 100 - 0.5) * PW;

const damp = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));

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

// Código de barras (zona objetivo). Brilla en verde al acertar.
function Barcode({ zone, okRef }) {
  const frameMat = useRef();
  const centerX = toWorldX(zone.start + zone.width / 2);
  const wWorld = (zone.width / 100) * PW;
  const bars = useMemo(() => {
    const usable = wWorld - 0.16;                       // margen junto al marco
    const n = Math.max(4, Math.round(usable / 0.14));   // nº de barras según el ancho de la zona
    const step = usable / n;
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push({ x: -usable / 2 + step * (i + 0.5), w: (i % 2 ? step * 0.34 : step * 0.6) });
    }
    return arr;
  }, [wWorld]);

  useFrame((_, dt) => {
    if (frameMat.current) frameMat.current.emissiveIntensity = damp(frameMat.current.emissiveIntensity, 0.6 + okRef.current * 2.4, 10, dt);
  });

  return (
    <group position={[centerX, 0, 0.04]}>
      {/* fondo de la zona */}
      <mesh>
        <boxGeometry args={[wWorld, PH * 0.78, 0.06]} />
        <meshStandardMaterial color="#052e23" emissive="#10b981" emissiveIntensity={0.25} transparent opacity={0.65} />
      </mesh>
      {/* barras */}
      {bars.map((b, i) => (
        <mesh key={i} position={[b.x, 0, 0.06]}>
          <boxGeometry args={[b.w, PH * 0.6, 0.04]} />
          <meshStandardMaterial color="#e2f5ee" emissive="#a7f3d0" emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* marco verde emisivo */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (wWorld / 2), 0, 0.06]}>
          <boxGeometry args={[0.07, PH * 0.84, 0.12]} />
          <meshStandardMaterial ref={s === 1 ? frameMat : undefined} color="#10b981" emissive="#34d399" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// Haz láser rojo que barre la pista.
function Laser({ posRef, dirRef, speedRef, runningRef }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (runningRef.current) {
      let p = posRef.current + dirRef.current * speedRef.current * dt * 62.5;
      if (p >= 100) { p = 100; dirRef.current = -1; }
      if (p <= 0) { p = 0; dirRef.current = 1; }
      posRef.current = p;
    }
    if (ref.current) ref.current.position.x = toWorldX(posRef.current);
  });
  return (
    <group ref={ref} position={[0, 0, 0.22]}>
      <mesh>
        <boxGeometry args={[0.1, PH * 1.05, 0.14]} />
        <meshStandardMaterial color="#fb7185" emissive="#f43f5e" emissiveIntensity={2.4} />
      </mesh>
      {/* resplandor lateral */}
      <mesh position={[0, 0, -0.18]}>
        <planeGeometry args={[0.7, PH * 1.05]} />
        <meshBasicMaterial color="#f43f5e" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function EscanerScene({ zone, posRef, dirRef, speedRef, runningRef, okRef, shakeRef, postFx, onSlow }) {
  const root = useRef();
  useFrame((_, dt) => {
    okRef.current = damp(okRef.current, 0, 6, dt);
    if (root.current) {
      if (shakeRef.current > 0.001) {
        shakeRef.current = damp(shakeRef.current, 0, 8, dt);
        root.current.position.x = (Math.random() - 0.5) * shakeRef.current * 0.5;
        root.current.position.y = (Math.random() - 0.5) * shakeRef.current * 0.3;
      } else { root.current.position.set(0, 0, 0); }
    }
  });

  return (
    <>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 6]} intensity={1.1} />
      <pointLight position={[0, 0, 4]} intensity={14} color="#22d3ee" distance={16} />
      <PerfGuard onSlow={onSlow} />

      <group ref={root}>
        {/* carcasa de la pista */}
        <mesh position={[0, 0, -0.25]}>
          <boxGeometry args={[PW + 0.8, PH + 0.7, 0.4]} />
          <meshStandardMaterial color="#0b1220" metalness={0.4} roughness={0.55} />
        </mesh>
        {/* superficie oscura */}
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[PW + 0.3, PH + 0.2, 0.12]} />
          <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.5} />
        </mesh>
        <Barcode zone={zone} okRef={okRef} />
        <Laser posRef={posRef} dirRef={dirRef} speedRef={speedRef} runningRef={runningRef} />
      </group>

      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.3} intensity={1.0} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

function Play({ end }) {
  const [hits, setHits] = useState(0);
  const [fails, setFails] = useState(0);
  const [level, setLevel] = useState(1);
  const [flash, setFlash] = useState(null); // 'ok' | 'ko'
  const [zone, setZone] = useState({ start: 40, width: 26 });
  const [postFx, setPostFx] = useState(true);

  const posRef = useRef(8);
  const dirRef = useRef(1);
  const speedRef = useRef(0.6);
  const zoneRef = useRef({ start: 40, width: 26 });
  const runningRef = useRef(true);
  const okRef = useRef(0);
  const shakeRef = useRef(0);
  const hitsRef = useRef(0);
  const failsRef = useRef(0);
  const levelRef = useRef(1);
  const lockRef = useRef(false);
  const endRef = useRef(end);
  endRef.current = end;

  const newZone = () => {
    const width = clamp(28 - levelRef.current * 1.5, 7, 28);
    const start = rand(6, Math.max(7, Math.floor(100 - width - 6)));
    const z = { start, width };
    zoneRef.current = z;
    setZone(z);
    speedRef.current = 0.55 + levelRef.current * 0.07;
  };

  useEffect(() => { newZone(); return () => { runningRef.current = false; }; }, []);

  const scan = () => {
    if (lockRef.current) return;
    const { start, width } = zoneRef.current;
    const inZone = posRef.current >= start && posRef.current <= start + width;
    lockRef.current = true;
    if (inZone) {
      hitsRef.current += 1; levelRef.current += 1;
      setHits(hitsRef.current); setLevel(levelRef.current);
      setFlash('ok'); okRef.current = 1;
      setTimeout(() => { setFlash(null); lockRef.current = false; newZone(); }, 180);
    } else {
      failsRef.current += 1;
      setFails(failsRef.current);
      setFlash('ko'); shakeRef.current = 1;
      if (failsRef.current >= MAX_FAILS) {
        runningRef.current = false;
        setTimeout(() => endRef.current(clamp(hitsRef.current * 80 + levelRef.current * 10, 0, 2000)), 450);
      } else {
        setTimeout(() => { setFlash(null); lockRef.current = false; }, 350);
      }
    }
  };

  const livesLeft = Math.max(0, MAX_FAILS - fails);

  return (
    <div
      className={`flex-1 flex flex-col items-center px-6 pb-6 select-none transition-colors duration-150 ${flash === 'ok' ? 'bg-emerald-500/10' : flash === 'ko' ? 'bg-rose-500/20' : ''}`}
      onPointerDown={scan}
    >
      <div className="flex items-center gap-3 mb-3 mt-1">
        <span className="hud-chip text-cyan-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <span className="hud-chip text-emerald-400 font-black px-4 py-1.5 rounded-full text-sm">✓ {hits}</span>
        <ScoreBurst value={hits} color="#22d3ee" />
        <span className="hud-chip font-black px-3 py-1.5 rounded-full text-sm">{'❤️'.repeat(livesLeft)}{'🖤'.repeat(fails)}</span>
      </div>
      <p className="text-white/70 font-bold uppercase tracking-widest text-xs mb-2 text-center max-w-[280px] leading-relaxed">Pulsa cuando el láser cruce el <strong className="text-cyan-300">código de barras</strong></p>

      <div className="relative w-full flex-1" style={{ minHeight: 320 }}>
        <Canvas dpr={[1, 2]} camera={{ position: [0, 1.3, 6], fov: 42 }} gl={{ antialias: false, powerPreference: 'high-performance' }} onCreated={({ camera }) => camera.lookAt(0, -0.1, 0)}>
          <Suspense fallback={null}>
            <EscanerScene zone={zone} posRef={posRef} dirRef={dirRef} speedRef={speedRef} runningRef={runningRef} okRef={okRef} shakeRef={shakeRef} postFx={postFx} onSlow={() => setPostFx(false)} />
          </Suspense>
        </Canvas>
      </div>

      <div className="mt-2 text-cyan-950 font-black text-xl px-14 py-3.5 rounded-2xl border-b-4 border-cyan-800 pointer-events-none" style={{ background: 'linear-gradient(160deg, #67e8f9, #06b6d4)', boxShadow: '0 6px 18px rgba(6,182,212,0.5), inset 0 2px 5px rgba(255,255,255,0.5)' }}>
        ESCANEAR
      </div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-2">Toca en cualquier sitio para escanear</p>
    </div>
  );
}

export function EscanerGame(props) {
  return (
    <GameShell
      {...props}
      day={12} title="Escáner" emoji="🔦" accent="cyan"
      instructions={[
        <span key="1">El láser barre la pista. Pulsa justo cuando cruce el <strong>código de barras</strong> (zona verde).</span>,
        <span key="2">Cada acierto sube de nivel: el código se <strong>estrecha</strong> y el láser va <strong>más rápido</strong>.</span>,
        <span key="3">Pura <strong>puntería y destreza</strong>. ¡A los 3 fallos, eliminado!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
