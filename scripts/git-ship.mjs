/**
 * git add -A → commit (إن وُجدت تغييرات) → git push origin HEAD
 * يُفترض أن يكون الإصدار في package.json محدثًا مسبقًا (مثلًا عبر bump-version-for-build.mjs).
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
  console.log("[ship] لا شيء في الـ index للالتزام — يُجرى push فقط");
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
  console.error("[ship] git push failed — تحقّق من الشبكة أو SSH");
  process.exit(1);
}

console.log(`[ship] تمّ push للفرع الحالي (إصدار ${v})`);
