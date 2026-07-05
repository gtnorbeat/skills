/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/** A component that throws on render to trigger the ErrorBoundary. */
function ThrowOnRender({ error }: { error: Error }): never {
  throw error;
}

describe("ErrorBoundary — chunk-load detection", () => {
  let originalOnLine: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
    // Default to online
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    }
  });

  it("shows 'Couldn't load this page' for a ChunkLoadError", () => {
    const chunkError = new Error("Loading chunk 42 failed.");
    chunkError.name = "ChunkLoadError";

    render(
      <ErrorBoundary>
        <ThrowOnRender error={chunkError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Couldn't load this page")).toBeInTheDocument();
    // Should show a "Reload page" button, not "Try again"
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows 'Couldn't load this page' for a dynamic import failure", () => {
    const importError = new Error("Failed to fetch dynamically imported module: /assets/foo.js");

    render(
      <ErrorBoundary>
        <ThrowOnRender error={importError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Couldn't load this page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  });

  it("shows offline message when chunk-load fails and navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    const chunkError = new Error("Importing a module script failed.");
    render(
      <ErrorBoundary>
        <ThrowOnRender error={chunkError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Couldn't load this page")).toBeInTheDocument();
    expect(
      screen.getByText(/You're offline and this page hasn't been cached yet/),
    ).toBeInTheDocument();
  });

  it("shows online chunk message when chunk-load fails and navigator.onLine is true", () => {
    const chunkError = new Error("Loading CSS chunk 7 failed.");
    render(
      <ErrorBoundary>
        <ThrowOnRender error={chunkError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Couldn't load this page")).toBeInTheDocument();
    expect(
      screen.getByText(/This page couldn't be loaded — it may have been updated/),
    ).toBeInTheDocument();
  });

  it("shows 'Something went wrong' for a generic render error", () => {
    const genericError = new Error("undefined is not a function");

    render(
      <ErrorBoundary>
        <ThrowOnRender error={genericError} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload page" })).not.toBeInTheDocument();
  });

  it("renders children normally when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello world</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    const chunkError = new Error("Loading chunk 42 failed.");
    chunkError.name = "ChunkLoadError";

    render(
      <ErrorBoundary fallback={<div data-testid="custom">Custom fallback</div>}>
        <ThrowOnRender error={chunkError} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this page")).not.toBeInTheDocument();
  });

  it("calls onError prop when an error is caught", () => {
    const onError = vi.fn();
    const error = new Error("Test error");

    render(
      <ErrorBoundary onError={onError}>
        <ThrowOnRender error={error} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
  });

  it("reload button calls window.location.reload", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      configurable: true,
    });

    const chunkError = new Error("Failed to fetch dynamically imported module: /assets/x.js");
    render(
      <ErrorBoundary>
        <ThrowOnRender error={chunkError} />
      </ErrorBoundary>,
    );

    screen.getByRole("button", { name: "Reload page" }).click();
    expect(reloadSpy).toHaveBeenCalled();
  });
});
