import React from 'react';

// Portada de "Simón Dice" (SVG, sin dependencias 3D).
// Disco de 4 cuadrantes de color en perspectiva, con dos de ellos "encendidos"
// (glow) para sugerir la secuencia, botón central y grosor 3D.

const CX = 130, CY = 100;
const RX = 92, RY = 46, RIX = 34, RIY = 17;
const G = 0.13; // separación entre cuadrantes

const px = (r, a, ry) => [CX + r * Math.cos(a), CY + ry * Math.sin(a)];
function sector(a0, a1) {
  const [e0x, e0y] = px(RX, a0, RY);
  const [e1x, e1y] = px(RX, a1, RY);
  const [i1x, i1y] = px(RIX, a1, RIY);
  const [i0x, i0y] = px(RIX, a0, RIY);
  return `M ${e0x.toFixed(1)},${e0y.toFixed(1)} A ${RX} ${RY} 0 0 1 ${e1x.toFixed(1)},${e1y.toFixed(1)} L ${i1x.toFixed(1)},${i1y.toFixed(1)} A ${RIX} ${RIY} 0 0 0 ${i0x.toFixed(1)},${i0y.toFixed(1)} Z`;
}

const P = Math.PI;
const QUADS = [
  { a0: P * 1.25 + G, a1: P * 1.75 - G, color: '#10b981', dark: '#065f46', lit: true },  // arriba: verde
  { a0: P * 1.75 + G, a1: P * 2.25 - G, color: '#0ea5e9', dark: '#0a4a6b', lit: false }, // derecha: azul
  { a0: P * 0.25 + G, a1: P * 0.75 - G, color: '#f59e0b', dark: '#92400e', lit: true },  // abajo: ámbar
  { a0: P * 0.75 + G, a1: P * 1.25 - G, color: '#f43f5e', dark: '#9f1239', lit: false }, // izquierda: rojo
];

export function SimonCover({ className = '', style }) {
  return (
    <svg viewBox="0 0 260 200" className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Disco de Simón Dice con cuadrantes de colores, dos iluminados">
      <defs>
        <radialGradient id="sc-amb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <filter id="sc-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id="sc-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      {/* luz ambiental */}
      <ellipse cx={CX} cy={CY} rx="120" ry="70" fill="url(#sc-amb)" />
      {/* sombra de contacto */}
      <ellipse cx={CX} cy={CY + 30} rx="86" ry="20" fill="#000" opacity="0.32" filter="url(#sc-soft)" />

      {/* grosor 3D (lateral del disco) */}
      <ellipse cx={CX} cy={CY + 9} rx={RX} ry={RY} fill="#1a0f33" />

      {/* halo de los cuadrantes encendidos */}
      {QUADS.filter(q => q.lit).map((q, i) => (
        <path key={`glow${i}`} d={sector(q.a0, q.a1)} fill={q.color} opacity="0.6" filter="url(#sc-glow)" />
      ))}

      {/* cuadrantes */}
      {QUADS.map((q, i) => (
        <g key={i}>
          <path d={sector(q.a0, q.a1)} fill={q.lit ? q.color : q.dark} stroke={q.lit ? '#ffffff' : 'rgba(255,255,255,0.12)'} strokeOpacity={q.lit ? 0.35 : 1} strokeWidth="1.2" />
        </g>
      ))}

      {/* botón central */}
      <ellipse cx={CX} cy={CY + 4} rx={RIX - 3} ry={RIY - 2} fill="#0a0518" />
      <ellipse cx={CX} cy={CY} rx={RIX - 5} ry={RIY - 3.5} fill="#2a1a45" stroke="#7c3aed" strokeWidth="1.4" strokeOpacity="0.5" />
      <ellipse cx={CX - 6} cy={CY - 3} rx="6" ry="3" fill="#a78bfa" opacity="0.4" />
    </svg>
  );
}
