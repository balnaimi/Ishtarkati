import { describe, expect, it } from "vitest";
import { accountSearchHaystack, filterFreeAccounts, matchesAccountSearch } from "./accountSearch";

const sample = {
  title: "نشرة Tech Weekly",
  notes: "أخبار تقنية أسبوعية",
  website_url: "https://newsletter.example.com/path",
  account_label: "Me@Example.COM",
  category_name: "إعلام",
};

describe("accountSearchHaystack", () => {
  it("includes hostname extracted from website URL", () => {
    const hay = accountSearchHaystack(sample);
    expect(hay).toContain("newsletter.example.com");
    expect(hay).toContain("نشرة tech weekly");
    expect(hay).toContain("me@example.com");
  });
});

describe("matchesAccountSearch", () => {
  it("matches title substring", () => {
    expect(matchesAccountSearch(sample, "tech")).toBe(true);
    expect(matchesAccountSearch(sample, "نشرة")).toBe(true);
  });

  it("matches hostname without protocol", () => {
    expect(matchesAccountSearch(sample, "newsletter.example")).toBe(true);
  });

  it("matches email case-insensitively", () => {
    expect(matchesAccountSearch(sample, "me@example.com")).toBe(true);
  });

  it("returns true for empty query", () => {
    expect(matchesAccountSearch(sample, "   ")).toBe(true);
  });

  it("returns false when no field matches", () => {
    expect(matchesAccountSearch(sample, "netflix")).toBe(false);
  });
});

describe("filterFreeAccounts", () => {
  const rows = [
    sample,
    {
      title: "GitHub",
      notes: null,
      website_url: "https://github.com",
      account_label: "Me@Example.COM",
      category_name: null,
    },
    {
      title: "Reddit",
      notes: "مجتمعات",
      website_url: null,
      account_label: "other@mail.com",
      category_name: null,
    },
  ];

  it("filters by email then search", () => {
    const out = filterFreeAccounts(rows, {
      email: "Me@Example.COM",
      search: "github",
    });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("GitHub");
  });

  it("filters by search only", () => {
    const out = filterFreeAccounts(rows, { search: "reddit" });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Reddit");
  });

  it("returns all when no filters", () => {
    expect(filterFreeAccounts(rows, {})).toHaveLength(3);
  });
});
