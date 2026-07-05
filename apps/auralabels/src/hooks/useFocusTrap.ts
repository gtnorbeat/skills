import { useEffect, useRef, type RefObject } from "react";

/**
 * Focus-trap + Esc-to-close hook for AURA's modal surfaces.
 *
 * Behaviour:
 *  - On mount: snapshot `document.activeElement` (the control that opened
 *    the dialog). Move focus to the first focusable inside `dialogRef` so
 *    screen-reader users land inside the dialog immediately.
 *  - During the dialog's lifetime: cycle Tab / Shift+Tab through the
 *    focusable elements contained in `dialogRef` so the page background
 *    (Sidebar nav, Header, etc.) cannot pick up Tab traversal while the
 *    dialog sits over the chrome at z-50/60.
 *  - On Esc: invoke `onEsc` exactly once.
 *  - On unmount: restore focus to the original opener so keyboard users
 *    return to where they came from (this is the WCAG 2.4.3 / 2.1.2 must).
 *
 * The hook early-returns when `active` is false, so callers can pass a
 * stable Boolean without invoking the effect on every render.
 *
 * Focusable selector mirrors the convention used by MobileDrawer:
 * anchor / button / input / select / textarea (non-disabled) and any
 * element with an explicit tabindex. The dialog itself (ref root) gets
 * a fall-through `tabindex="-1"` so it can receive focus when it has no
 * focusable children — e.g. an empty state.
 *
 * IMPORTANT: `onEsc` is stored in a ref so it doesn't appear in the
 * dependency array. If `onEsc` were a dep, every parent render that
 * passes an inline arrow function would re-run the effect — ripping
 * focus away from the input on every keystroke and causing the cursor
 * to jump out of the typing box.
 */
export function useFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEsc: () => void,
): void {
  // Store the latest onEsc in a ref so the effect doesn't need to
  // re-subscribe when onEsc changes reference (e.g. inline arrows).
  // This prevents the focus-rip / cursor-jump bug on every keystroke.
  const onEscRef = useRef(onEsc);
  onEscRef.current = onEsc;

  useEffect(() => {
    if (!active) return;
    const root = dialogRef.current;
    if (!root) return;

    const trigger = document.activeElement as HTMLElement | null;

    const FOCUSABLE_SELECTOR =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusables = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initial = getFocusables();
    if (initial.length > 0) {
      initial[0].focus();
    } else {
      root.setAttribute("tabindex", "-1");
      root.focus();
    }

    function onKey(e: KeyboardEvent): void {
      // Escape closes; reads onEsc from the ref so we always call
      // the latest callback without the effect depending on it.
      if (e.key === "Escape") {
        e.preventDefault();
        onEscRef.current();
        return;
      }
      // Tab / Shift+Tab cycles the focusable set inside the dialog.
      if (e.key !== "Tab") return;
      const nodes = getFocusables();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const ae = document.activeElement as HTMLElement | null;
      if (e.shiftKey && ae === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && ae === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus to whatever triggered the dialog; <el>.focus()
      // silently no-ops on detached nodes, so no try/catch is needed.
      trigger?.focus?.();
    };
  }, [active, dialogRef]); // onEsc deliberately omitted — see doc comment above
}
