interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: SearchInputProps) {
  const inputId = `search-${placeholder?.replace(/\s+/g, "-").toLowerCase() ?? "input"}`;

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">{placeholder}</label>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
        ⌕
      </span>
      <input
        id={inputId}
        type="text"
        name="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 py-2 pl-8 pr-8 text-sm text-white placeholder-zinc-500 transition-colors duration-200 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      )}
    </div>
  );
}
