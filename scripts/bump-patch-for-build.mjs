/**
 * Raises PATCH by 1 in package.json and src/version.ts (same rules as bump-version patch).
 * Skipped when SKIP_VERSION_BUMP=1 (e.g. repro builds).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.SKIP_VERSION_BUMP === "1") {
  console.log("SKIP_VERSION_BUMP=1 — version unchanged");
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const parts = pkg.version.split(".").map((x) => parseInt(x, 10));
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  console.error(`Invalid package.json version: ${pkg.version} (need major.minor.patch)`);
  process.exit(1);
}
const [major, minor, patch] = parts;
const next = `${major}.${minor}.${patch + 1}`;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const versionTsPath = join(root, "src", "version.ts");
writeFileSync(
  versionTsPath,
  `/** App version — synced from package.json (see scripts/bump-patch-for-build.mjs / bump-version.mjs). */\nexport const APP_VERSION = "${next}";\n`,
);

console.log(`Build version → ${next}`);
