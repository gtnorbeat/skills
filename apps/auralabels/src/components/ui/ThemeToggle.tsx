import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  /** When true, renders with a larger icon and different shape
   *  suitable for the landing page floating position. Default false
   *  (compact header variant). */
  variant?: "compact" | "floating";
}

function getIcon(mode: "light" | "dark" | "system"): string {
  switch (mode) {
    case "light": return "☀️";
    case "dark": return "🌙";
    case "system": return "🖥";
  }
}

function getLabel(mode: "light" | "dark" | "system"): string {
  switch (mode) {
    case "light": return "Switch to dark mode";
    case "dark": return "Switch to system theme";
    case "system": return "Switch to light mode";
  }
}

function getTitle(mode: "light" | "dark" | "system"): string {
  const next = mode === "system" ? "Light" : mode === "light" ? "Dark" : "System";
  return `${next} theme`;
}

export function ThemeToggle({ variant = "compact" }: ThemeToggleProps) {
  const { mode, toggleTheme } = useTheme();

  if (variant === "floating") {
    return (
      <button
        onClick={toggleTheme}
        aria-label={getLabel(mode)}
        title={getTitle(mode)}
        className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-lg shadow-zinc-900/10 transition-all hover:border-zinc-300 hover:text-zinc-900 hover:shadow-lg hover:shadow-zinc-900/20"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {getIcon(mode)}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={getLabel(mode)}
      title={getTitle(mode)}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {getIcon(mode)}
      </span>
    </button>
  );
}
