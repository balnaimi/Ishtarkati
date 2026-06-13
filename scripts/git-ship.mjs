/**
 * git add -A → commit (if changes) → git push origin HEAD
 * Expects package.json version to already be bumped (e.g. via bump-version-for-build.mjs).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function sh(cmd, args, inherit = true) {
  execFileSync(cmd, args, {
    cwd: root,
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const v = pkg.version;

try {
  sh("git", ["add", "-A"]);
} catch {
  console.error("[ship] git add failed");
  process.exit(1);
}

const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
  cwd: root,
  encoding: "utf8",
}).trim();

if (!staged) {
  console.log("[ship] nothing staged — pushing only");
} else {
  try {
    sh("git", ["commit", "-m", `Release ${v} — workspace`]);
  } catch {
    console.error("[ship] git commit failed");
    process.exit(1);
  }
}

try {
  sh("git", ["push", "origin", "HEAD"]);
} catch {
  console.error("[ship] git push failed — check network or SSH");
  process.exit(1);
}

const tag = `v${v}`;
try {
  const existing = execFileSync("git", ["tag", "-l", tag], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (!existing) {
    sh("git", ["tag", tag]);
  }
  sh("git", ["push", "origin", tag]);
  console.log(`[ship] pushed tag ${tag} (triggers GitHub Release workflow)`);
} catch {
  console.error(`[ship] branch pushed but tag ${tag} failed — create manually: git tag ${tag} && git push origin ${tag}`);
  process.exit(1);
}

console.log(`[ship] pushed current branch (version ${v})`);
