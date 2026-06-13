import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { formatUiError } from "./uiErrors";

describe("formatUiError", () => {
  const t = i18n.getFixedT("ar");

  it("maps IPC codes", () => {
    expect(formatUiError(t, "no-database")).toBe(t("errors.noDatabase"));
    expect(formatUiError(t, "bad_pin")).toBe(t("errors.badPin"));
  });

  it("maps backup messages", () => {
    expect(formatUiError(t, "Invalid backup file")).toBe(t("errors.backupInvalidFile"));
    expect(formatUiError(t, "Unsupported backup version: 99")).toBe(
      t("errors.backupUnsupportedVersion"),
    );
  });

  it("maps FX errors", () => {
    expect(formatUiError(t, "Missing FX rate for XYZ")).toBe(t("fx.rateMissingHint"));
  });

  it("falls back to generic for unknown English", () => {
    expect(formatUiError(t, "Something broke internally")).toBe(t("errors.generic"));
  });
});
