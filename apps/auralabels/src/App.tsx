import { Suspense, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuraIntro } from "@/components/layout/AuraIntro";
import { LoginPage } from "@/components/auth/LoginPage";
import { LandingPage } from "@/components/landing/LandingPage";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { PageLoader } from "@/components/ui/PageLoader";
import { lazyNamed } from "@/utils/lazyNamed";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { checkAuth } from "@/utils/api";

// Route-level code splitting. Dashboard stays eager — it's the primary
// landing surface and must paint immediately. Every other page is split
// into its own chunk so the first-paint payload only ships what the
// Dashboard route actually uses. Chunks cache independently for repeat
// navigation.
const ArtistPage = lazyNamed(() => import("@/components/artists/ArtistPage"), "ArtistPage");
const ReleasePage = lazyNamed(() => import("@/components/releases/ReleasePage"), "ReleasePage");
const ContractPage = lazyNamed(() => import("@/components/contracts/ContractPage"), "ContractPage");
const DemoPage = lazyNamed(() => import("@/components/demo-inbox/DemoPage"), "DemoPage");
const PromoPage = lazyNamed(() => import("@/components/promo/PromoPage"), "PromoPage");
const CalendarPage = lazyNamed(() => import("@/components/calendar/CalendarPage"), "CalendarPage");
const AIAssistantPage = lazyNamed(() => import("@/components/ai-assistant/AIAssistantPage"), "AIAssistantPage");
const CampaignIntelligencePage = lazyNamed(() => import("@/components/campaigns/CampaignIntelligencePage"), "CampaignIntelligencePage");
const ContentStudioPage = lazyNamed(() => import("@/components/content-studio/ContentStudioPage"), "ContentStudioPage");
const SettingsPage = lazyNamed(() => import("@/components/settings/SettingsPage"), "SettingsPage");
const RevenuePage = lazyNamed(() => import("@/components/revenue/RevenuePage"), "RevenuePage");

/**
 * Wraps children in an ErrorBoundary that remounts on route changes.
 * Uses `useLocation` to derive the pathname key so a rendering crash
 * on /artists is auto-cleared when the user navigates to /releases —
 * the boundary starts fresh rather than keeping the stale error from
 * the previous route.
 */
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      {children}
    </ErrorBoundary>
  );
}

/** 5 minutes of inactivity before auto-logout (non-remembered sessions). */
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

/** Clear all AURA-related cached data on logout. */
function clearCache() {
  // Remove auth and session keys from localStorage.
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("auth_") || key.startsWith("aura_"))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Purge service worker caches if available.
  if (typeof caches !== "undefined") {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name).catch(() => {}));
    }).catch(() => {});
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("auth_user"));
  const [checking, setChecking] = useState(true);

  // Inactivity timer ref — only active for non-remembered sessions.
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemembered = localStorage.getItem("auth_remember") === "true";

  const [introActive, setIntroActive] = useState(false);

  useEffect(() => {
    if (token) {
      checkAuth().then((valid) => {
        if (!valid) {
          clearCache();
          setToken(null);
          setUsername(null);
          setChecking(false);
          return;
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [token]);

  // Reset the inactivity timer on any user interaction.
  const resetInactivityTimer = useCallback(() => {
    if (isRemembered) return; // remembered sessions never auto-logout
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      clearCache();
      setToken(null);
      setUsername(null);
    }, INACTIVITY_TIMEOUT_MS);
  }, [isRemembered]);

  // Attach activity listeners when the user is logged in with a non-remembered session.
  useEffect(() => {
    if (!token || isRemembered) return;
    const events = ["mousedown", "keydown", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer(); // start the timer
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [token, isRemembered, resetInactivityTimer]);

  function handleLogin(newToken: string, newUsername: string, remember?: boolean) {
    localStorage.setItem("auth_token", newToken);
    localStorage.setItem("auth_user", newUsername);
    localStorage.setItem("auth_remember", remember ? "true" : "false");
    setToken(newToken);
    setUsername(newUsername);
    setIntroActive(true);
  }

  function handleIntroDone() {
    setIntroActive(false);
  }

  function handleLogout() {
    clearCache();
    setToken(null);
    setUsername(null);
    setIntroActive(false);
  }

  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="text-xs text-zinc-500">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppLayout
            username={username}
            onSignOut={handleLogout}
            heroState={introActive ? "pending" : "settled"}
          >
            <Suspense
              fallback={
                <div
                  className="min-h-[50vh]"
                  role="region"
                  aria-label="Loading page"
                >
                  <PageLoader message="" />
                </div>
              }
            >
              <RoutedErrorBoundary>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="artists" element={<ArtistPage />} />
                  <Route path="artists/:id" element={<ArtistPage />} />
                  <Route path="releases" element={<ReleasePage />} />
                  <Route path="releases/:id" element={<ReleasePage />} />
                  <Route path="contracts" element={<ContractPage />} />
                  <Route path="contracts/:id" element={<ContractPage />} />
                  <Route path="revenue" element={<RevenuePage />} />
                  <Route path="demo-inbox" element={<DemoPage />} />
                  <Route path="demo-inbox/:id" element={<DemoPage />} />
                  <Route path="promo" element={<PromoPage />} />
                  <Route path="promo/:id" element={<PromoPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="calendar/:id" element={<CalendarPage />} />
                  <Route path="ai" element={<AIAssistantPage />} />
                  <Route path="campaigns" element={<CampaignIntelligencePage />} />
                  <Route path="content" element={<ContentStudioPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Routes>
              </RoutedErrorBoundary>
            </Suspense>
          </AppLayout>
        </BrowserRouter>
        <AuraIntro active={introActive} onDone={handleIntroDone} />
      </ToastProvider>
    </ThemeProvider>
  );
}
