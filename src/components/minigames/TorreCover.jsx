import React from 'react';

// Portada del juego "Torre de Bloques" (SVG isométrico, sin dependencias 3D).
// Reproduce el look del juego: cajas apiladas con volumen, gama verde→azul→púrpura
// y un bloque deslizándose arriba antes de soltarse.

const HW = 38;          // medio ancho de la caja (eje horizontal)
const TH = 16;          // factor isométrico del rombo superior
const BHX = 19;         // altura visible de la cara frontal

// Una caja isométrica (cara superior + dos caras laterales) centrada en cx.
function IsoBox({ cx, topY, hue, glow }) {
  const top = `M ${cx},${topY - TH} L ${cx + HW},${topY} L ${cx},${topY + TH} L ${cx - HW},${topY} Z`;
  const left = `M ${cx - HW},${topY} L ${cx},${topY + TH} L ${cx},${topY + TH + BHX} L ${cx - HW},${topY + BHX} Z`;
  const right = `M ${cx},${topY + TH} L ${cx + HW},${topY} L ${cx + HW},${topY + BHX} L ${cx},${topY + TH + BHX} Z`;
  return (
    <g filter={glow ? 'url(#tb-glow)' : undefined}>
      <path d={right} fill={`hsl(${hue},48%,38%)`} />
      <path d={left} fill={`hsl(${hue},55%,52%)`} />
      <path d={top} fill={`hsl(${hue},64%,66%)`} />
      {/* brillo del borde superior */}
      <path d={`M ${cx - HW},${topY} L ${cx},${topY - TH} L ${cx + HW},${topY}`} fill="none" stroke={`hsl(${hue},90%,80%)`} strokeWidth="1.2" opacity="0.55" strokeLinejoin="round" />
    </g>
  );
}

export function TorreCover({ className = '', style }) {
  const serp = [0, 8, -5, 6, -7, 3];          // leve serpenteo de la torre
  const baseTopY = 150;
  const boxes = serp.map((dx, i) => ({
    cx: 130 + dx,
    topY: baseTopY - i * BHX,
    hue: 150 + i * 16,
  }));
  return (
    <svg viewBox="0 0 260 200" className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Torre de bloques de colores apilados con un bloque deslizándose arriba">
      <defs>
        <radialGradient id="tb-floor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <filter id="tb-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="tb-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>

      {/* luz ambiental */}
      <ellipse cx="130" cy="120" rx="120" ry="80" fill="url(#tb-floor)" />
      {/* sombra de contacto en la base */}
      <ellipse cx="130" cy="178" rx="64" ry="12" fill="#000" opacity="0.34" filter="url(#tb-soft)" />

      {/* torre (de abajo a arriba) */}
      {boxes.map((b, i) => <IsoBox key={i} cx={b.cx} topY={b.topY} hue={b.hue} />)}

      {/* bloque activo deslizándose hacia su sitio */}
      <g opacity="0.96">
        <IsoBox cx={130 + 42} topY={baseTopY - 6 * BHX} hue={246} glow />
        {/* pequeña estela de movimiento */}
        <path d={`M ${130 + 42 - HW - 14},${baseTopY - 6 * BHX + 4} L ${130 + 42 - HW - 4},${baseTopY - 6 * BHX + 4}`} stroke="#e9d5ff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <path d={`M ${130 + 42 - HW - 22},${baseTopY - 6 * BHX + 11} L ${130 + 42 - HW - 8},${baseTopY - 6 * BHX + 11}`} stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      </g>
    </svg>
  );
}
