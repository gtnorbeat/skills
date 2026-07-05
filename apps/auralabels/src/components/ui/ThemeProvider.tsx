import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The user's stored preference (light / dark / system). */
  mode: ThemeMode;
  /** The currently active theme after resolving "system" via prefers-color-scheme. */
  resolvedTheme: ResolvedTheme;
  /** Set the user's preference explicitly. */
  setMode: (mode: ThemeMode) => void;
  /** Cycle: system → light → dark → system. */
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "aura_theme";

function getInitialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light" || saved === "system") return saved;
  } catch {
    /* localStorage unavailable */
  }
  return "system";
}

/** Subscribe to OS theme changes. Returns an unsubscribe function. */
function subscribeToOsTheme(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  // Modern browsers support addEventListener; Safari <14 uses addListener.
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolvedTheme: "light",
  setMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  // Track OS preference independently so system-mode re-evaluates on change.
  const [osPrefersDark, setOsPrefersDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Subscribe to OS theme changes while mounted.
  useEffect(() => {
    return subscribeToOsTheme(() => {
      setOsPrefersDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    });
  }, []);

  // Derive the resolved theme from mode + OS preference.
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (mode === "system") return osPrefersDark ? "dark" : "light";
    return mode;
  }, [mode, osPrefersDark]);

  // Apply `data-theme` on <html> and persist to localStorage.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* private mode / quota — state still works this session */
    }
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      if (prev === "system") return "light";
      if (prev === "light") return "dark";
      return "system";
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
