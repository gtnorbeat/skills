/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";

// ── Helpers ─────────────────────────────────────────────────────────

/** A minimal fake ServiceWorkerRegistration with controllable state. */
function makeFakeRegistration(
  overrides: Partial<ServiceWorkerRegistration> = {},
): ServiceWorkerRegistration {
  return {
    waiting: undefined,
    installing: undefined,
    active: undefined,
    update: vi.fn(),
    unregister: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as ServiceWorkerRegistration;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("useServiceWorkerUpdate", () => {
  let originalSW: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalSW = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSW) {
      Object.defineProperty(navigator, "serviceWorker", originalSW);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).serviceWorker;
    }
  });

  it("returns updateAvailable=false and applyUpdate is a no-op when serviceWorker is unsupported", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).serviceWorker;

    const { result } = renderHook(() => useServiceWorkerUpdate());
    expect(result.current.updateAvailable).toBe(false);
    expect(() => result.current.applyUpdate()).not.toThrow();
  });

  it("sets updateAvailable=true when a waiting SW is detected on mount", async () => {
    const reg = makeFakeRegistration({
      waiting: {} as ServiceWorker,
    });

    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: {} as ServiceWorker,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    const { result } = renderHook(() => useServiceWorkerUpdate());

    // getRegistration().then(checkWaiting) runs asynchronously; flush
    // the microtask queue with a tick so the state update lands before
    // we assert.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.updateAvailable).toBe(true);
  });

  it("attaches updatefound listener to the registration, not the container", async () => {
    const regAddEventListener = vi.fn();
    const reg = makeFakeRegistration({
      addEventListener: regAddEventListener,
    });

    const containerAddEventListener = vi.fn();
    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: containerAddEventListener,
      removeEventListener: vi.fn(),
      controller: null,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    renderHook(() => useServiceWorkerUpdate());

    // Wait for getRegistration to resolve so the listener is attached
    await act(async () => {
      await vi.waitFor(() => {
        expect(regAddEventListener).toHaveBeenCalledWith("updatefound", expect.any(Function));
      });
    });

    // The container should NOT receive updatefound — only controllerchange
    expect(containerAddEventListener).not.toHaveBeenCalledWith("updatefound", expect.any(Function));
    expect(containerAddEventListener).toHaveBeenCalledWith("controllerchange", expect.any(Function));
  });

  it("sets updateAvailable=true when an installed SW event fires with an existing controller", async () => {
    let updateFoundHandler: ((event: Event) => void) | undefined;
    const fakeInstallingSw = {
      addEventListener: vi.fn(),
      state: "installing",
    } as unknown as ServiceWorker;

    const reg = makeFakeRegistration({
      installing: fakeInstallingSw,
      addEventListener: vi.fn((event: string, handler: (e: Event) => void) => {
        if (event === "updatefound") updateFoundHandler = handler;
      }),
    });

    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: {} as ServiceWorker,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    const { result } = renderHook(() => useServiceWorkerUpdate());

    // Wait for getRegistration to resolve and attach the listener
    await act(async () => {
      await vi.waitFor(() => {
        expect(updateFoundHandler).toBeDefined();
      });
    });

    // Simulate updatefound event — target is the registration
    await act(async () => {
      updateFoundHandler?.({ target: reg } as unknown as Event);
    });

    // The installing SW's statechange listener should have been registered
    expect(fakeInstallingSw.addEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function),
    );

    // Get the statechange handler and fire it with "installed"
    const stateChangeCall = (fakeInstallingSw.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "statechange",
    );
    const stateChangeHandler = stateChangeCall?.[1] as ((e: Event) => void) | undefined;

    await act(async () => {
      (fakeInstallingSw as unknown as { state: string }).state = "installed";
      stateChangeHandler?.({} as Event);
    });

    expect(result.current.updateAvailable).toBe(true);
  });

  it("does not set updateAvailable on first install (no existing controller)", async () => {
    let updateFoundHandler: ((event: Event) => void) | undefined;
    const fakeInstallingSw = {
      addEventListener: vi.fn(),
      state: "installing",
    } as unknown as ServiceWorker;

    const reg = makeFakeRegistration({
      installing: fakeInstallingSw,
      addEventListener: vi.fn((event: string, handler: (e: Event) => void) => {
        if (event === "updatefound") updateFoundHandler = handler;
      }),
    });

    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      // No controller — this is a first install, not an update
      controller: null,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await act(async () => {
      await vi.waitFor(() => {
        expect(updateFoundHandler).toBeDefined();
      });
    });

    await act(async () => {
      updateFoundHandler?.({ target: reg } as unknown as Event);
    });

    const stateChangeCall = (fakeInstallingSw.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "statechange",
    );
    const stateChangeHandler = stateChangeCall?.[1] as ((e: Event) => void) | undefined;

    await act(async () => {
      (fakeInstallingSw as unknown as { state: string }).state = "installed";
      stateChangeHandler?.({} as Event);
    });

    // First install should NOT trigger updateAvailable
    expect(result.current.updateAvailable).toBe(false);
  });

  it("applyUpdate posts SKIP_WAITING to the waiting SW", async () => {
    const postMessage = vi.fn();
    const waitingSw = { postMessage } as unknown as ServiceWorker;
    const reg = makeFakeRegistration({ waiting: waitingSw });

    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: {} as ServiceWorker,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await act(async () => {
      result.current.applyUpdate();
      await vi.waitFor(() => {
        expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
      });
    });
  });

  it("applyUpdate is a no-op when no waiting SW exists", async () => {
    const reg = makeFakeRegistration({ waiting: undefined });

    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: {} as ServiceWorker,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await act(async () => {
      expect(() => result.current.applyUpdate()).not.toThrow();
    });
  });

  it("controllerchange does NOT reload on first install (no applyUpdate called)", async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      configurable: true,
    });

    let controllerChangeHandler: (() => void) | undefined;
    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(makeFakeRegistration()),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "controllerchange") controllerChangeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      controller: {} as ServiceWorker,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    renderHook(() => useServiceWorkerUpdate());

    // Wait for getRegistration to resolve
    await act(async () => {
      await vi.waitFor(() => {
        expect(controllerChangeHandler).toBeDefined();
      });
    });

    // Fire controllerchange WITHOUT calling applyUpdate first
    await act(async () => {
      controllerChangeHandler?.();
    });

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("controllerchange DOES reload after applyUpdate is called", async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      configurable: true,
    });

    let controllerChangeHandler: (() => void) | undefined;
    const waitingSw = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const reg = makeFakeRegistration({ waiting: waitingSw });

    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "controllerchange") controllerChangeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      controller: {} as ServiceWorker,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    const { result } = renderHook(() => useServiceWorkerUpdate());

    // Wait for getRegistration
    await act(async () => {
      await vi.waitFor(() => {
        expect(controllerChangeHandler).toBeDefined();
      });
    });

    // Call applyUpdate first, then fire controllerchange
    await act(async () => {
      result.current.applyUpdate();
    });

    await act(async () => {
      controllerChangeHandler?.();
    });

    expect(reloadSpy).toHaveBeenCalled();
  });

  it("cleans up event listeners on unmount", async () => {
    const regRemoveEventListener = vi.fn();
    const reg = makeFakeRegistration({
      removeEventListener: regRemoveEventListener,
    });

    const containerRemoveEventListener = vi.fn();
    const fakeSW = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: containerRemoveEventListener,
      controller: null,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: fakeSW,
      configurable: true,
    });

    const { unmount } = renderHook(() => useServiceWorkerUpdate());

    // Wait for getRegistration to resolve so listeners are attached
    await act(async () => {
      await vi.waitFor(() => {
        expect(regRemoveEventListener).not.toHaveBeenCalled();
      });
    });

    unmount();

    // Registration's updatefound listener should be removed
    expect(regRemoveEventListener).toHaveBeenCalledWith("updatefound", expect.any(Function));
    // Container's controllerchange listener should be removed
    expect(containerRemoveEventListener).toHaveBeenCalledWith("controllerchange", expect.any(Function));
  });
});
