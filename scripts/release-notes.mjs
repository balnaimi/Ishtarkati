/**
 * Promotes CHANGELOG [Unreleased] → [version], writes release-notes/v{version}.md
 * for GitHub Releases (body_path in .github/workflows/release.yml).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = join(root, "CHANGELOG.md");
const notesDir = join(root, "release-notes");

const UNRELEASED_HEADING = "## [Unreleased]";

function readChangelog() {
  if (!existsSync(changelogPath)) {
    throw new Error("CHANGELOG.md is missing — create it before shipping a release.");
  }
  return readFileSync(changelogPath, "utf8");
}

function writeChangelog(text) {
  writeFileSync(changelogPath, text.endsWith("\n") ? text : `${text}\n`);
}

function versionHeadingRegex(version) {
  const esc = version.replace(/\./g, "\\.");
  return new RegExp(`^## \\[${esc}\\](?:\\s*-\\s*\\d{4}-\\d{2}-\\d{2})?\\s*$`, "m");
}

/** @returns {{ heading: string, start: number, end: number, body: string } | null} */
function findVersionSection(text, version) {
  const re = versionHeadingRegex(version);
  const match = re.exec(text);
  if (!match) return null;
  const idx = match.index;
  const heading = match[0];
  const start = idx + heading.length;
  const rest = text.slice(start);
  const next = rest.search(/\n## \[/);
  const end = next < 0 ? text.length : start + next;
  const body = text.slice(start, end).trim();
  return { heading, start: idx, end, body };
}

/** @returns {{ start: number, end: number, body: string } | null} */
function findUnreleasedSection(text) {
  const idx = text.indexOf(UNRELEASED_HEADING);
  if (idx < 0) return null;
  const start = idx + UNRELEASED_HEADING.length;
  const rest = text.slice(start);
  const next = rest.search(/\n## \[/);
  const end = next < 0 ? text.length : start + next;
  const body = text.slice(start, end).trim();
  return { start: idx, end, body };
}

function hasSubstance(body) {
  return body.split("\n").some((line) => /^[-*]/.test(line.trim()) || /^###/.test(line.trim()));
}

/**
 * If [Unreleased] has bullets and [version] is missing or empty, promote Unreleased.
 * @returns {string} updated changelog text
 */
export function finalizeChangelog(version) {
  let text = readChangelog();
  const existing = findVersionSection(text, version);
  if (existing?.body && hasSubstance(existing.body)) {
    return text;
  }

  const unreleased = findUnreleasedSection(text);
  if (!unreleased?.body || !hasSubstance(unreleased.body)) {
    throw new Error(
      `[release-notes] No release notes for ${version}. Add bullets under "## [Unreleased]" in CHANGELOG.md (Added / Changed / Fixed) before npm run build:release.`,
    );
  }

  const datedHeading = `## [${version}] - ${new Date().toISOString().slice(0, 10)}`;
  const promoted = `${datedHeading}\n\n${unreleased.body.trim()}\n`;
  const before = text.slice(0, unreleased.start);
  const after = text.slice(unreleased.end);
  const freshUnreleased = `${UNRELEASED_HEADING}\n\n`;
  text = `${before}${freshUnreleased}\n${promoted}${after.replace(/^\n+/, "")}`;
  writeChangelog(text);
  console.log(`[release-notes] promoted [Unreleased] → [${version}] in CHANGELOG.md`);
  return text;
}

/** @returns {string} markdown body for GitHub Release */
export function extractVersionNotes(version, changelogText = readChangelog()) {
  const section = findVersionSection(changelogText, version);
  if (!section?.body || !hasSubstance(section.body)) {
    throw new Error(`[release-notes] CHANGELOG.md has no substantive section for [${version}].`);
  }
  return section.body.trim();
}

/** Writes release-notes/v{version}.md (tag is vX.Y.Z on GitHub). */
export function writeReleaseNotesFile(version) {
  const text = finalizeChangelog(version);
  const body = extractVersionNotes(version, text);
  mkdirSync(notesDir, { recursive: true });
  const tag = `v${version}`;
  const outPath = join(notesDir, `${tag}.md`);
  const file = `# Ishtarkati ${version}\n\n${body}\n`;
  writeFileSync(outPath, file);
  console.log(`[release-notes] wrote ${outPath}`);

  const arPending = join(notesDir, "ar-pending.md");
  const arOut = join(notesDir, `${tag}.ar.md`);
  if (existsSync(arPending) && !existsSync(arOut)) {
    const arTemplate = readFileSync(arPending, "utf8").replaceAll("{{version}}", version);
    writeFileSync(arOut, arTemplate.endsWith("\n") ? arTemplate : `${arTemplate}\n`);
    console.log(`[release-notes] wrote ${arOut}`);
  }

  return outPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2];
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error("Usage: node scripts/release-notes.mjs <major.minor.patch>");
    process.exit(1);
  }
  try {
    writeReleaseNotesFile(version);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
