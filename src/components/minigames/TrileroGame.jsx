import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GameShell, clamp, rand } from './GameShell';

// Sombra de contacto "falsa" y baratísima: un plano con una textura radial (gradiente
// negro→transparente). Sustituye a <ContactShadows> de @react-three/drei, lo que nos
// permite eliminar esa dependencia entera del bundle (drei arrastra react-spring,
// camera-controls, maath…). Se dibuja una bajo cada hueco del trilero.
function GroundShadows() {
  const tex = useMemo(() => {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <>
      {SLOT_X.map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 0]}>
          <planeGeometry args={[2.6, 2.6]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// Posiciones X de los 3 huecos en el mundo 3D
const SLOT_X = [-2.15, 0, 2.15];

// Dificultad: arranca fuerte (nivel 1 ≈ antiguo nivel 7) y sube rápido entre niveles.
const START_DELAY = 520;    // ms entre movimientos en el nivel 1
const DELAY_FACTOR = 0.84;  // cada nivel acelera ~16% (misma progresión que te gustó)
const MIN_DELAY = 108;      // tope de velocidad, alcanzado en el nivel 10
const START_SWAPS = 6;      // mezclas en el nivel 1
const SWAPS_PER_LVL = 2;    // +2 mezclas por nivel (6, 8, 10, 12…)
const swapsFor = (lvl) => START_SWAPS + (lvl - 1) * SWAPS_PER_LVL;
const delayFor = (lvl) => Math.max(MIN_DELAY, Math.round(START_DELAY * Math.pow(DELAY_FACTOR, lvl - 1)));

// Suavizado exponencial independiente del framerate (lerp hacia un objetivo)
const damp = (current, target, lambda, dt) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Paleta acorde a la app (verde esmeralda)
const C = {
  cup: '#10b981', cupEmis: '#059669', cupWrong: '#ef4444',
  cap: '#ecfdf5', band: '#a7f3d0', ring: '#fbbf24', ringEmis: '#92400e',
  ball: '#fcd34d', ballEmis: '#f59e0b',
  table: '#06281e', bg: '#03120c', accent: '#34d399',
};

/* ───────────────────────── Vaso 3D (cubilete) ───────────────────────── */
function Cup({ id, slot, arc, lifted, wrong, swapMs, cupPos, onPick }) {
  const group = useRef();
  const bodyMat = useRef();
  const hover = useRef(false);
  const inited = useRef(false);
  // Transición por arco entre huecos
  const fromX = useRef(SLOT_X[slot]);
  const toX = useRef(SLOT_X[slot]);
  const tRef = useRef(1);          // 1 = en reposo
  const arcDir = useRef(1);
  const arcH = useRef(0);
  const durRef = useRef(0.3);
  const prevSlot = useRef(slot);

  // Al cambiar de hueco, inicia un nuevo tránsito en arco
  useEffect(() => {
    if (prevSlot.current === slot) return;
    const cur = group.current ? group.current.position.x : SLOT_X[prevSlot.current];
    fromX.current = cur;
    toX.current = SLOT_X[slot];
    arcDir.current = arc || 1;
    arcH.current = Math.max(0.7, Math.abs(toX.current - cur) * 0.55); // profundidad del arco
    durRef.current = Math.max(0.12, (swapMs || 280) / 1000);
    tRef.current = 0;
    prevSlot.current = slot;
  }, [slot, arc, swapMs]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (!inited.current) { g.position.set(SLOT_X[slot], 0, 0); inited.current = true; }
    if (tRef.current < 1) {
      tRef.current = Math.min(1, tRef.current + dt / durRef.current);
      const t = tRef.current;
      g.position.x = THREE.MathUtils.lerp(fromX.current, toX.current, easeInOut(t));
      g.position.z = arcDir.current * Math.sin(t * Math.PI) * arcH.current; // pasa por delante/detrás
    } else {
      g.position.x = damp(g.position.x, SLOT_X[slot], 12, dt);
      g.position.z = damp(g.position.z, 0, 12, dt);
    }
    // Levantar (eje Y) al revelar / elegir
    const targetY = lifted ? 1.95 : 0;
    g.position.y = damp(g.position.y, targetY, 12, dt);
    // Squash & stretch sutil según la altura
    const stretch = 1 + (g.position.y / 1.95) * 0.06;
    g.scale.y = damp(g.scale.y, stretch, 14, dt);
    g.scale.x = damp(g.scale.x, 1 - (stretch - 1) * 0.5, 14, dt);
    g.scale.z = g.scale.x;
    // Publica su posición real para que la pelota la siga
    if (!cupPos.current[id]) cupPos.current[id] = new THREE.Vector3();
    cupPos.current[id].set(g.position.x, g.position.y, g.position.z);
    // Realce de emisión al pasar el dedo / fallo
    if (bodyMat.current) {
      const te = wrong ? 0.95 : hover.current ? 0.4 : 0.14;
      bodyMat.current.emissiveIntensity = damp(bodyMat.current.emissiveIntensity, te, 10, dt);
    }
  });

  const bodyColor = wrong ? C.cupWrong : C.cup;

  return (
    <group
      ref={group}
      onPointerDown={(e) => { e.stopPropagation(); onPick(); }}
      onPointerOver={(e) => { e.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { hover.current = false; document.body.style.cursor = 'auto'; }}
    >
      {/* Cuerpo: cono truncado invertido (boca ancha abajo, base estrecha arriba) */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.5, 0.72, 1.7, 48, 1, true]} />
        <meshStandardMaterial
          ref={bodyMat}
          color={bodyColor}
          emissive={wrong ? C.cupWrong : C.cupEmis}
          emissiveIntensity={0.14}
          metalness={0.3}
          roughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Tapa superior (base del cubilete) */}
      <mesh position={[0, 1.71, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
        <meshStandardMaterial color={C.cap} metalness={0.35} roughness={0.3} />
      </mesh>
      {/* Aro dorado de la boca (detalle premium) */}
      <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.05, 16, 48]} />
        <meshStandardMaterial color={C.ring} metalness={0.9} roughness={0.25} emissive={C.ringEmis} emissiveIntensity={0.3} />
      </mesh>
      {/* Banda decorativa */}
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.585, 0.585, 0.1, 48, 1, true]} />
        <meshStandardMaterial color={C.band} metalness={0.4} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Pelota 3D (pegada a su vaso) ───────────────────────── */
function Ball({ ballId, visible, cupPos }) {
  const mesh = useRef();
  const mat = useRef();
  const inited = useRef(false);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const target = cupPos.current[ballId];
    if (!inited.current) {
      m.position.set(target ? target.x : SLOT_X[ballId] ?? 0, 0.34, target ? target.z : 0);
      inited.current = true;
    } else if (target) {
      m.position.x = damp(m.position.x, target.x, 8, dt); // sigue al vaso; al cambiar de vaso, cruza visible
      m.position.z = damp(m.position.z, target.z, 8, dt);
    }
    m.position.y = 0.34; // siempre en la mesa (no sube con el vaso)
    const targetScale = visible ? 1 : 0.0001;
    const s = damp(m.scale.x, targetScale, 14, dt);
    m.scale.set(s, s, s);
    if (mat.current) mat.current.emissiveIntensity = visible ? 1.6 : 0;
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.34, 32, 32]} />
      <meshStandardMaterial ref={mat} color={C.ball} emissive={C.ballEmis} emissiveIntensity={1.6} metalness={0.15} roughness={0.18} />
    </mesh>
  );
}

/* ───────────────────────── Mesa ───────────────────────── */
function Table() {
  return (
    <mesh position={[0, -0.15, 0]}>
      <cylinderGeometry args={[5.2, 5.4, 0.3, 64]} />
      <meshStandardMaterial color={C.table} metalness={0.2} roughness={0.6} />
    </mesh>
  );
}

/* ───────────────────────── Vigía de rendimiento ───────────────────────── */
// Mide el FPS real y, si el dispositivo va lento de forma sostenida, avisa para
// apagar el post-procesado (Bloom/Vignette) y recuperar fluidez.
function PerfGuard({ onSlow }) {
  const frames = useRef(0);
  const elapsed = useRef(0);
  const lowStreak = useRef(0);
  const warmup = useRef(0);
  const done = useRef(false);
  useFrame((_, dt) => {
    if (done.current) return;
    if (warmup.current < 1.2) { warmup.current += dt; return; } // ignora el arranque (compilación de shaders)
    frames.current++;
    elapsed.current += dt;
    if (elapsed.current >= 1) {
      const fps = frames.current / elapsed.current;
      frames.current = 0; elapsed.current = 0;
      if (fps < 45) lowStreak.current++; else lowStreak.current = 0;
      if (lowStreak.current >= 2) { done.current = true; onSlow(); } // 2 s seguidos por debajo de 45 fps
    }
  });
  return null;
}

/* ───────────────────────── Escena (shake + luces + post) ───────────────────────── */
function Scene({ cups, ballId, showBall, shakeKey, swapMs, postFx, onSlow, onPick }) {
  const root = useRef();
  const shake = useRef(0);
  const prevShake = useRef(shakeKey);
  const cupPos = useRef({}); // posición real de cada vaso (por id), compartida con la pelota

  useFrame((_, dt) => {
    if (shakeKey !== prevShake.current) { shake.current = 1; prevShake.current = shakeKey; }
    if (!root.current) return;
    if (shake.current > 0.001) {
      shake.current = damp(shake.current, 0, 6, dt);
      const a = shake.current * 0.18;
      root.current.position.x = (Math.random() - 0.5) * a;
      root.current.position.y = (Math.random() - 0.5) * a;
    } else {
      root.current.position.set(0, 0, 0);
    }
  });

  return (
    <>
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 12, 22]} />

      <ambientLight intensity={0.55} />
      {/* Las sombras de contacto las da <ContactShadows/>; la direccional solo ilumina
          (sin shadow map propio) para ahorrar un pase de render en móvil. */}
      <directionalLight position={[4, 9, 5]} intensity={1.5} />
      <pointLight position={[-4, 5, 2]} intensity={35} color={C.accent} distance={20} />
      <spotLight position={[0, 10, 0]} angle={0.5} penumbra={0.8} intensity={60} color="#ecfdf5" />

      <group ref={root}>
        <Table />
        {cups.map((cup) => (
          <Cup key={cup.id} id={cup.id} slot={cup.slot} arc={cup.arc} lifted={cup.lifted} wrong={cup.wrong} swapMs={swapMs} cupPos={cupPos} onPick={() => onPick(cup)} />
        ))}
        <Ball ballId={ballId} visible={showBall} cupPos={cupPos} />
        <GroundShadows />
      </group>

      <PerfGuard onSlow={onSlow} />
      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.3} intensity={0.9} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.7} />
        </EffectComposer>
      )}
    </>
  );
}

/* ───────────────────────── Lógica del juego ───────────────────────── */
function Play({ end }) {
  const [cups, setCups] = useState([
    { id: 0, slot: 0, arc: 1 }, { id: 1, slot: 1, arc: 1 }, { id: 2, slot: 2, arc: 1 },
  ]);
  const [phase, setPhase] = useState('reveal'); // reveal | shuffle | guess | result
  const [lifted, setLifted] = useState([]);      // ids de vasos levantados (revelar la pelota)
  const [level, setLevel] = useState(1);
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [swapMs, setSwapMs] = useState(280);
  const [postFx, setPostFx] = useState(true); // post-procesado (Bloom); se apaga solo si el móvil va lento

  const ballRef = useRef(rand(0, 2));            // id del vaso con la pelota (PERSISTE entre rondas)
  const levelRef = useRef(1);
  const phaseRef = useRef('reveal');
  const cupsRef = useRef(cups);
  cupsRef.current = cups;
  const timers = useRef([]);
  const endRef = useRef(end);
  endRef.current = end;

  const setPh = (p) => { phaseRef.current = p; setPhase(p); };
  const after = (ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id); };

  // Intercambio normal de dos huecos (la pelota viaja DENTRO de su vaso)
  const normalSwap = () => {
    setCups(prev => {
      const nx = prev.map(c => ({ ...c }));
      const a = rand(0, 2); let b = rand(0, 2); if (b === a) b = (b + 1) % 3;
      const ca = nx.find(c => c.slot === a), cb = nx.find(c => c.slot === b);
      const t = ca.slot; ca.slot = cb.slot; cb.slot = t;
      if (ca.slot > cb.slot) { ca.arc = 1; cb.arc = -1; } else { ca.arc = -1; cb.arc = 1; }
      return nx;
    });
  };

  const doShuffle = (lvl) => {
    setPh('shuffle');
    const swaps = swapsFor(lvl);
    const baseDelay = delayFor(lvl);
    setSwapMs(clamp(Math.round(baseDelay * 0.8), 160, 600));

    let i = 0;
    const step = () => {
      if (i >= swaps) { setPh('guess'); return; }
      normalSwap();
      i++;
      after(baseDelay, step);
    };
    step();
  };

  // La pelota NO se reasigna entre rondas: se queda en su vaso.
  const startRound = (lvl) => {
    setWrong(false); setPicked(null);
    setLifted([ballRef.current]);   // enseña la pelota levantando SU vaso
    setPh('reveal');
    const revealMs = lvl === 1 ? 1900 : 1150; // la primera ronda da más tiempo para situarse
    after(revealMs, () => {
      setLifted([]);                // tapa la pelota
      after(520, () => doShuffle(lvl));
    });
  };

  useEffect(() => {
    // Margen para que el lienzo 3D termine de montar antes de enseñar la pelota
    const id = setTimeout(() => startRound(1), 550);
    timers.current.push(id);
    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      document.body.style.cursor = 'auto'; // evita que el cursor quede en "pointer" al salir
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (cup) => {
    if (phaseRef.current !== 'guess') return;
    setPh('result');
    setPicked(cup.id);
    setLifted([cup.id]);
    const ok = cup.id === ballRef.current;
    if (ok) {
      after(1100, () => {
        const nl = levelRef.current + 1; levelRef.current = nl; setLevel(nl);
        startRound(nl);             // misma pelota, mismo vaso
      });
    } else {
      setWrong(true);
      setShakeKey(k => k + 1);      // temblor de cámara
      after(750, () => setLifted([cup.id, ballRef.current])); // muestra dónde estaba
      after(1600, () => endRef.current(clamp((levelRef.current - 1) * 120, 0, 2000)));
    }
  };

  // Estado visual de cada vaso para la escena
  const sceneCups = cups.map(c => ({
    id: c.id, slot: c.slot, arc: c.arc ?? 1,
    lifted: lifted.includes(c.id),
    wrong: wrong && picked === c.id,
  }));
  const ballId = ballRef.current;
  const showBall = lifted.includes(ballId);

  const hint = phase === 'reveal' ? '👀 ¡Mira dónde está la pelota!'
    : phase === 'shuffle' ? '🔀 Sigue la pelota…'
    : phase === 'guess' ? '👆 ¿Bajo qué vaso está?'
    : (wrong ? '❌ ¡Ahí no estaba!' : '✅ ¡La tenías!');

  return (
    <div className="flex-1 flex flex-col items-center px-4 pb-6 select-none">
      <div className="flex items-center gap-3 mb-2">
        <span className="hud-chip text-emerald-300 font-black px-4 py-1.5 rounded-full text-sm">Nivel {level}</span>
        <span className="hud-chip text-white font-black px-4 py-1.5 rounded-full text-sm">{swapsFor(level)} mezclas</span>
      </div>
      <p className={`font-bold uppercase tracking-widest text-xs mb-1 h-5 ${phase === 'guess' ? 'text-emerald-300 animate-pulse' : 'text-white/70'}`}>{hint}</p>

      {/* Lienzo 3D */}
      <div className="relative w-full flex-1" style={{ minHeight: 340 }}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 6.2, 6.4], fov: 42 }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <Scene cups={sceneCups} ballId={ballId} showBall={showBall} shakeKey={shakeKey} swapMs={swapMs} postFx={postFx} onSlow={() => setPostFx(false)} onPick={pick} />
          </Suspense>
        </Canvas>
      </div>

      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-1 text-center px-6">Empieza fácil y acelera · acierta para subir de nivel · un fallo y eliminado</p>
    </div>
  );
}

export function TrileroGame(props) {
  return (
    <GameShell
      {...props}
      day={19} title="Trilero" emoji="🥤" accent="emerald"
      instructions={[
        <span key="1">Te enseñamos <strong>bajo qué vaso</strong> está la pelota.</span>,
        <span key="2">Los vasos se <strong>mezclan</strong>. ¡No la pierdas de vista!</span>,
        <span key="3">Empieza fácil y cada nivel va <strong>más rápido y con más mezclas</strong>. Un fallo y fin.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
