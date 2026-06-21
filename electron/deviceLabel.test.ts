import { describe, expect, it } from "vitest";
import {
  autoBackupHistoryPrefix,
  autoBackupStampedFilename,
  latestBackupFilename,
  manualBackupStampedFilename,
  sanitizeDeviceLabelForFilename,
} from "./deviceLabel";

describe("sanitizeDeviceLabelForFilename", () => {
  it("keeps Arabic and Latin labels", () => {
    expect(sanitizeDeviceLabelForFilename("البيت", "pc")).toBe("البيت");
    expect(sanitizeDeviceLabelForFilename("Home PC", "pc")).toBe("Home-PC");
  });

  it("strips path characters and collapses spaces", () => {
    expect(sanitizeDeviceLabelForFilename("my/laptop: test", "fallback")).toBe("mylaptop-test");
  });

  it("falls back to hostname when empty", () => {
    expect(sanitizeDeviceLabelForFilename("", "workstation")).toBe("workstation");
  });
});

describe("backup filenames", () => {
  const label = "البيت";

  it("builds latest, auto, and manual names", () => {
    expect(latestBackupFilename(label)).toBe("ishtarkati-latest-البيت.json");
    expect(autoBackupStampedFilename(label, "2026-06-07T12-00-00")).toBe(
      "ishtarkati-auto-البيت-2026-06-07T12-00-00.json",
    );
    expect(manualBackupStampedFilename(label, "2026-06-07T12-00-00")).toBe(
      "ishtarkati-manual-البيت-2026-06-07T12-00-00.json",
    );
    expect(autoBackupHistoryPrefix(label)).toBe("ishtarkati-auto-البيت-");
  });
});
