import { useState, type FormEvent, useRef, useEffect } from "react";
import { AuraBrand } from "@/components/ui/AuraBrand";
import { Footer } from "@/components/ui/Footer";
import { register } from "@/utils/api";

// hCaptcha site key — loaded from Vite env at build time.
// Falls back to a test key (always passes) for local dev.
const HCAPTCHA_SITEKEY =
  import.meta.env.VITE_HCAPTCHA_SITEKEY || "bff62588-c52e-4d30-8d84-4a8c919493c6";

// Declare hCaptcha global type
declare global {
  interface Window {
    hcaptcha?: {
      render: (el: string | HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      execute: (id?: string, opts?: { async: boolean }) => Promise<{ response: string }>;
      getResponse: (id?: string) => string;
    };
  }
}

interface LoginPageProps {
  onLogin: (token: string, username: string, remember?: boolean) => void;
}


const SUBTITLE_COLORS: Record<string, string> = {
  A: "text-aura-cyan",
  U: "text-aura-violet",
  R: "text-aura-magenta",
};

const SUBTITLE_WORDS = "A&R Utility & Resources AI Assistant".split(" ");

interface LoginResponse {
  status: string;
  token: string;
  rememberMe?: boolean;
  message?: string;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [labelName, setLabelName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // ── hCaptcha refs ────────────────────────────────────
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaIdRef = useRef<string | null>(null);
  const captchaLoadedRef = useRef(false);

  // Render hCaptcha widget when in register mode
  useEffect(() => {
    if (mode !== "register" || captchaLoadedRef.current) return;

    const scriptId = "hcaptcha-script";
    const existingScript = document.getElementById(scriptId);

    function renderWidget() {
      if (!window.hcaptcha || !captchaRef.current || captchaLoadedRef.current) return;
      captchaIdRef.current = window.hcaptcha.render(captchaRef.current, {
        sitekey: HCAPTCHA_SITEKEY,
        size: "normal",
        theme: "light",
      });
      captchaLoadedRef.current = true;
    }

    if (existingScript) {
      // Script already loaded by a previous mount — render immediately
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://js.hcaptcha.com/1/api.js";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount — it may be needed on re-mount.
      // Just reset the loaded flag so it re-renders next time.
      captchaLoadedRef.current = false;
      captchaIdRef.current = null;
    };
  }, [mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Enter username and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, rememberMe }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok) {
        setError(
          data.message === "Invalid credentials"
            ? "Incorrect username or password"
            : data.message || "Authentication error"
        );
        return;
      }

      // Persist username alongside the token so the Header chip and the
      // Settings Session card can show who is signed in without a second
      // round-trip to the server.
      onLogin(data.token, username, data.rememberMe);
    } catch {
      setError("Cannot reach the server");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !password || !email || !labelName) {
      setError("All fields are required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    setLoading(true);
    try {
      // Get hCaptcha token
      const captchaToken = window.hcaptcha?.getResponse(captchaIdRef.current ?? undefined) ?? "";
      if (!captchaToken) {
        setError("Please complete the CAPTCHA verification");
        setLoading(false);
        // Reset the widget so the user can try again
        window.hcaptcha?.reset(captchaIdRef.current ?? undefined);
        return;
      }

      const result = await register({ username, password, email, labelName, "h-captcha-response": captchaToken });
      setSuccess(`Account created! Welcome, ${result.user.username}.`);
      setSuccess(`Account created! Welcome, ${result.user.username}.`);
      // Auto-login after a brief moment so the user sees the success message
      setTimeout(() => {
        onLogin(result.token, result.user.username, true);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white">
      {/* Bloom orbs — light variant for white background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 aura-dot-grid-light" />
        <div className="absolute inset-0 aura-wireframe-grid-light" />
        <div className="absolute inset-0 aura-bloom-cyan-light" />
        <div className="absolute inset-0 aura-bloom-violet-light" />
        <div className="absolute inset-0 aura-bloom-magenta-light" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-5 sm:px-6">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          {/* Brand composite — AuraBrand renders the AURA logo
              image (responsive WebP: 256w/512w/960w via srcSet).
              The same source raster drives the Login splash + the
              AppLayout hero watermark + the AuraIntro splash,
              AND the home-screen install icon. The source raster
              is square (1000×1000) with a transparent background. */}
          <div className="mx-auto mb-5 flex justify-center">
            <AuraBrand size={192} ariaLabel="AURA" priority />
          </div>
        </div>

        <h1 className="font-display text-xl text-zinc-900 text-balance text-center mb-6">
          {SUBTITLE_WORDS.map((word, i) => {
            const first = word[0];
            const color = SUBTITLE_COLORS[first];
            return (
              <span key={i}>
                {i > 0 && " "}
                {color ? <span className={color}>{first}</span> : first}
                {word.slice(1)}
              </span>
            );
          })}
        </h1>

        {/* Mode toggle — login vs register */}
        <div className="mb-5 flex rounded-lg bg-zinc-100 p-0.5" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            aria-label="Show sign in form"
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "login"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            aria-label="Show create account form"
            onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "register"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Create account
          </button>
        </div>

        {/* Login form */}
        {mode === "login" && (
          <form onSubmit={handleSubmit} className="space-y-4 aura-enter-fade">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-zinc-600 mb-1.5">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                autoComplete="username"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-zinc-600 mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            {/* Remember me checkbox — when checked the server issues a 7-day
                token. When unchecked the token expires in 5 minutes and the
                client auto-logs out after 5 minutes of inactivity. */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500/30 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-500">Remember me</span>
            </label>

            {error && (
              <p className="text-xs text-red-500 text-center" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {/* Register form */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4 aura-enter-fade">
            <div>
              <label htmlFor="labelName" className="block text-xs font-medium text-zinc-600 mb-1.5">
                Label name
              </label>
              <input
                id="labelName"
                name="labelName"
                type="text"
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                placeholder="Your label name"
                autoFocus
                autoComplete="organization"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label htmlFor="regEmail" className="block text-xs font-medium text-zinc-600 mb-1.5">
                Email
              </label>
              <input
                id="regEmail"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label htmlFor="regUsername" className="block text-xs font-medium text-zinc-600 mb-1.5">
                Admin username
              </label>
              <input
                id="regUsername"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                autoComplete="username"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label htmlFor="regPassword" className="block text-xs font-medium text-zinc-600 mb-1.5">
                Password
              </label>
              <input
                id="regPassword"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            {/* hCaptcha widget */}
            <div ref={captchaRef} className="flex justify-center" />

            {error && (
              <p className="text-xs text-red-500 text-center" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-emerald-600 text-center" role="status">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {/* Admin entry point */}
        <div className="mt-4 pt-4 border-t border-zinc-200">
          <p className="text-center text-xs text-zinc-400 mb-3">A&amp;R and label staff use the dashboard</p>
          <button
            type="button"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-700"
            onClick={() => {
              document.getElementById("username")?.focus();
            }}
          >
            Admin sign in ↓
          </button>
        </div>

        {/* WCAG AA on bg-white: text-xs meets 4.5:1 fine. */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Made for A&amp;Rs and indie labels · Powered by AURA
        </p>
        {/* Brand footer — copyright + version microcopy. Style born from the
            same WCAG-AA constraint as the line above; sits below the
            product tagline so the eye reads product positioning first,
            legal line second. mt-3 is the smallest gap that keeps the two
            microcopy lines from kerning into each other at text-[10px]. */}
        <Footer className="mt-3" />
      </div>
    </div>
  );
}
