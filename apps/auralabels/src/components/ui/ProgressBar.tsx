interface ProgressBarProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
  accent?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  size = "md",
  showLabel = false,
  label,
  accent = false,
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  const heights = { sm: "h-1", md: "h-1.5", lg: "h-2" };

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <span className="text-xs text-zinc-400">{label}</span>
          )}
          {showLabel && (
            <span className="text-xs font-medium text-zinc-300">{percentage}%</span>
          )}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-zinc-800 ${heights[size]}`}>
        <div
          className={`${heights[size]} rounded-full transition-all duration-700 ease-out ${
            accent
              ? "bg-gradient-to-r from-cyan-500 to-violet-500"
              : "bg-gradient-to-r from-zinc-600 to-zinc-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
