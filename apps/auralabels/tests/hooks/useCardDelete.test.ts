/** @vitest-environment jsdom */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCardDelete } from "@/hooks/useCardDelete";
import type { UseCardDeleteOptions } from "@/hooks/useCardDelete";

function makeOpts(overrides?: Partial<UseCardDeleteOptions>): UseCardDeleteOptions {
  return {
    api: vi.fn().mockResolvedValue(undefined),
    onSuccess: vi.fn(),
    onDeleted: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

describe("useCardDelete", () => {
  it("starts with confirming=false and deleting=false", () => {
    const { result } = renderHook(() => useCardDelete(makeOpts()));
    expect(result.current.confirming).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  it("requestDelete sets confirming=true", () => {
    const { result } = renderHook(() => useCardDelete(makeOpts()));
    act(() => result.current.requestDelete());
    expect(result.current.confirming).toBe(true);
    expect(result.current.deleting).toBe(false);
  });

  it("cancelDelete sets confirming=false", () => {
    const { result } = renderHook(() => useCardDelete(makeOpts()));
    act(() => result.current.requestDelete());
    expect(result.current.confirming).toBe(true);
    act(() => result.current.cancelDelete());
    expect(result.current.confirming).toBe(false);
  });

  it("performDelete calls api, onDeleted, and onSuccess on success", async () => {
    const api = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onDeleted = vi.fn();

    const { result } = renderHook(() =>
      useCardDelete(makeOpts({ api, onSuccess, onDeleted })),
    );

    act(() => result.current.requestDelete());
    await act(() => result.current.performDelete());

    expect(api).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // On success the panel closes — deleting stays true because
    // setDeleting(false) only runs in the error path.
  });

  it("onDeleted is called before onSuccess", async () => {
    const callOrder: string[] = [];
    const api = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn(() => callOrder.push("success"));
    const onDeleted = vi.fn(() => callOrder.push("deleted"));

    const { result } = renderHook(() =>
      useCardDelete(makeOpts({ api, onSuccess, onDeleted })),
    );

    await act(() => result.current.performDelete());
    expect(callOrder).toEqual(["deleted", "success"]);
  });

  it("performDelete calls onError when api rejects", async () => {
    const api = vi.fn().mockRejectedValue(new Error("Network error"));
    const onError = vi.fn();
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useCardDelete(makeOpts({ api, onError, onSuccess })),
    );

    act(() => result.current.requestDelete());
    await act(() => result.current.performDelete());

    expect(onError).toHaveBeenCalledWith("Network error");
    expect(onSuccess).not.toHaveBeenCalled();
    // confirming stays true so the error banner inside the iframe is visible
    expect(result.current.confirming).toBe(true);
    expect(result.current.deleting).toBe(false);
  });

  it("uses fallbackMessage when error is not an Error instance", async () => {
    const api = vi.fn().mockRejectedValue("raw string error");
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useCardDelete(makeOpts({ api, onError, fallbackMessage: "Custom fallback" })),
    );

    act(() => result.current.requestDelete());
    await act(() => result.current.performDelete());
    expect(onError).toHaveBeenCalledWith("Custom fallback");
  });

  it("closes confirm iframe silently when no onError is wired", async () => {
    const api = vi.fn().mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() =>
      useCardDelete(makeOpts({ api, onError: undefined })),
    );

    act(() => result.current.requestDelete());
    expect(result.current.confirming).toBe(true);

    await act(() => result.current.performDelete());
    // Without an onError sink, the confirm iframe closes
    expect(result.current.confirming).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  it("uses the latest opts via ref pattern on performDelete", async () => {
    const api1 = vi.fn().mockRejectedValue(new Error("first"));
    const api2 = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    // Render with api1, then re-render with api2
    const { result, rerender } = renderHook(
      ({ opts }) => useCardDelete(opts),
      { initialProps: { opts: makeOpts({ api: api1, onSuccess }) } },
    );

    // Re-render with new opts — performDelete should use api2 (latest ref)
    rerender({ opts: makeOpts({ api: api2, onSuccess }) });

    await act(() => result.current.performDelete());
    expect(api2).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });
});
