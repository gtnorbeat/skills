interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  label: string;
  options: FilterOption[];
  selected: string;
  onChange: (value: string) => void;
}

export function FilterBar({
  label,
  options,
  selected,
  onChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}:
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Filter by ${label.toLowerCase()}`}>
        <button
          onClick={() => onChange("all")}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${
            selected === "all"
              ? "bg-cyan-500/15 text-cyan-400"
              : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          All
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${
              selected === option.value
                ? "bg-cyan-500/15 text-cyan-400"
                : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
