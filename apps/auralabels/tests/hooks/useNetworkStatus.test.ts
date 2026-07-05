/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

describe("useNetworkStatus", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns isOnline = true when navigator.onLine is true", () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it("returns isOnline = false when navigator.onLine is false", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it("updates to offline when window fires 'offline' event", () => {
    let offlineHandler: (() => void) | undefined;
    vi.stubGlobal("window", {
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "offline") offlineHandler = handler;
      }),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      offlineHandler?.();
    });
    expect(result.current.isOnline).toBe(false);
  });

  it("updates to online when window fires 'online' event", () => {
    vi.stubGlobal("navigator", { onLine: false });
    let onlineHandler: (() => void) | undefined;
    vi.stubGlobal("window", {
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "online") onlineHandler = handler;
      }),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      onlineHandler?.();
    });
    expect(result.current.isOnline).toBe(true);
  });

  it("registers event listeners on mount", () => {
    const addListener = vi.fn();
    vi.stubGlobal("window", {
      addEventListener: addListener,
      removeEventListener: vi.fn(),
    });

    renderHook(() => useNetworkStatus());
    expect(addListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(addListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });

  it("cleans up event listeners on unmount", () => {
    const removeListener = vi.fn();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: removeListener,
    });

    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();

    expect(removeListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});
