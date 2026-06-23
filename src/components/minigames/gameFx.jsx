import React, { useState, useCallback, useRef, useEffect } from 'react';

// Paletas por juego — fondo en degradado profundo + 3 orbes de luz.
const THEMES = {
  violet:  { bg: 'radial-gradient(circle at 50% -10%, #2b1764 0%, #160a32 55%, #0b0520 100%)', orbs: ['#7c3aed', '#4f46e5', '#a855f7'] },
  emerald: { bg: 'radial-gradient(circle at 50% -10%, #064e3b 0%, #052e23 55%, #021410 100%)', orbs: ['#10b981', '#059669', '#34d399'] },
  red:     { bg: 'radial-gradient(circle at 50% -10%, #4c0d1a 0%, #2a0810 55%, #160407 100%)', orbs: ['#ef4444', '#f97316', '#fb7185'] },
  fuchsia: { bg: 'radial-gradient(circle at 50% -10%, #4a044e 0%, #2a0533 55%, #14021a 100%)', orbs: ['#d946ef', '#a21caf', '#e879f9'] },
  slate:   { bg: 'radial-gradient(circle at 50% -10%, #1e293b 0%, #0f172a 55%, #060a14 100%)', orbs: ['#38bdf8', '#0ea5e9', '#22d3ee'] },
  amber:   { bg: 'radial-gradient(circle at 50% -10%, #4a2c05 0%, #2a1903 55%, #160d02 100%)', orbs: ['#f59e0b', '#f97316', '#fbbf24'] },
  cyan:    { bg: 'radial-gradient(circle at 50% -10%, #083344 0%, #062330 55%, #03141c 100%)', orbs: ['#22d3ee', '#06b6d4', '#67e8f9'] },
  pink:    { bg: 'radial-gradient(circle at 50% -10%, #500724 0%, #2e0518 55%, #18020d 100%)', orbs: ['#ec4899', '#db2777', '#f472b6'] },
  lime:    { bg: 'radial-gradient(circle at 50% -10%, #1a2e05 0%, #0f1c03 55%, #080f02 100%)', orbs: ['#84cc16', '#65a30d', '#a3e635'] },
  blue:    { bg: 'radial-gradient(circle at 50% -10%, #0c1f4a 0%, #08142e 55%, #040a18 100%)', orbs: ['#3b82f6', '#2563eb', '#60a5fa'] },
  orange:  { bg: 'radial-gradient(circle at 50% -10%, #4a1f05 0%, #2a1203 55%, #160902 100%)', orbs: ['#f97316', '#ea580c', '#fb923c'] },
};

/**
 * Fondo animado premium para los minijuegos: degradado profundo, orbes de luz
 * flotantes, rejilla sutil con máscara, scanlines y viñeta. Se coloca como primera
 * capa (absolute inset-0) y el contenido del juego va por encima con z-10.
 */
export function GameBackground({ theme = 'violet', grid = true }) {
  const t = THEMES[theme] || THEMES.violet;
  const glow = (color) => `radial-gradient(circle, ${color} 0%, transparent 70%)`;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" style={{ background: t.bg }}>
      <div className="gfx-orb" style={{ background: glow(t.orbs[0]), top: '-16%', left: '-20%' }} />
      <div className="gfx-orb" style={{ background: glow(t.orbs[1]), bottom: '-20%', right: '-16%', width: 480, height: 480, opacity: 0.42, animationDelay: '-7s' }} />
      {grid && <div className="absolute inset-0 gfx-grid" />}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 38%, transparent 45%, rgba(0,0,0,0.6) 100%)' }} />
    </div>
  );
}

/**
 * Estilos "premium" reutilizables. Baratos para la GPU: solo degradados + sombras
 * (sin filter:blur ni mix-blend-mode), así que no afectan a la fluidez.
 */
export const fx = {
  // Ficha/botón rectangular con relieve y brillo interior.
  tile: (a, b, glow = 'rgba(0,0,0,0.4)') => ({
    background: `linear-gradient(160deg, ${a}, ${b})`,
    boxShadow: `0 6px 16px ${glow}, inset 0 2px 5px rgba(255,255,255,0.42)`,
  }),
  // Botón/orbe redondo glossy.
  orb: (a, b, glow = 'rgba(0,0,0,0.4)') => ({
    background: `radial-gradient(circle at 38% 28%, ${a}, ${b})`,
    boxShadow: `0 0 26px ${glow}, inset 0 2px 6px rgba(255,255,255,0.5), inset 0 -6px 12px rgba(0,0,0,0.25)`,
  }),
  // Panel/tarjeta oscura tipo cristal.
  panel: {
    background: 'linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

/**
 * Estallido de partículas para feedback "jugoso" (al puntuar/acertar).
 * Devuelve [layer, fire] — pinta <Particles/> y llama fire(xPct, yPct, color).
 */
export function useParticles() {
  const [bursts, setBursts] = useState([]);
  const fire = useCallback((x, y, color = '#fff') => {
    const id = Date.now() + Math.random();
    setBursts(b => [...b, { id, x, y, color }]);
    setTimeout(() => setBursts(b => b.filter(p => p.id !== id)), 650);
  }, []);

  const layer = (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {bursts.map(b => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {Array.from({ length: 10 }, (_, i) => {
            const ang = (i / 10) * Math.PI * 2;
            const dist = 36 + Math.random() * 28;
            return (
              <span
                key={i}
                className="gfx-spark absolute block w-2 h-2 rounded-full"
                style={{
                  background: b.color,
                  boxShadow: `0 0 8px ${b.color}`,
                  '--dx': `${Math.cos(ang) * dist}px`,
                  '--dy': `${Math.sin(ang) * dist}px`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );

  return [layer, fire];
}

/**
 * ScoreBurst — feedback de "juice" autónomo: dispara una ráfaga de partículas
 * cada vez que `value` SUBE. Se coloca una sola vez en el JSX del juego
 * (<ScoreBurst value={score} />) sin tocar la lógica de puntuación.
 * x/y en % del área de juego (por defecto, arriba-centro, cerca del HUD).
 */
export function ScoreBurst({ value, x = 50, y = 13, color = '#fde68a' }) {
  const [layer, fire] = useParticles();
  const prev = useRef(value);
  useEffect(() => {
    if (typeof value === 'number' && value > prev.current) fire(x, y, color);
    prev.current = value;
  }, [value, x, y, color, fire]);
  return layer;
}
