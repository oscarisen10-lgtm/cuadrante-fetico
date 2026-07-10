import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GameShell, clamp, rand, ScoreBurst } from './GameShell';

const DURATION = 60;
const FRUITS = ['🍎', '🍊', '🍋', '🍉', '🍓', '🥝', '🍇', '🍌', '🥥', '🍅', '🫐'];
const JUICE = { '🍎': '#ef4444', '🍊': '#f97316', '🍋': '#facc15', '🍉': '#fb7185', '🍓': '#f43f5e', '🥝': '#84cc16', '🍇': '#a855f7', '🍌': '#fde047', '🥥': '#e7e5e4', '🍅': '#ef4444', '🫐': '#6366f1' };

// Área de juego en el mundo 3D (mapeo desde % de pantalla)
const VW = 4.4, VH = 7.0;
const toWX = (x) => (x / 100 - 0.5) * VW;
const toWY = (y) => (0.5 - y / 100) * VH;
const damp = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));

function makeTex(emoji) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '104px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 72);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
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

// Fruta voladora (plano con el emoji). Lee su posición de itemsRef por id.
function Fruit({ data, itemsRef, tex }) {
  const ref = useRef();
  useFrame(() => {
    const it = itemsRef.current.find(i => i.id === data.id);
    const m = ref.current; if (!m || !it) return;
    m.position.set(toWX(it.x), toWY(it.y), 0);
    m.rotation.z = it.rot;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.1} />
    </mesh>
  );
}

// Estallido de gajos al cortar
function Burst({ data, onDone }) {
  const grp = useRef();
  const parts = useMemo(() => Array.from({ length: 12 }, () => {
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1, vr: (Math.random() - 0.5) * 8, p: [0, 0, 0], r: 0, s: 0.12 + Math.random() * 0.12 };
  }), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    parts.forEach(pt => { pt.vy -= 9 * dt; pt.p[0] += pt.vx * dt; pt.p[1] += pt.vy * dt; pt.r += pt.vr * dt; });
    if (grp.current) grp.current.children.forEach((m, i) => { const pt = parts[i]; m.position.set(pt.p[0], pt.p[1], pt.p[2]); m.rotation.z = pt.r; m.material.opacity = Math.max(0, 1 - t.current * 1.4); });
    if (t.current > 0.8) onDone(data.id);
  });
  return (
    <group ref={grp} position={[toWX(data.x), toWY(data.y), 0.1]}>
      {parts.map((pt, i) => (
        <mesh key={i}>
          <planeGeometry args={[pt.s, pt.s]} />
          <meshBasicMaterial color={data.color} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

// Estela de la cuchilla (sigue al dedo)
function Blade({ bladeRef }) {
  const line = useRef();
  const hist = useRef(Array.from({ length: 14 }, () => new THREE.Vector3(0, -100, 0)));
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(hist.current), []);
  useFrame(() => {
    const b = bladeRef.current;
    const h = hist.current;
    for (let i = h.length - 1; i > 0; i--) h[i].copy(h[i - 1]);
    if (b.down) h[0].set(toWX(b.x), toWY(b.y), 0.3);
    else h[0].set(h[1].x, h[1].y, 0.3);
    geo.setFromPoints(h);
    if (line.current) line.current.material.opacity = b.down ? 0.9 : 0;
  });
  return <line ref={line} geometry={geo}><lineBasicMaterial color="#d9f99d" transparent opacity={0} linewidth={2} /></line>;
}

function Scene({ itemsRef, items, bladeRef, bursts, removeBurst, texMap, postFx, onSlow }) {
  return (
    <>
      <color attach="background" args={['#0a1505']} />
      <fog attach="fog" args={['#0a1505', 9, 18]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 6]} intensity={1} />
      <pointLight position={[0, 0, 5]} intensity={12} color="#a3e635" distance={16} />
      <PerfGuard onSlow={onSlow} />
      {items.map(it => <Fruit key={it.id} data={it} itemsRef={itemsRef} tex={texMap[it.emoji]} />)}
      {bursts.map(b => <Burst key={b.id} data={b} onDone={removeBurst} />)}
      <Blade bladeRef={bladeRef} />
      {postFx && (
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.3} intensity={0.7} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

function Play({ end }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [items, setItems] = useState([]);   // {id, emoji, bomb} de los items vivos (para montar billboards)
  const [bursts, setBursts] = useState([]);
  const [postFx, setPostFx] = useState(true);

  const arenaRef = useRef(null);
  const itemsRef = useRef([]);
  const bladeRef = useRef({ x: 0, y: 0, lx: 0, ly: 0, down: false });
  const scoreRef = useRef(0);
  const idRef = useRef(0);
  const burstId = useRef(0);
  const stRef = useRef({ t: 0, nextSpawn: 0, alive: true });
  const idsRef = useRef('');
  const endRef = useRef(end);
  endRef.current = end;

  const texMap = useMemo(() => { const m = {}; FRUITS.forEach(e => { m[e] = makeTex(e); }); m['💣'] = makeTex('💣'); return m; }, []);
  useEffect(() => () => { Object.values(texMap).forEach(t => t.dispose()); }, [texMap]);

  const finish = () => { stRef.current.alive = false; endRef.current(clamp(scoreRef.current, 0, 2500)); };

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(id); finish(); return 0; } return t - 1; }), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Física + spawn + corte
  useEffect(() => {
    let raf, last = performance.now();
    const syncItems = () => {
      const ids = itemsRef.current.map(i => i.id).join(',');
      if (ids !== idsRef.current) { idsRef.current = ids; setItems(itemsRef.current.map(i => ({ id: i.id, emoji: i.emoji, bomb: i.bomb }))); }
    };
    const loop = (now) => {
      if (!stRef.current.alive) return;
      const dt = Math.min(40, now - last); last = now;
      const st = stRef.current; st.t += dt;

      if (st.t > st.nextSpawn) {
        const bomb = Math.random() < Math.min(0.12 + st.t / 320000, 0.26);
        const x = rand(15, 85);
        itemsRef.current.push({
          id: idRef.current++, x, y: 106,
          vx: (50 - x) * 0.0011 + (Math.random() - 0.5) * 0.018,
          vy: -(0.112 + Math.random() * 0.016),
          rot: 0, vrot: (Math.random() - 0.5) * 0.006,
          bomb, emoji: bomb ? '💣' : FRUITS[rand(0, FRUITS.length - 1)], sliced: false,
        });
        st.nextSpawn = st.t + Math.max(360, 820 - st.t / 110);
      }

      for (const it of itemsRef.current) { it.vy += 0.00008 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vrot * dt; }

      const b = bladeRef.current;
      if (b.down) {
        const speed = Math.abs(b.x - b.lx) + Math.abs(b.y - b.ly);
        if (speed > 0.8) {
          for (const it of itemsRef.current) {
            if (it.sliced) continue;
            if (Math.abs(it.x - b.x) < 11 && Math.abs(it.y - b.y) < 11) {
              it.sliced = true;
              if (it.bomb) { setBursts(p => [...p, { id: burstId.current++, x: it.x, y: it.y, color: '#f87171' }]); finish(); return; }
              scoreRef.current += 15; setScore(scoreRef.current);
              setBursts(p => [...p, { id: burstId.current++, x: it.x, y: it.y, color: JUICE[it.emoji] || '#a3e635' }]);
            }
          }
        }
        b.lx = b.x; b.ly = b.y;
      }

      itemsRef.current = itemsRef.current.filter(it => it.y < 122 && !it.sliced);
      syncItems();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeBurst = (id) => setBursts(p => p.filter(b => b.id !== id));

  const toPct = (cx, cy) => { const r = arenaRef.current.getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 }; };
  const onDown = (e) => { const p = toPct(e.clientX, e.clientY); bladeRef.current = { x: p.x, y: p.y, lx: p.x, ly: p.y, down: true }; };
  const onMove = (e) => { if (!bladeRef.current.down) return; const p = toPct(e.clientX, e.clientY); bladeRef.current.x = p.x; bladeRef.current.y = p.y; };
  const onUp = () => { bladeRef.current.down = false; };

  return (
    <div className="flex-1 flex flex-col px-5 pb-5 select-none">
      <div className="flex items-center justify-center gap-3 mb-2 mt-1">
        <span className={`hud-chip font-black px-4 py-1.5 rounded-full text-sm ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>⏱ {timeLeft}s</span>
        <span className="hud-chip text-lime-400 font-black px-4 py-1.5 rounded-full text-sm">🔪 {score}</span>
        <ScoreBurst value={score} color="#a3e635" />
      </div>
      <div
        ref={arenaRef}
        className="flex-1 relative rounded-3xl overflow-hidden touch-none"
        style={{ minHeight: 340 }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      >
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 8.2], fov: 46 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
          <Suspense fallback={null}>
            <Scene itemsRef={itemsRef} items={items} bladeRef={bladeRef} bursts={bursts} removeBurst={removeBurst} texMap={texMap} postFx={postFx} onSlow={() => setPostFx(false)} />
          </Suspense>
        </Canvas>
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/30 text-[10px] font-bold uppercase tracking-wide pointer-events-none">Desliza para cortar · ¡no cortes las 💣!</p>
      </div>
    </div>
  );
}

export function CortaGame(props) {
  return (
    <GameShell
      {...props}
      day={16} title="Corta" emoji="🔪" accent="lime"
      instructions={[
        <span key="1">Los productos salen volando por el aire en arcos.</span>,
        <span key="2"><strong>Desliza el dedo</strong> para cortarlos al vuelo (15 puntos cada uno).</span>,
        <span key="3">¡Cuidado con las <strong>bombas 💣</strong>! Si cortas una, fin de la partida. Tienes 60 s.</span>,
      ]}
    >
      {({ end }) => <Play end={end} />}
    </GameShell>
  );
}
