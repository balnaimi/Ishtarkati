#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { assertEnglishCommitMessage } from "./validate-commit-message.mjs";

const msgFile = process.argv[2];
if (!msgFile) process.exit(0);
try {
  assertEnglishCommitMessage(readFileSync(msgFile, "utf8"));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
