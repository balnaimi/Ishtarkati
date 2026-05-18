import { describe, expect, it } from "vitest";
import { normalizeSyncBaseUrl, semverGte } from "./syncUtil";

describe("normalizeSyncBaseUrl", () => {
  it("adds http when scheme missing", () => {
    expect(normalizeSyncBaseUrl("localhost:8080")).toBe("http://localhost:8080");
  });

  it("preserves https", () => {
    expect(normalizeSyncBaseUrl("https://sync.example.com/")).toBe("https://sync.example.com");
  });

  it("trims trailing slashes", () => {
    expect(normalizeSyncBaseUrl("http://host///")).toBe("http://host");
  });
});

describe("semverGte", () => {
  it("compares patch levels", () => {
    expect(semverGte("1.2.3", "1.2.2")).toBe(true);
    expect(semverGte("1.2.2", "1.2.3")).toBe(false);
  });

  it("compares minor levels", () => {
    expect(semverGte("1.3.0", "1.2.9")).toBe(true);
  });
});
