/**
 * Bump semver in package.json, src/version.ts, and sync tauri.conf.json.
 * Usage: npm run version:bump -- patch|minor|major
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const part = (process.argv[2] || "patch").toLowerCase();

if (!["patch", "minor", "major"].includes(part)) {
  console.error("Usage: node scripts/bump-version.mjs [patch|minor|major]");
  process.exit(1);
}

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [maj, min, pat] = pkg.version.split(".").map((x) => parseInt(x, 10));
let major = maj;
let minor = min;
let patch = pat;
if (part === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (part === "minor") {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}
const next = `${major}.${minor}.${patch}`;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const versionTsPath = join(root, "src", "version.ts");
writeFileSync(
  versionTsPath,
  `/** App version — keep in sync with package.json (see scripts/bump-version.mjs). */\nexport const APP_VERSION = "${next}";\n`,
);

const tauriPath = join(root, "src-tauri", "tauri.conf.json");
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = next;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

const cargoPath = join(root, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoPath, "utf8");
cargoToml = cargoToml.replace(
  /^version = "[^"]+"/m,
  `version = "${next}"`,
);
writeFileSync(cargoPath, cargoToml);

console.log(`Bumped to ${next}`);
