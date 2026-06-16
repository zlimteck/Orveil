import React from 'react';

export default function Sparkline({ points = [], color = '#c9d7f8', height = 28 }) {
  const values = points.map(p => p.value).filter(v => v != null);
  if (values.length < 2) return null;

  const W = 100, H = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const valid = points.filter(p => p.value != null);
  const coords = valid.map((p, i) => {
    const x = (i / (valid.length - 1)) * W;
    const y = H - 2 - ((p.value - min) / range) * (H - 6);
    return [x, y];
  });

  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${coords[0][0]},${H} ` + line + ` ${coords[coords.length - 1][0]},${H}`;

  // Color error points
  const hasError = points.some(p => p.status === 'error' || p.status === 'offline');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={line} fill="none" stroke={hasError ? '#f87171' : color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
