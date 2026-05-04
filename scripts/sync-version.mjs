/**
 * Sync version from package.json -> tauri.conf.json (no semver bump).
 * Run automatically before `npm run build` via prebuild.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const tauriPath = join(root, "src-tauri", "tauri.conf.json");
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = pkg.version;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

const cargoPath = join(root, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoPath, "utf8");
cargoToml = cargoToml.replace(
  /^version = "[^"]+"/m,
  `version = "${pkg.version}"`,
);
writeFileSync(cargoPath, cargoToml);
