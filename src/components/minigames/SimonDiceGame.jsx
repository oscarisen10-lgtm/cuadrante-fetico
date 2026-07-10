import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GameShell, clamp, rand, ScoreBurst } from './GameShell';

// Paleta de los 4 cuadrantes (color encendido / apagado)
const PADS = [
  { id: 0, base: '#065f46', emis: '#10b981' }, // verde
  { id: 1, base: '#9f1239', emis: '#f43f5e' }, // rojo
  { id: 2, base: '#92400e', emis: '#f59e0b' }, // ámbar
  { id: 3, base: '#075985', emis: '#0ea5e9' }, // azul
];

const damp = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));

// Vigía de FPS: apaga el bloom si el dispositivo va lento de forma sostenida.
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

// Un cuadrante del disco (sector de anillo extruido) que brilla y se hunde al activarse.
function Quadrant({ geo, idx, pad, active, onTap }) {
  const group = useRef();
  const mat = useRef();
  const hover = useRef(false);
  useFrame((_, dt) => {
    if (mat.current) {
      const target = active ? 1.8 : hover.current ? 0.4 : 0.12;
      mat.current.emissiveIntensity = damp(mat.current.emissiveIntensity, target, 12, dt);
    }
    if (group.current) {
      group.current.position.y = damp(group.current.position.y, active ? -0.14 : 0, 16, dt);
    }
  });
  return (
    <group
      ref={group}
      rotation={[0, idx * (Math.PI / 2), 0]}
      onPointerDown={(e) => { e.stopPropagation(); onTap(pad.id); }}
      onPointerOver={(e) => { e.stopPropagation(); hover.current = true; }}
      onPointerOut={() => { hover.current = false; }}
    >
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial ref={mat} color={pad.base} emissive={pad.emis} emissiveIntensity={0.12} metalness={0.3} roughness={0.35} />
      </mesh>
    </group>
  );
}

function SimonScene({ lit, onTap, level, postFx, onSlow }) {
  const geo = useMemo(() => {
    const ri = 1.08, ro = 2.4, gap = 0.07;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, ro, gap, Math.PI / 2 - gap, false);
    shape.absarc(0, 0, ri, Math.PI / 2 - gap, gap, true);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.55, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 2, curveSegments: 32,
    });
  }, []);

  return (
    <>
      <color attach="background" args={['#0d0820']} />
      <fog attach="fog" args={['#0d0820', 10, 20]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 8, 4]} intensity={1.2} />
      <pointLight position={[0, 5, 3]} intensity={22} color="#a78bfa" distance={22} />

      <PerfGuard onSlow={onSlow} />

      {/* base de la consola */}
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[2.78, 2.95, 0.55, 56]} />
        <meshStandardMaterial color="#160d2c" metalness={0.35} roughness={0.6} />
      </mesh>
      {/* botón central */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.92, 0.98, 0.42, 48]} />
        <meshStandardMaterial color="#2a1a45" metalness={0.45} roughness={0.4} emissive="#7c3aed" emissiveIntensity={0.18} />
      </mesh>

      {PADS.map((p, i) => (
        <Quadrant key={p.id} geo={geo} idx={i} pad={p} active={lit === p.id} onTap={onTap} />
      ))}

      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.45} luminanceSmoothing={0.3} intensity={1.0} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

function Play({ end }) {
  const [seq, setSeq] = useState([rand(0, 3)]);
  const [phase, setPhase] = useState('show'); // show | input
  const [lit, setLit] = useState(null);
  const [postFx, setPostFx] = useState(true);
  const inputIdx = useRef(0);
  const timeouts = useRef([]);

  // Reproduce la secuencia iluminando cada cuadrante
  useEffect(() => {
    if (phase !== 'show') return;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    seq.forEach((pad, i) => {
      timeouts.current.push(setTimeout(() => setLit(pad), 500 + i * 650));
      timeouts.current.push(setTimeout(() => setLit(null), 500 + i * 650 + 380));
    });
    timeouts.current.push(setTimeout(() => {
      inputIdx.current = 0;
      setPhase('input');
    }, 500 + seq.length * 650 + 200));
    return () => timeouts.current.forEach(clearTimeout);
  }, [phase, seq]);

  const tap = (id) => {
    if (phase !== 'input') return;
    setLit(id);
    setTimeout(() => setLit(null), 220);
    if (id !== seq[inputIdx.current]) {
      end(clamp((seq.length - 1) * 100, 0, 1000));
      return;
    }
    inputIdx.current += 1;
    if (inputIdx.current >= seq.length) {
      if (seq.length >= 10) { end(1000); return; }
      setTimeout(() => {
        setSeq(s => [...s, rand(0, 3)]);
        setPhase('show');
      }, 600);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-6 pb-6 select-none">
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-1">Nivel {seq.length}</p>
      <ScoreBurst value={seq.length} color="#c4b5fd" />
      <p className={`font-black text-xl mb-1 ${phase === 'show' ? 'text-amber-400' : 'text-emerald-400'}`}>
        {phase === 'show' ? '👀 MEMORIZA...' : '✋ ¡TU TURNO!'}
      </p>

      <div className="relative w-full flex-1" style={{ minHeight: 340 }}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 4.9, 3.7], fov: 46 }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <SimonScene lit={lit} onTap={tap} level={seq.length} postFx={postFx} onSlow={() => setPostFx(false)} />
          </Suspense>
        </Canvas>
      </div>

      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-1 text-center px-6">Memoriza la secuencia y repítela · cada nivel añade un paso</p>
    </div>
  );
}

export function SimonDiceGame(props) {
  return (
    <GameShell
      {...props}
      day={6} title="Simón Dice" emoji="🧠" accent="violet"
      instructions={[
        <span key="1">Memoriza la <strong>secuencia de colores</strong> que se ilumina.</span>,
        <span key="2">Repítela tocando los cuadrantes <strong>en el mismo orden</strong>.</span>,
        <span key="3">Cada nivel añade un paso más. ¡Llega al nivel 10 para 1000 puntos!</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
