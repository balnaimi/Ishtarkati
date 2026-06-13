#!/usr/bin/env node
/**
 * git filter-branch --msg-filter helper: rewrite known Arabic commit messages.
 * Reads original message from stdin; writes replacement to stdout.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hasArabicScript } from "./validate-commit-message.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rewrites = JSON.parse(
  readFileSync(join(root, "scripts/commit-message-rewrites.json"), "utf8"),
);

function rewriteSubject(subject) {
  if (rewrites[subject]) return rewrites[subject];
  if (!hasArabicScript(subject)) return subject;
  const release = /^Release (\d+\.\d+\.\d+) —/.exec(subject);
  if (release) return `Release ${release[1]} — workspace`;
  throw new Error(`unmapped Arabic subject: ${subject}`);
}

function rewriteFullMessage(input) {
  const normalized = input.replace(/\n$/, "");
  const lines = normalized.split("\n");
  const subject = lines[0] ?? "";
  const newSubject = rewriteSubject(subject);

  const keptTail = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      keptTail.push(line);
      continue;
    }
    if (/^Co-authored-by:/i.test(line)) {
      keptTail.push(line);
      continue;
    }
    if (!hasArabicScript(line)) {
      keptTail.push(line);
    }
  }

  while (keptTail.length > 0 && keptTail[0].trim() === "") {
    keptTail.shift();
  }
  while (keptTail.length > 0 && keptTail[keptTail.length - 1].trim() === "") {
    keptTail.pop();
  }

  if (keptTail.length === 0) {
    return `${newSubject}\n`;
  }
  return `${newSubject}\n\n${keptTail.join("\n")}\n`;
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const firstLine = input.replace(/\n$/, "").split("\n")[0] ?? "";
    if (!hasArabicScript(input) && !rewrites[firstLine]) {
      process.stdout.write(input.endsWith("\n") ? input : `${input}\n`);
      return;
    }
    process.stdout.write(rewriteFullMessage(input));
  } catch (e) {
    process.stderr.write(
      `[commit-msg-filter] ${e instanceof Error ? e.message : String(e)}\n`,
    );
    process.exit(1);
  }
});
