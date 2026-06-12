#!/usr/bin/env node
/**
 * Cross-platform production build (CI + local).
 * Usage: node scripts/platform-build.mjs linux|win|mac
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.argv[2];

const builders = {
  linux: "npx electron-builder --linux AppImage",
  win: "npx electron-builder --win nsis --x64",
  mac: "npx electron-builder --mac dmg --arm64",
};

if (!builders[platform]) {
  console.error(`[platform-build] unknown platform: ${platform}`);
  process.exit(1);
}

const isCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
const prebuild = isCi ? "npm run rebuild:native" : "npm run prebuild:app";

const steps = [prebuild, "npx tsc", "npx vite build", builders[platform]];

for (const step of steps) {
  console.log(`[platform-build] ${step}`);
  execSync(step, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    // npm is npm.cmd on Windows — needs a shell
    shell: true,
  });
}
