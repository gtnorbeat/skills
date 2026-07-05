/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * Helper: render useFocusTrap with a real DOM dialogRef.
 * Returns the container so tests can query focusable elements inside it.
 */
function renderFocusTrap(active = true, onEsc = vi.fn()) {
  // Create a container with focusable children
  const container = document.createElement("div");
  container.innerHTML = `
    <div data-testid="dialog">
      <input data-testid="first-input" type="text" />
      <button data-testid="middle-btn">Save</button>
      <a data-testid="last-link" href="#">Cancel</a>
    </div>
  `;
  document.body.appendChild(container);

  const dialogEl = container.querySelector("[data-testid=dialog]") as HTMLElement;
  const ref = { current: dialogEl };

  const result = renderHook(() => useFocusTrap(ref, active, onEsc));

  return { container, dialogEl, ref, result, unmount: result.unmount };
}

describe("useFocusTrap", () => {
  beforeEach(() => {
    // Ensure document.body has focus so we can test focus movement
    document.body.focus();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("focuses the first focusable element on mount", () => {
    const { dialogEl } = renderFocusTrap();

    // After mount, the first input should be focused
    expect(document.activeElement).toBe(
      dialogEl.querySelector("[data-testid=first-input]"),
    );
  });

  it("does nothing when active is false", () => {
    const { dialogEl } = renderFocusTrap(false);

    // Focus should remain on body (or wherever it was)
    const firstInput = dialogEl.querySelector("[data-testid=first-input]") as HTMLElement;
    expect(document.activeElement).not.toBe(firstInput);
  });

  it("does nothing when dialogRef.current is null", () => {
    const onEsc = vi.fn();
    const ref = { current: null };

    expect(() => {
      renderHook(() => useFocusTrap(ref, true, onEsc));
    }).not.toThrow();
  });

  it("calls onEsc when Escape is pressed", () => {
    const onEsc = vi.fn();
    renderFocusTrap(true, onEsc);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEsc).toHaveBeenCalledTimes(1);
  });

  it("cycles Tab forward from last to first focusable", () => {
    const { dialogEl } = renderFocusTrap();

    // Focus the last focusable element
    const lastLink = dialogEl.querySelector("[data-testid=last-link]") as HTMLElement;
    lastLink.focus();
    expect(document.activeElement).toBe(lastLink);

    // Press Tab
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

    // Focus should cycle to the first input
    const firstInput = dialogEl.querySelector("[data-testid=first-input]") as HTMLElement;
    expect(document.activeElement).toBe(firstInput);
  });

  it("cycles Shift+Tab backward from first to last focusable", () => {
    const { dialogEl } = renderFocusTrap();

    // Focus the first element
    const firstInput = dialogEl.querySelector("[data-testid=first-input]") as HTMLElement;
    firstInput.focus();
    expect(document.activeElement).toBe(firstInput);

    // Press Shift+Tab
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
    );

    // Focus should cycle to the last link
    const lastLink = dialogEl.querySelector("[data-testid=last-link]") as HTMLElement;
    expect(document.activeElement).toBe(lastLink);
  });

  it("does not trap Tab when dialog has no focusable children", () => {
    // Empty dialog
    const container = document.createElement("div");
    container.innerHTML = `<div data-testid="empty-dialog"></div>`;
    document.body.appendChild(container);

    const dialogEl = container.querySelector("[data-testid=empty-dialog]") as HTMLElement;
    const ref = { current: dialogEl };

    renderHook(() => useFocusTrap(ref, true, vi.fn()));

    // Dialog itself should receive tabindex=-1 and be focused
    expect(dialogEl.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(dialogEl);
  });

  it("restores focus to the opener on unmount", () => {
    // Create a trigger element that had focus before the dialog opened
    const trigger = document.createElement("button");
    trigger.setAttribute("data-testid", "trigger");
    document.body.appendChild(trigger);
    trigger.focus();

    const container = document.createElement("div");
    container.innerHTML = `<div data-testid="dialog"><input type="text" /></div>`;
    document.body.appendChild(container);

    const dialogEl = container.querySelector("[data-testid=dialog]") as HTMLElement;
    const ref = { current: dialogEl };

    const { unmount } = renderHook(() => useFocusTrap(ref, true, vi.fn()));

    // After mount, focus should be on the input (not the trigger)
    expect(document.activeElement).not.toBe(trigger);

    unmount();

    // After unmount, focus should return to the trigger
    expect(document.activeElement).toBe(trigger);
  });

  it("cleans up keydown listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderFocusTrap();

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
