/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import type { UndoableDeleteOptions } from "@/hooks/useUndoableDelete";

// Mock useToast so we can assert toast calls without rendering the DOM.
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  action: vi.fn(),
};
const mockDismiss = vi.fn();

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: mockToast, dismiss: mockDismiss }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

interface TestItem {
  id: string;
  name: string;
}

function makeOpts(
  overrides?: Partial<UndoableDeleteOptions<TestItem>>,
): UndoableDeleteOptions<TestItem> {
  return {
    apiDelete: vi.fn().mockResolvedValue(undefined),
    apiRestore: vi.fn().mockResolvedValue({ id: "1", name: "Test" }),
    items: [{ id: "1", name: "Test" }],
    setItems: vi.fn(),
    labelFn: (item: TestItem) => item.name,
    ...overrides,
  };
}

describe("useUndoableDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically removes the item from the list", async () => {
    const setItems = vi.fn();
    const { result } = renderHook(() =>
      useUndoableDelete(
        makeOpts({ setItems, items: [{ id: "a", name: "Alpha" }] }),
      ),
    );

    await act(() => result.current.delete({ id: "a", name: "Alpha" }));

    const updater = setItems.mock.calls[0][0] as (prev: TestItem[]) => TestItem[];
    expect(updater([{ id: "a", name: "Alpha" }])).toEqual([]);
  });

  it("calls apiDelete after optimistic removal", async () => {
    const apiDelete = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableDelete(makeOpts({ apiDelete })),
    );

    await act(() => result.current.delete({ id: "x", name: "X" }));
    expect(apiDelete).toHaveBeenCalledWith("x");
  });

  it("shows an action toast on successful delete", async () => {
    const { result } = renderHook(() => useUndoableDelete(makeOpts()));

    await act(() => result.current.delete({ id: "1", name: "Test" }));

    expect(mockToast.action).toHaveBeenCalledWith(
      "Test deleted",
      expect.objectContaining({ label: "Undo" }),
    );
  });

  it("rolls back and calls toast.error when apiDelete fails", async () => {
    const apiDelete = vi.fn().mockRejectedValue(new Error("Server down"));
    const setItems = vi.fn();
    const items = [{ id: "a", name: "Alpha" }];

    const { result } = renderHook(() =>
      useUndoableDelete(makeOpts({ apiDelete, setItems, items })),
    );

    await act(() => result.current.delete({ id: "a", name: "Alpha" }));

    // setItems called first for optimistic remove, then for rollback
    expect(setItems).toHaveBeenCalledTimes(2);

    const rollbackUpdater = setItems.mock.calls[1][0] as (prev: TestItem[]) => TestItem[];
    const rollbackResult = rollbackUpdater([]);
    expect(rollbackResult).toEqual([{ id: "a", name: "Alpha" }]);

    expect(mockToast.error).toHaveBeenCalledWith("Server down");
  });

  it("restores item on undo click", async () => {
    const apiRestore = vi.fn().mockResolvedValue({ id: "a", name: "Alpha" });
    const setItems = vi.fn();
    const items = [{ id: "a", name: "Alpha" }];

    const { result } = renderHook(() =>
      useUndoableDelete(makeOpts({ apiRestore, setItems, items })),
    );

    await act(() => result.current.delete({ id: "a", name: "Alpha" }));

    // Grab the onClick handler from the action toast call
    const actionCall = mockToast.action.mock.calls[0][1];
    expect(actionCall).toBeDefined();
    expect(actionCall.label).toBe("Undo");

    // Simulate clicking Undo
    await act(() => actionCall.onClick());

    expect(apiRestore).toHaveBeenCalledWith("a", { id: "a", name: "Alpha" });

    // setItems calls: [0] optimistic remove, [1] undo restore
    const restoreUpdater = setItems.mock.calls[1][0] as (prev: TestItem[]) => TestItem[];
    expect(restoreUpdater([])).toEqual([{ id: "a", name: "Alpha" }]);

    expect(mockToast.success).toHaveBeenCalledWith("Alpha restored");
  });

  it("shows error toast when restore fails", async () => {
    const apiRestore = vi.fn().mockRejectedValue(new Error("Restore failed"));
    const setItems = vi.fn();
    const items = [{ id: "a", name: "Alpha" }];

    const { result } = renderHook(() =>
      useUndoableDelete(makeOpts({ apiRestore, setItems, items })),
    );

    await act(() => result.current.delete({ id: "a", name: "Alpha" }));

    const actionCall = mockToast.action.mock.calls[0][1];
    await act(() => actionCall.onClick());

    expect(mockToast.error).toHaveBeenCalledWith("Restore failed");
  });

  it("calls onRestored callback after successful restore", async () => {
    const restoredItem = { id: "a", name: "Alpha" };
    const apiRestore = vi.fn().mockResolvedValue(restoredItem);
    const onRestored = vi.fn();
    const setItems = vi.fn();
    const items = [restoredItem];

    const { result } = renderHook(() =>
      useUndoableDelete(makeOpts({ apiRestore, onRestored, setItems, items })),
    );

    await act(() => result.current.delete(restoredItem));

    const actionCall = mockToast.action.mock.calls[0][1];
    await act(() => actionCall.onClick());

    expect(onRestored).toHaveBeenCalledWith(restoredItem);
  });

  it("uses labelFn for the toast message", async () => {
    const { result } = renderHook(() =>
      useUndoableDelete(
        makeOpts({
          labelFn: (item: TestItem) => `Artist "${item.name}"`,
          items: [{ id: "b", name: "Beatsmith" }],
          setItems: vi.fn(),
        }),
      ),
    );

    await act(() => result.current.delete({ id: "b", name: "Beatsmith" }));

    expect(mockToast.action).toHaveBeenCalledWith(
      'Artist "Beatsmith" deleted',
      expect.any(Object),
    );
  });

  it("does not duplicate items on rollback if already present", async () => {
    const apiDelete = vi.fn().mockRejectedValue(new Error("fail"));
    const setItems = vi.fn();
    const item = { id: "a", name: "Alpha" };

    const { result } = renderHook(() =>
      useUndoableDelete(makeOpts({ apiDelete, setItems, items: [item] })),
    );

    await act(() => result.current.delete(item));

    const rollbackUpdater = setItems.mock.calls[1][0] as (prev: TestItem[]) => TestItem[];
    const result2 = rollbackUpdater([item]);
    expect(result2).toEqual([item]);
  });
});
