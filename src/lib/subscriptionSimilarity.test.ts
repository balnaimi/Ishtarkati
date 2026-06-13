import { describe, expect, it } from "vitest";
import {
  areSubscriptionsSimilar,
  findSimilarInList,
  hostnameNorm,
  subscriptionSimilarityKey,
} from "./subscriptionSimilarity";

describe("hostnameNorm", () => {
  it("strips www and protocol", () => {
    expect(hostnameNorm("https://www.Netflix.com/path")).toBe("netflix.com");
  });
});

describe("subscriptionSimilarityKey", () => {
  it("combines title host and account", () => {
    const k = subscriptionSimilarityKey("Netflix", "https://netflix.com", "me@test.com");
    expect(k).toContain("netflix");
    expect(k).toContain("netflix.com");
    expect(k).toContain("me@test.com");
  });
});

describe("areSubscriptionsSimilar", () => {
  it("matches same site and title", () => {
    expect(
      areSubscriptionsSimilar(
        { title: "Netflix", website_url: "https://netflix.com", account_label: null },
        { title: "netflix", website_url: "www.netflix.com", account_label: null },
      ),
    ).toBe(true);
  });

  it("excludes same id", () => {
    expect(
      areSubscriptionsSimilar(
        { id: 1, title: "A", website_url: null, account_label: null },
        { id: 1, title: "A", website_url: null, account_label: null },
      ),
    ).toBe(false);
  });
});

describe("findSimilarInList", () => {
  const rows = [
    { id: 1, title: "Spotify", website_url: "https://spotify.com", account_label: "a@b.com" },
    { id: 2, title: "Other", website_url: null, account_label: null },
  ];

  it("finds similar rows", () => {
    const out = findSimilarInList(rows, {
      title: "spotify",
      website_url: "spotify.com",
      account_label: "a@b.com",
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });
});
