/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LoginPage } from "@/components/auth/LoginPage";

describe("LoginPage form rendering", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders username and password inputs and a sign-in button", () => {
    render(<LoginPage onLogin={vi.fn()} />);

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("renders the remember-me checkbox unchecked by default", () => {
    render(<LoginPage onLogin={vi.fn()} />);

    const checkbox = screen.getByLabelText("Remember me") as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it("shows an error when submitting with empty fields", () => {
    render(<LoginPage onLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter username and password",
    );
  });
});

describe("LoginPage form submission", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", token: "mock-jwt" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends username and password in the request body", async () => {
    render(<LoginPage onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/login");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ username: "admin", password: "secret" });
  });

  it("sends rememberMe: true when the remember-me checkbox is checked", async () => {
    render(<LoginPage onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "gaetano" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByLabelText("Remember me"));
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ rememberMe: true });
  });

  it("sends rememberMe: false when the remember-me checkbox is unchecked", async () => {
    render(<LoginPage onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "gaetano" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    // Checkbox starts unchecked — do not click it.
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.rememberMe).toBe(false);
  });

  it("calls onLogin with the token and username on success", async () => {
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "gaetano" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(
        "mock-jwt",
        "gaetano",
        undefined, // rememberMe not checked → server returns undefined
      );
    });
  });
});

describe("LoginPage error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 'Incorrect username or password' on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ status: "error", message: "Invalid credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Incorrect username or password",
      );
    });
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows a server-unreachable error when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network failure"),
    );

    render(<LoginPage onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Cannot reach the server",
      );
    });
  });

  it("shows a custom server error message on non-401 failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "error",
          message: "Too many login attempts. Please try again in 15 minutes.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<LoginPage onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Too many login attempts",
      );
    });
  });
});
