import React, { useState, useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GameShell, clamp, shuffle, ScoreBurst } from './GameShell';

const EMOJIS = ['🍎', '🥖', '🧀', '🍖', '🍫', '🧃', '🥚', '🍌'];

// Layout de la rejilla 4×4
const CW = 1.1, CH = 1.45, CT = 0.16;
const GX = CW + 0.26, GY = CH + 0.24;

const damp = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));

// Textura de la cara frontal: producto sobre fondo crema.
function makeFront(emoji) {
  const c = document.createElement('canvas'); c.width = 200; c.height = 264;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 264);
  g.addColorStop(0, '#fffdf8'); g.addColorStop(1, '#f0e6d8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 200, 264);
  ctx.font = '150px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 100, 142);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}
// Textura del reverso: rosa con un rombo.
function makeBack() {
  const c = document.createElement('canvas'); c.width = 200; c.height = 264;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 264);
  g.addColorStop(0, '#ec4899'); g.addColorStop(1, '#9d174d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 200, 264);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(100, 58); ctx.lineTo(152, 132); ctx.lineTo(100, 206); ctx.lineTo(48, 132); ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}

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

function Card({ card, position, faceUp, matched, onTap, frontTex, backTex, edgeMat }) {
  const ref = useRef();
  const front = useMemo(() => new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.55, metalness: 0.05, emissive: new THREE.Color('#10b981'), emissiveIntensity: 0 }), [frontTex]);
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5, metalness: 0.15 }), [backTex]);
  const mats = useMemo(() => [edgeMat, edgeMat, edgeMat, edgeMat, front, back], [edgeMat, front, back]);

  useFrame((_, dt) => {
    const m = ref.current; if (!m) return;
    m.rotation.y = damp(m.rotation.y, faceUp ? 0 : Math.PI, 12, dt);
    m.position.z = damp(m.position.z, matched ? 0.55 : 0, 10, dt);
    front.emissiveIntensity = damp(front.emissiveIntensity, matched ? 0.45 : 0, 8, dt);
  });

  return (
    <mesh ref={ref} position={position} material={mats} onPointerDown={(e) => { e.stopPropagation(); onTap(card); }}>
      <boxGeometry args={[CW, CH, CT]} />
    </mesh>
  );
}

function ParejasScene({ cards, flipped, matched, onTap, postFx, onSlow }) {
  const fronts = useMemo(() => { const m = {}; EMOJIS.forEach(e => { m[e] = makeFront(e); }); return m; }, []);
  const back = useMemo(() => makeBack(), []);
  const edgeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9d174d', roughness: 0.5, metalness: 0.3 }), []);

  // Liberar texturas/materiales al desmontar
  useEffect(() => () => {
    Object.values(fronts).forEach(t => t.dispose());
    back.dispose(); edgeMat.dispose();
  }, [fronts, back, edgeMat]);

  return (
    <>
      <color attach="background" args={['#1a0511']} />
      <fog attach="fog" args={['#1a0511', 12, 24]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 6]} intensity={1.3} />
      <pointLight position={[-3, 2, 4]} intensity={16} color="#f472b6" distance={20} />
      <PerfGuard onSlow={onSlow} />

      {cards.map((card, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const x = (col - 1.5) * GX;
        const y = (1.5 - row) * GY;
        const up = flipped.includes(card.id) || matched.includes(card.id);
        return (
          <Card key={card.id} card={card} position={[x, y, 0]} faceUp={up} matched={matched.includes(card.id)}
            onTap={onTap} frontTex={fronts[card.emoji]} backTex={back} edgeMat={edgeMat} />
        );
      })}

      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.3} intensity={0.6} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

function Play({ end }) {
  const [cards] = useState(() => shuffle([...EMOJIS, ...EMOJIS].map((e, i) => ({ id: i, emoji: e }))));
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [postFx, setPostFx] = useState(true);
  const startRef = useRef(Date.now());
  const lockRef = useRef(false);

  const tap = (card) => {
    if (lockRef.current || flipped.includes(card.id) || matched.includes(card.id)) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length === 2) {
      lockRef.current = true;
      setMoves(m => m + 1);
      const [a, b] = next.map(id => cards.find(c => c.id === id));
      if (a.emoji === b.emoji) {
        setTimeout(() => {
          const newMatched = [...matched, a.id, b.id];
          setMatched(newMatched);
          setFlipped([]);
          lockRef.current = false;
          if (newMatched.length === cards.length) {
            const sec = (Date.now() - startRef.current) / 1000;
            end(clamp(Math.round(1000 - sec * 12 - Math.max(0, moves + 1 - 10) * 15), 50, 1000));
          }
        }, 520);
      } else {
        setTimeout(() => { setFlipped([]); lockRef.current = false; }, 850);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-5 pb-6 select-none">
      <ScoreBurst value={matched.length} color="#f9a8d4" />
      <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-1">Movimientos: {moves}</p>

      <div className="relative w-full flex-1" style={{ minHeight: 360 }}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, -0.6, 9.2], fov: 44 }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
        >
          <Suspense fallback={null}>
            <ParejasScene cards={cards} flipped={flipped} matched={matched} onTap={tap} postFx={postFx} onSlow={() => setPostFx(false)} />
          </Suspense>
        </Canvas>
      </div>

      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mt-1 text-center px-6">Levanta 2 cartas por turno · encuentra las 8 parejas</p>
    </div>
  );
}

export function ParejasGame(props) {
  return (
    <GameShell
      {...props}
      day={7} title="Parejas" emoji="🃏" accent="pink"
      instructions={[
        <span key="1">Hay <strong>8 parejas de productos</strong> boca abajo.</span>,
        <span key="2">Levanta 2 cartas por turno y <strong>encuentra todas las parejas</strong>.</span>,
        <span key="3">Cuanto más rápido y con menos movimientos, más puntos.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
