import { describe, expect, it } from "vitest";
import { filterProfileItems, isProfileItem } from "./fileFilters";

describe("isProfileItem", () => {
  it.each([
    ["https://pod.example/profile/card", undefined, true],
    ["https://pod.example/profile/", undefined, false],
    ["https://pod.example/docs/notes.txt", undefined, false],
    ["https://pod.example/docs/x", "card", true],
  ])("%s (name %s) → %s", (url, name, expected) => {
    expect(isProfileItem(url, name)).toBe(expected);
  });

  // KNOWN BUG (found while adding these tests): this records today's behaviour.
  // Any path containing "/card" is hidden, so a user's own "cardiff.txt"
  // disappears from the listing. Once fixed, this should be false; flip it then.
  it("KNOWN BUG: hides unrelated files whose name starts with 'card'", () => {
    expect(isProfileItem("https://pod.example/cardiff.txt")).toBe(true);
  });
});

describe("filterProfileItems", () => {
  it("removes only the profile card", () => {
    const items = [
      { url: "https://pod.example/profile/card" },
      { url: "https://pod.example/profile/" },
      { url: "https://pod.example/notes.txt" },
    ];
    expect(filterProfileItems(items).map((item) => item.url)).toEqual([
      "https://pod.example/profile/",
      "https://pod.example/notes.txt",
    ]);
  });
});
