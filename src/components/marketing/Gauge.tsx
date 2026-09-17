interface GaugeProps {
  value: number;
  color?: string;
  showLabels?: boolean;
  min?: number;
  max?: number;
}

// A 180°, 40-tick arc gauge. Ported from the MotionSites hero brief's gauge
// spec (same geometry: viewBox 0 0 200 120, ticks swept from angle π to 2π
// around a center at 100,100) and re-themed to Sithelo's electric-blue
// accent instead of the source template's orange.
export function Gauge({ value, color = "#2F7BF6", showLabels = false, min = 0, max = 100 }: GaugeProps) {
  const totalTicks = 40;
  const activeTicks = Math.round((value / 100) * totalTicks);
  const cx = 100;
  const cy = 100;
  const outerR = 80;
  const innerR = 70;

  const ticks = Array.from({ length: totalTicks }, (_, i) => {
    const angle = Math.PI + (i / (totalTicks - 1)) * Math.PI;
    const x1 = cx + innerR * Math.cos(angle);
    const y1 = cy + innerR * Math.sin(angle);
    const x2 = cx + outerR * Math.cos(angle);
    const y2 = cy + outerR * Math.sin(angle);
    const active = i < activeTicks;
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={active ? color : "#d4d4d8"}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full" style={{ maxWidth: 260 }}>
        {ticks}
        <text x={cx} y={105} textAnchor="middle" fontSize={22} fontWeight={600} fill="#0B1D33">
          {value}%
        </text>
      </svg>
      {showLabels && (
        <div className="flex justify-between w-full text-[11px] text-ink-500" style={{ maxWidth: 260 }}>
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}
