/**
 * يحدّث SemVer في package.json و src/version.ts قبل كل `npm run build`.
 *
 * - MAJOR: breaking، أو تغيير ضخم جدًا، أو رسالة تتضمن BREAKING / !:
 * - MINOR: ميزة جديدة/إزالة ميزة، أو رسالة feat:/feature، أو حجم عمل متوسط
 * - PATCH: إصلاحات بسيطة وتعديلات طفيفة
 *
 * تجاوز يدوي: VERSION_BUMP=major|minor|patch
 * بدون رفع: SKIP_VERSION_BUMP=1
 *
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkgPath = join(root, "package.json");
const versionTsPath = join(root, "src", "version.ts");
const VERSION_FILES = new Set(["package.json", "src/version.ts"]);

function git(args) {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function gitOk(args) {
  try {
    execSync(`git ${args}`, { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function numstatFromBlockExcludingVersion(block) {
  if (!block) return { lines: 0, files: 0 };
  let lines = 0;
  let files = 0;
  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const [add, del, file] = line.split("\t");
    if (!file || VERSION_FILES.has(file)) continue;
    if (add === "-" || del === "-") continue;
    lines += (parseInt(add, 10) || 0) + (parseInt(del, 10) || 0);
    files += 1;
  }
  return { lines, files };
}

function diffStatsExcludingVersionFiles(ref) {
  return numstatFromBlockExcludingVersion(git(`diff --numstat ${ref}`));
}

function changedFiles(ref) {
  const out = git(`diff --name-only ${ref}`);
  if (!out) return [];
  return out.split("\n").filter(Boolean);
}

function hasGitRepo() {
  return gitOk("rev-parse --git-dir");
}

/**
 * @returns { 'major' | 'minor' | 'patch' | 'skip' }
 */
function decideBumpKind() {
  const env = (process.env.VERSION_BUMP || "").toLowerCase().trim();
  if (env === "major" || env === "minor" || env === "patch") {
    return /** @type {const} */ (env);
  }

  if (!hasGitRepo()) {
    console.warn("[version] ليس مستودع git — استُخدم patch");
    return "patch";
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const version = pkg.version;
  const unstaged = changedFiles("HEAD");
  const dirtyNames = new Set([...unstaged]);
  const hasUncommittedChanges = dirtyNames.size > 0;

  /**
   * تخطّي الرفع فقط عندما لا يوجد أي تغيير غير مُلتزم به.
   * سابقًا كان الشرط يُنفَّذ قبل فحص الملفات المعدّلة فيطابق «Release X = الإصدار الحالي»
   * ويُلغي الرفع حتى مع وجود تعديلات محلية — فلا يفرّق المستخدم بين البنيات.
   */
  if (!hasUncommittedChanges) {
    const subject = git("log -1 --format=%s") || "";
    const releaseMatch = /^Release (\d+\.\d+\.\d+)/.exec(subject);
    if (releaseMatch && releaseMatch[1] === version) {
      console.log(
        `[version] الإصدار ${version} يطابق آخر commit إصدار والفرع نظيف — لم يُرفع الرقم (إعادة بناء نفس النسخة).`,
      );
      return "skip";
    }
  }

  const onlyMetaDirty =
    dirtyNames.size > 0 && [...dirtyNames].every((f) => VERSION_FILES.has(f));
  if (onlyMetaDirty) {
    console.log("[version] التغييرات على ملفات الإصدار فقط — تخطي رفع الإصدار.");
    return "skip";
  }

  let lines;
  let files;
  if (hasUncommittedChanges) {
    ({ lines, files } = diffStatsExcludingVersionFiles("HEAD"));
  } else if (gitOk("rev-parse --verify HEAD~1")) {
    ({ lines, files } = diffStatsExcludingVersionFiles("HEAD~1..HEAD"));
  } else {
    const show = git("show --numstat --format= HEAD");
    ({ lines, files } = numstatFromBlockExcludingVersion(show));
  }

  const s = (git("log -1 --format=%s") || "").trim();
  if (/\bBREAKING\b|!:/.test(s)) {
    console.log("[version] قرار: major — breaking في رسالة الـ commit.");
    return "major";
  }

  if (/^(feat|feature)(\(.+\))?:/i.test(s)) {
    console.log("[version] قرار: minor — feat/feature في رسالة الـ commit.");
    return "minor";
  }

  if (/^(fix|hotfix|bugfix)(\(.+\))?:/i.test(s)) {
    if (lines > 800 || files > 30) {
      console.log("[version] قرار: minor — fix لكن حجم التغيير كبير.");
      return "minor";
    }
    console.log("[version] قرار: patch — إصلاح بحجم معقول.");
    return "patch";
  }

  if (lines >= 1500 || files >= 45) {
    console.log(
      `[version] قرار: major — حجم كبير (~${lines} سطر، ${files} ملف تقريبًا).`,
    );
    return "major";
  }

  if (lines >= 90 || files >= 7) {
    console.log(
      `[version] قرار: minor — حجم متوسط (~${lines} سطر، ${files} ملف).`,
    );
    return "minor";
  }

  console.log(
    `[version] قرار: patch — تغيير بسيط (~${lines} سطر، ${files} ملف).`,
  );
  return "patch";
}

function applySemver(major, minor, patch, kind) {
  if (kind === "major") return [major + 1, 0, 0];
  if (kind === "minor") return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

if (process.env.SKIP_VERSION_BUMP === "1") {
  console.log("SKIP_VERSION_BUMP=1 — الإصدار دون تعديل");
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const parts = pkg.version.split(".").map((x) => parseInt(x, 10));
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  console.error(`package.json version غير صالح: ${pkg.version} (يلزم major.minor.patch)`);
  process.exit(1);
}

let [major, minor, patch] = parts;
const kind = decideBumpKind();

if (kind === "skip") {
  process.exit(0);
}

const nextParts = applySemver(major, minor, patch, kind);
const next = `${nextParts[0]}.${nextParts[1]}.${nextParts[2]}`;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

writeFileSync(
  versionTsPath,
  `/** App version — synced from package.json (see scripts/bump-version-for-build.mjs / bump-version.mjs). */\nexport const APP_VERSION = "${next}";\n`,
);

console.log(`Build version → ${next} (${kind})`);
