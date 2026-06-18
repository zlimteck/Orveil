import React from 'react';

export default function Sparkline({ points = [], color = '#c9d7f8', height = 56, showLabels = false }) {
  const values = points.map(p => p.value).filter(v => v != null);
  if (values.length < 2) return null;

  const W = 300, H = height;
  const PAD_LEFT = showLabels ? 36 : 4;
  const PAD_RIGHT = 4;
  const PAD_TOP = 6;
  const PAD_BOTTOM = showLabels ? 18 : 4;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  // When all values are equal, build a scale from 0 to max (or 0 to 1 if max=0)
  // to avoid showing nonsensical negative labels
  const min = dataMax === dataMin ? 0 : dataMin;
  const max = dataMax === dataMin ? (dataMax > 0 ? dataMax * 1.5 : 1) : dataMax;
  const range = max - min || 1;

  // Index-based x positioning: data always fills the full width regardless of time gaps
  const valid = points.filter(p => p.value != null);
  const toX = vi => valid.length <= 1 ? 0 : (vi / (valid.length - 1)) * innerW;
  const toY = v => PAD_TOP + innerH - ((v - min) / range) * innerH;

  // Build segments: groups of consecutive valid points (null values create visual gaps)
  const segments = [];
  let current = [];
  let vi = 0;
  for (const p of points) {
    if (p.value != null) {
      current.push({ p, vi: vi++ });
    } else {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);

  const gradId = `sg-${color.replace('#', '')}-${height}`;

  const gridLines = 3;
  const yTicks = Array.from({ length: gridLines }, (_, i) => {
    const frac = i / (gridLines - 1);
    const val = max - frac * range;
    const y = PAD_TOP + frac * innerH;
    return { y, val };
  });

  const formatVal = v => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v % 1 === 0) return `${v}`;
    return v.toFixed(1);
  };

  const errorCoords = valid
    .map((p, vi) => ({ p, vi }))
    .filter(({ p }) => p.status === 'error' || p.status === 'offline' || p.status === 'warning')
    .map(({ p, vi }) => [toX(vi), toY(p.value), p.status]);

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Y-axis labels — outside SVG to avoid stretch */}
      {showLabels && (
        <div className="absolute top-0 bottom-0 left-0 flex flex-col justify-between py-1.5" style={{ width: PAD_LEFT - 4 }}>
          {yTicks.map(({ val }, i) => (
            <span key={i} className="block text-right leading-none" style={{ fontSize: 9, color: 'currentColor', opacity: 0.4 }}>
              {formatVal(val)}
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W - PAD_LEFT} ${H}`}
        className="absolute top-0 right-0"
        style={{ left: showLabels ? PAD_LEFT : 0, height, width: showLabels ? `calc(100% - ${PAD_LEFT}px)` : '100%' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line key={i} x1={0} y1={y} x2={innerW} y2={y}
            stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}

        {/* Area fill + line per segment (null values create visual breaks) */}
        {segments.map((seg, si) => {
          const coords = seg.map(({ p, vi }) => [toX(vi), toY(p.value)]);
          const lineStr = coords.map(([x, y]) => `${x},${y}`).join(' ');
          const areaStr = `${coords[0][0]},${PAD_TOP + innerH} ` + lineStr + ` ${coords[coords.length - 1][0]},${PAD_TOP + innerH}`;
          return (
            <g key={si}>
              <polygon points={areaStr} fill={`url(#${gradId})`} />
              <polyline points={lineStr} fill="none" stroke={color}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}

        {/* Error/warning dots */}
        {errorCoords.map(([x, y, status], i) => (
          <circle key={i} cx={x} cy={y} r="2.5"
            fill={status === 'warning' ? '#fbbf24' : '#f87171'} />
        ))}
      </svg>
    </div>
  );
}
