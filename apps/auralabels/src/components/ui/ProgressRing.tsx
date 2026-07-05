interface ProgressRingProps {
  /** Completion value 0-100. Values outside the range are clamped. */
  value: number;
  /** Visual diameter in pixels (default 36) */
  size?: number;
  /** Use the new accent gradient (cyan→violet) regardless of value */
  accent?: boolean;
  /** Accessible name; defaults to `${pct}% complete`. */
  ariaLabel?: string;
  /** Optional override class for the percentage text */
  textClassName?: string;
  /** Hide the percentage text inside the ring (just the ring + aria) */
  hideLabel?: boolean;
}

/**
 * AURA ProgressRing — small circular percentage indicator.
 * Three-stop color logic:
 *   >=80 emerald, >=40 amber, else red.
 * `accent` overrides to always use the cyan→violet gradient.
 */
export function ProgressRing({
  value,
  size = 36,
  accent = false,
  ariaLabel,
  textClassName,
  hideLabel = false,
}: ProgressRingProps) {
  const stroke = Math.max(2, Math.round(size / 14));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value, 0), 100);
  const offset = circumference * (1 - pct / 100);

  const palette = accent
    ? {
        stroke: "url(#aura-progress-accent)",
        text: "text-cyan-400",
      }
    : pct >= 80
      ? { stroke: "#10b981", text: "text-emerald-400" }
      : pct >= 40
        ? { stroke: "#fbbf24", text: "text-amber-400" }
        : { stroke: "#ef4444", text: "text-red-400" };

  const labelText = ariaLabel ?? `${Math.round(pct)} percent complete`;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={labelText}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="aura-progress-accent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.stroke}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {!hideLabel && (
        <span
          className={`absolute text-[10px] font-semibold tabular-nums ${palette.text} ${textClassName ?? ""}`}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
