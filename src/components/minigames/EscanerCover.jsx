import React from 'react';

// Portada de "Escáner" (SVG, sin dependencias 3D).
// Panel de escáner con código de barras verde y haz láser rojo cruzándolo.

export function EscanerCover({ className = '', style }) {
  const bars = Array.from({ length: 7 }, (_, i) => ({ x: 77 + i * 6.6, w: i % 2 ? 1.6 : 3.2 }));
  return (
    <svg viewBox="0 0 260 200" className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Escáner con código de barras y un haz láser rojo cruzándolo">
      <defs>
        <radialGradient id="es-amb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="es-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="es-laser" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9f1239" />
          <stop offset="50%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
        <filter id="es-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="es-rglow" x="-120%" y="-60%" width="340%" height="220%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="es-gglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5" /></filter>
      </defs>

      {/* luz ambiental */}
      <ellipse cx="130" cy="100" rx="128" ry="78" fill="url(#es-amb)" />
      {/* sombra del panel */}
      <ellipse cx="130" cy="150" rx="96" ry="16" fill="#000" opacity="0.34" filter="url(#es-soft)" />

      {/* panel del escáner */}
      <rect x="30" y="64" width="200" height="76" rx="16" fill="url(#es-panel)" stroke="#0e7490" strokeWidth="2" />
      <rect x="34" y="68" width="192" height="10" rx="6" fill="#ffffff" opacity="0.06" />

      {/* código de barras (zona objetivo) */}
      <g filter="url(#es-gglow)">
        <rect x="70" y="80" width="56" height="44" rx="4" fill="#052e23" opacity="0.75" stroke="#34d399" strokeWidth="2" />
      </g>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="86" width={b.w} height="32" fill="#e2f5ee" rx="0.6" />
      ))}

      {/* haz láser rojo */}
      <rect x="92" y="58" width="14" height="88" fill="#f43f5e" opacity="0.55" filter="url(#es-rglow)" />
      <rect x="97" y="60" width="4" height="84" rx="2" fill="url(#es-laser)" />
      <rect x="98.4" y="60" width="1.2" height="84" fill="#fff5f5" opacity="0.7" />
      <circle cx="99" cy="60" r="4" fill="#fb7185" />
      <circle cx="99" cy="60" r="7" fill="#f43f5e" opacity="0.5" filter="url(#es-rglow)" />

      {/* destello de "leído correctamente" */}
      <g transform="translate(150,96)">
        <circle r="11" fill="#10b981" opacity="0.9" />
        <path d="M -5,0 L -1.5,4 L 5.5,-4" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
