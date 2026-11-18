import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadManualStorages, normaliseStorageUrl, saveManualStorage, storageProblem } from "./manualStorages";

const ESS = "https://storage.example.org/01EXAMPLESTORAGEID0000000000/sp/";

describe("normaliseStorageUrl", () => {
  it.each([
    [ESS, ESS],
    [`  ${ESS.slice(0, -1)}  `, ESS],
    [`${ESS}#me`, ESS],
    ["http://localhost:3000/tester", "http://localhost:3000/tester/"],
  ])("%s → %s", (input, url) => {
    expect(normaliseStorageUrl(input)).toEqual({ url });
  });

  it.each([
    ["storage.example.org/pod/", "Enter a full URL, starting with https://"],
    ["http://storage.example.org/pod/", "The storage URL must start with https://"],
    ["ftp://storage.example.org/", "The storage URL must start with https://"],
  ])("rejects %s", (input, error) => {
    expect(normaliseStorageUrl(input)).toEqual({ error });
  });
});

describe("storageProblem", () => {
  const response = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers });

  it.each([
    ["an LDP container", response(200, { Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' }), null],
    ["an RDF response", response(200, { "Content-Type": "text/turtle; charset=utf-8" }), null],
    ["an HTML page", response(200, { "Content-Type": "text/html" }), "That URL isn't a Solid storage folder."],
    ["a 403", response(403), "You don't have access to that storage."],
    ["a 404", response(404), "No storage found at that URL (404)."],
  ])("%s → %s", (_label, res, problem) => {
    expect(storageProblem(res)).toBe(problem);
  });
});

describe("manual storages", () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    });
  });

  it("remembers storages per WebID, without duplicates", () => {
    saveManualStorage("https://id.example/alice", ESS);
    saveManualStorage("https://id.example/alice", ESS);

    expect(loadManualStorages("https://id.example/alice")).toEqual([ESS]);
    expect(loadManualStorages("https://id.example/bob")).toEqual([]);
  });

  it("copes with unusable browser storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "not json",
      setItem: () => {
        throw new Error("quota");
      },
    });

    expect(loadManualStorages("https://id.example/alice")).toEqual([]);
    expect(saveManualStorage("https://id.example/alice", ESS)).toEqual([ESS]);
  });
});
