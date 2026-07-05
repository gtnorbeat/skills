#!/usr/bin/env node
// scripts/launch-dev.mjs
// Launch `npm run dev` as a transient systemd --user service so the dev
// server (vite on :5173 + wrangler dev on :8787) survives across
// separate basher invocations. Without this, anything started inside
// `app-code-XXXX.scope` gets reaped when the basher invocation ends.
//
// Mechanism: `systemd-run --user --unit=aura-dev` creates a transient
// service that systemd --user adopts. With `loginctl enable-linger` set
// per user, user@1000.service keeps running after the spawning shell
// exits, so the dev server outlives the basher boundary.
//
// Subcommands:
//   start   boot dev server (default if no subcommand given)
//   stop    stop dev server
//   status  print `systemctl --user status aura-dev`
//   logs    tail last 50 lines from journalctl --user -u aura-dev
//
// Requires (one-time, per user):
//   loginctl enable-linger
// The wrapper runs it defensively on every `start`; safe to repeat.

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Derive the project root from this script's location (scripts/ → workspace root).
// This keeps the path correct regardless of which machine or user runs it.
const PROJECT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const UNIT = "aura-dev";
const LOG_FILE = "/tmp/aura-dev.log";
const ACTION = (process.argv[2] ?? "start").toLowerCase();

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...opts,
  });
}

function systemctlUser(cmd) {
  // systemctl --user reconnects to the user systemd instance; if XDG_RUNTIME_DIR
  // isn't set, systemctl auto-derives it from the current UID via logind.
  try {
    return sh(`systemctl --user ${cmd}`);
  } catch (err) {
    // systemctl returns non-zero for "inactive" units (during stop / after crash).
    // Surface the stderr so the caller can decide; we still return "" on output.
    return (err.stdout ?? "") + (err.stderr ?? "");
  }
}

switch (ACTION) {
  case "start": {
    // 1. Linger — adottare dal user manager anche se la shell è terminata.
    try {
      sh("loginctl enable-linger");
    } catch {
      /* idempotent; safe to fail */
    }
    // 2. Idempotent reset of any prior instance.
    try {
      sh(`systemctl --user stop ${UNIT}`);
    } catch {
      /* unit may not exist yet — fine */
    }
    try {
      sh(`systemctl --user reset-failed ${UNIT}`);
    } catch {
      /* same */
    }
    // 3. Launch as transient --user service. systemd --user adopts it; with
    //    linger enabled, the service survives the spawning shell exiting.
    //    --property Standard{Output,Error}=append:/tmp/aura-dev.log captures
    //    the dev server's actual stdout/stderr there.
    sh(
      `systemd-run --user ` +
        `--unit=${UNIT} ` +
        `--working-directory=${JSON.stringify(PROJECT_DIR)} ` +
        `--setenv=PATH=${JSON.stringify(process.env.PATH ?? "")} ` +
        `--property=StandardOutput=append:${LOG_FILE} ` +
        `--property=StandardError=append:${LOG_FILE} ` +
        `/bin/bash -c 'exec npm run dev'`,
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    // 4. Brief wait + status so the operator sees confirmation.
    sh("sleep 2");
    const state = systemctlUser(`is-active ${UNIT}`);
    console.log(`aura-dev.service: ${state.trim() || "(state unknown)"}`);
    console.log(systemctlUser(`status ${UNIT} --no-pager | head -15`));
    break;
  }

  case "stop": {
    const out = systemctlUser(`stop ${UNIT}`);
    console.log(out.trim() || `stopped ${UNIT}`);
    try {
      sh(`systemctl --user reset-failed ${UNIT}`);
    } catch {
      /* ignore */
    }
    break;
  }

  case "status": {
    const out = systemctlUser(`status ${UNIT} --no-pager`);
    if (out.trim()) console.log(out);
    else console.log(`unit ${UNIT}: not loaded (not started yet?)`);
    break;
  }

  case "logs": {
    try {
      console.log(sh(`journalctl --user -u ${UNIT} --no-pager | tail -50`));
    } catch (err) {
      console.log(`(no journal: ${err.message.trim()})`);
    }
    // Also surface the captured stdout/stderr file if systemd wrote there.
    try {
      const tail = sh(`tail -30 ${LOG_FILE} 2>/dev/null`);
      if (tail.trim()) {
        console.log(`--- ${LOG_FILE} (last 30 lines) ---`);
        console.log(tail);
      }
    } catch {
      /* log file may not exist yet */
    }
    break;
  }

  default:
    console.error(`unknown action: ${ACTION}`);
    console.error(`usage: node scripts/launch-dev.mjs {start|stop|status|logs}`);
    process.exit(2);
}
