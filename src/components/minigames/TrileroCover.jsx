import React from 'react';

// Portada/ilustración del Trilero (SVG escalable, sin dependencias 3D).
// Reproduce el look del juego: vasos verde esmeralda con volumen cilíndrico,
// pelota dorada con brillo y sombras de contacto. El vaso central va "levantado"
// mostrando la pelota debajo, contando de un vistazo de qué va el juego.

// Un cubilete (cono truncado) dado su centro X y la Y de la boca.
function CupShape({ cx, baseY }) {
  const topY = baseY - 74;
  return (
    <g>
      {/* cuerpo */}
      <path
        d={`M ${cx - 28},${baseY} L ${cx - 19},${topY} Q ${cx},${topY - 5} ${cx + 19},${topY} L ${cx + 28},${baseY} Q ${cx},${baseY + 7} ${cx - 28},${baseY} Z`}
        fill="url(#tc-body)"
      />
      {/* brillo lateral para volumen */}
      <path
        d={`M ${cx - 16},${topY + 4} L ${cx - 22},${baseY - 6} Q ${cx - 17},${baseY - 2} ${cx - 12},${baseY - 6} L ${cx - 9},${topY + 5} Q ${cx - 13},${topY + 1} ${cx - 16},${topY + 4} Z`}
        fill="#d1fae5" opacity="0.35"
      />
      {/* banda decorativa */}
      <path d={`M ${cx - 25},${baseY - 36} Q ${cx},${baseY - 31} ${cx + 25},${baseY - 36}`} stroke="url(#tc-band)" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* aro dorado de la boca (frente) */}
      <path d={`M ${cx - 28},${baseY} Q ${cx},${baseY + 7} ${cx + 28},${baseY}`} stroke="url(#tc-gold)" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      {/* tapa (base del cubilete) */}
      <ellipse cx={cx} cy={topY} rx="19" ry="4.5" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
    </g>
  );
}

export function TrileroCover({ className = '', style }) {
  const liftY = 132; // boca del vaso central (levantado)
  return (
    <svg viewBox="0 0 260 180" className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tres cubiletes verdes y una pelota dorada — el juego del Trilero">
      <defs>
        <linearGradient id="tc-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="18%" stopColor="#059669" />
          <stop offset="42%" stopColor="#34d399" />
          <stop offset="52%" stopColor="#6ee7b7" />
          <stop offset="63%" stopColor="#34d399" />
          <stop offset="85%" stopColor="#047857" />
          <stop offset="100%" stopColor="#053d2c" />
        </linearGradient>
        <linearGradient id="tc-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ecfdf5" />
          <stop offset="100%" stopColor="#a7f3d0" />
        </linearGradient>
        <linearGradient id="tc-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <radialGradient id="tc-ball" cx="0.36" cy="0.3" r="0.75">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="32%" stopColor="#fde68a" />
          <stop offset="62%" stopColor="#fbbf24" />
          <stop offset="85%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <radialGradient id="tc-floor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
        <filter id="tc-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="tc-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>

      {/* luz ambiental del suelo */}
      <ellipse cx="130" cy="150" rx="115" ry="30" fill="url(#tc-floor)" />

      {/* sombras de contacto */}
      <ellipse cx="70" cy="158" rx="30" ry="6.5" fill="#000" opacity="0.32" filter="url(#tc-soft)" />
      <ellipse cx="190" cy="158" rx="30" ry="6.5" fill="#000" opacity="0.32" filter="url(#tc-soft)" />
      <ellipse cx="130" cy="156" rx="20" ry="5" fill="#000" opacity="0.28" filter="url(#tc-soft)" />

      {/* vasos laterales (apoyados) */}
      <CupShape cx={70} baseY={158} />
      <CupShape cx={190} baseY={158} />

      {/* pelota dorada bajo el vaso central */}
      <ellipse cx="130" cy="153" rx="13" ry="4" fill="#000" opacity="0.3" filter="url(#tc-soft)" />
      <circle cx="130" cy="146" r="17" fill="#fcd34d" opacity="0.55" filter="url(#tc-glow)" />
      <circle cx="130" cy="146" r="11.5" fill="url(#tc-ball)" />
      <circle cx="126" cy="142" r="3.5" fill="#fffdf5" opacity="0.85" />

      {/* vaso central LEVANTADO mostrando la pelota */}
      <CupShape cx={130} baseY={liftY} />
    </svg>
  );
}
