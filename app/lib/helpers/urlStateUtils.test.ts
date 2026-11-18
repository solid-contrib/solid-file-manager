import { describe, expect, it } from "vitest";
import { findStorageFor } from "./urlStateUtils";

const ALICE = { id: "a", url: "https://pod.example/alice/" };
const BOB = { id: "b", url: "https://pod.example/bob/" };
const NESTED = { id: "n", url: "https://pod.example/alice/projects/" };

describe("findStorageFor", () => {
  it.each([
    ["the storage root", "https://pod.example/alice/", ALICE, true],
    ["a folder inside it", "https://pod.example/alice/docs/", ALICE, false],
    ["a file inside it", "https://pod.example/alice/docs/a.txt", ALICE, false],
  ])("matches %s", (_label, candidate, storage, isRoot) => {
    expect(findStorageFor(candidate, [BOB, ALICE])).toEqual({ storage, url: candidate, isRoot });
  });

  it("prefers the most specific storage", () => {
    expect(findStorageFor("https://pod.example/alice/projects/x/", [ALICE, NESTED])?.storage).toBe(NESTED);
  });

  it("normalises dot segments, including encoded ones, before deciding", () => {
    expect(findStorageFor("https://pod.example/alice/../bob/secret", [ALICE])).toBeNull();
    expect(findStorageFor("https://pod.example/alice/%2e%2e/bob/secret", [ALICE])).toBeNull();
    expect(findStorageFor("https://pod.example/alice/docs/../a.txt", [ALICE])?.url).toBe("https://pod.example/alice/a.txt");
  });

  it.each([
    ["a lookalike host", "https://pod.example.evil.example/alice/"],
    ["another port", "https://pod.example:8443/alice/"],
    ["another scheme", "http://pod.example/alice/"],
    ["a sibling path sharing a prefix", "https://pod.example/alice-evil/"],
    ["embedded credentials", "https://user:pass@pod.example/alice/"],
    ["a javascript: URL", "javascript:alert(1)//https://pod.example/alice/"],
    ["something that isn't a URL", "/alice/docs/"],
  ])("rejects %s", (_label, candidate) => {
    expect(findStorageFor(candidate, [ALICE])).toBeNull();
  });

  it("ignores a fragment", () => {
    expect(findStorageFor("https://pod.example/alice/a.txt#x", [ALICE])?.url).toBe("https://pod.example/alice/a.txt");
  });
});
