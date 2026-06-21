import { describe, expect, it } from "vitest";
import {
  hostnameFromWebsiteUrl,
  normalizeWebsiteUrlForStorage,
  websiteUrlForFormInput,
  websiteUrlForHref,
} from "./siteFavicon";

describe("normalizeWebsiteUrlForStorage", () => {
  it("adds https when scheme is missing", () => {
    expect(normalizeWebsiteUrlForStorage("netflix.com")).toBe("https://netflix.com");
    expect(normalizeWebsiteUrlForStorage("www.example.com/path")).toBe(
      "https://www.example.com/path",
    );
  });

  it("preserves explicit http(s)", () => {
    expect(normalizeWebsiteUrlForStorage("https://a.com")).toBe("https://a.com");
    expect(normalizeWebsiteUrlForStorage("http://b.com")).toBe("http://b.com");
  });

  it("returns null for blank input", () => {
    expect(normalizeWebsiteUrlForStorage("")).toBeNull();
    expect(normalizeWebsiteUrlForStorage("   ")).toBeNull();
  });
});

describe("websiteUrlForFormInput", () => {
  it("strips protocol for editing", () => {
    expect(websiteUrlForFormInput("https://netflix.com")).toBe("netflix.com");
  });
});

describe("websiteUrlForHref", () => {
  it("returns a clickable URL", () => {
    expect(websiteUrlForHref("netflix.com")).toBe("https://netflix.com");
  });
});

describe("hostnameFromWebsiteUrl", () => {
  it("works without protocol", () => {
    expect(hostnameFromWebsiteUrl("Netflix.com")).toBe("netflix.com");
  });
});
