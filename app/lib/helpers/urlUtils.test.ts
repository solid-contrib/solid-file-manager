import { describe, expect, it } from "vitest";
import { extractNameFromUrl, isBinaryFile, isLikelyFile, resolveUrl } from "./urlUtils";

describe("extractNameFromUrl", () => {
  it.each([
    ["https://pod.example/docs/report.pdf", "report.pdf"],
    ["https://pod.example/docs/My%20Folder/", "My Folder"],
    ["https://pod.example/", "pod.example"],
    ["https://pod.example/bad%E0%A4%A", "bad%E0%A4%A"],
    ["not/a/url/name", "name"],
  ])("%s → %s", (url, expected) => {
    expect(extractNameFromUrl(url)).toBe(expected);
  });
});

describe("resolveUrl", () => {
  it("resolves relative URLs against the base and returns the input when it cannot", () => {
    expect(resolveUrl("child.txt", "https://pod.example/docs/")).toBe("https://pod.example/docs/child.txt");
    expect(resolveUrl("https://other.example/x", "https://pod.example/")).toBe("https://other.example/x");
    expect(resolveUrl("child.txt", "not a base")).toBe("child.txt");
  });
});

describe("isBinaryFile", () => {
  it.each([
    ["https://pod.example/.DS_Store", true],
    ["https://pod.example/photos/Thumbs.db", true],
    ["https://pod.example/repo/.git/config", true],
    ["https://pod.example/notes.ttl", false],
  ])("%s → %s", (url, expected) => {
    expect(isBinaryFile(url)).toBe(expected);
  });
});

describe("isLikelyFile", () => {
  it.each([
    ["https://pod.example/a/report.PDF", true],
    ["https://pod.example/a/data.ttl", false],
    ["https://pod.example/a/folder/", false],
  ])("%s → %s", (url, expected) => {
    expect(isLikelyFile(url)).toBe(expected);
  });
});
