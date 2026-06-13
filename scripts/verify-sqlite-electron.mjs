#!/usr/bin/env node
/**
 * Verifies better-sqlite3 is built for Electron, not system Node.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const electronBin = path.join(root, "node_modules/electron/dist/electron");
const probePath = path.join(root, "scripts", "_sqlite-electron-probe.cjs");

const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };

const el = spawnSync(electronBin, [probePath], { cwd: root, encoding: "utf8", env });
if (el.status !== 0) {
  const nodeMod = process.versions.modules;
  console.error(
    `[verify-sqlite] verification failed (Node system ABI ${nodeMod}). stderr:\n${el.stderr || ""}\nstdout:\n${el.stdout || ""}`,
  );
  console.error("Run: npx electron-builder install-app-deps");
  process.exit(1);
}

const line = (el.stdout || "").trim().split("\n").pop() || "";
console.log(`[verify-sqlite] ${line}`);
