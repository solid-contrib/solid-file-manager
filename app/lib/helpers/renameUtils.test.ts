import { describe, expect, it } from "vitest";
import { fakeFetch } from "../testing/fakeFetch";
import { NameTakenError, renameResource } from "./renameUtils";

const FOLDER = "https://pod.example/docs/";
const FILE = `${FOLDER}notes.txt`;
const RENAMED = `${FOLDER}plans%202026.txt`;

/**
 * A pod holding `docs/notes.txt`. `onPut` answers the PUT of the renamed copy
 * (or throws, as a network failure would); `deleteStatus` answers the DELETE
 * of the original.
 */
function pod({ onPut = () => new Response(null, { status: 201 }), deleteStatus = 205 }: {
  onPut?: (request: Request) => Response;
  deleteStatus?: number;
} = {}) {
  const puts: { url: string; ifNoneMatch: string | null; contentType: string | null; body: string }[] = [];
  const deleteIfMatch: (string | null)[] = [];
  const { fetch, calls } = fakeFetch(async (request) => {
    if (request.method === "GET" && request.url === FILE) {
      return new Response("hello", { headers: { "Content-Type": "text/plain", ETag: '"v1"' } });
    }
    if (request.method === "PUT") {
      puts.push({
        url: request.url,
        ifNoneMatch: request.headers.get("If-None-Match"),
        contentType: request.headers.get("Content-Type"),
        body: await request.text(),
      });
      return onPut(request);
    }
    if (request.method === "DELETE") {
      deleteIfMatch.push(request.headers.get("If-Match"));
      return new Response(null, { status: deleteStatus });
    }
    return new Response(null, { status: 404 });
  });
  const deletes = () => calls.filter((call) => call.startsWith("DELETE"));
  return { fetch, puts, deletes, deleteIfMatch };
}

describe("renameResource (files)", () => {
  it("creates the renamed copy without overwriting anything, then removes the unchanged original", async () => {
    const { fetch, puts, deletes, deleteIfMatch } = pod();

    expect(await renameResource({ url: FILE }, "plans 2026.txt", fetch)).toEqual({ url: RENAMED, sourceRemoved: true });
    expect(puts).toEqual([{ url: RENAMED, ifNoneMatch: "*", contentType: "text/plain", body: "hello" }]);
    expect(deletes()).toEqual([`DELETE ${FILE}`]);
    expect(deleteIfMatch).toEqual(['"v1"']);
  });

  it("keeps the original when the server gives no ETag to check it against", async () => {
    const { fetch, calls } = fakeFetch((request) => {
      if (request.method === "GET") return new Response("hello", { headers: { "Content-Type": "text/plain" } });
      if (request.method === "PUT") return new Response(null, { status: 201 });
      return new Response(null, { status: 205 });
    });

    expect(await renameResource({ url: FILE }, "plans 2026.txt", fetch)).toEqual({
      url: RENAMED,
      sourceRemoved: false,
      keptBecause: "unverified",
    });
    expect(calls.filter((call) => call.startsWith("DELETE"))).toEqual([]);
  });

  it("keeps the original if someone changed it while it was being copied", async () => {
    const { fetch } = pod({ deleteStatus: 412 });

    expect(await renameResource({ url: FILE }, "plans 2026.txt", fetch)).toEqual({
      url: RENAMED,
      sourceRemoved: false,
      keptBecause: "changed",
    });
  });

  it.each([412, 409])("refuses a name that is already taken (%i) and keeps the original", async (status) => {
    const { fetch, deletes } = pod({ onPut: () => new Response(null, { status }) });

    await expect(renameResource({ url: FILE }, "plans 2026.txt", fetch)).rejects.toThrow(NameTakenError);
    expect(deletes()).toEqual([]);
  });

  it.each([403, 500])("keeps the original when the copy is refused (%i)", async (status) => {
    const { fetch, deletes } = pod({ onPut: () => new Response(null, { status }) });

    await expect(renameResource({ url: FILE }, "plans 2026.txt", fetch)).rejects.toThrow(`(${status})`);
    expect(deletes()).toEqual([]);
  });

  it("keeps the original when it can't tell whether the copy arrived", async () => {
    const { fetch, deletes } = pod({
      onPut: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await expect(renameResource({ url: FILE }, "plans 2026.txt", fetch)).rejects.toThrow(/original was kept/);
    expect(deletes()).toEqual([]);
  });

  it("reports when the copy was saved but the original couldn't be removed", async () => {
    const { fetch } = pod({ deleteStatus: 500 });

    expect(await renameResource({ url: FILE }, "plans 2026.txt", fetch)).toEqual({
      url: RENAMED,
      sourceRemoved: false,
      keptBecause: "failed",
    });
  });
});

describe("renameResource (folders)", () => {
  it.each([412, 409])("refuses a name that is already taken (%i), without copying or deleting anything", async (status) => {
    const { fetch, calls } = fakeFetch((request) =>
      request.method === "PUT" ? new Response(null, { status }) : new Response(null, { status: 404 }),
    );

    await expect(renameResource({ url: `${FOLDER}old/` }, "new", fetch)).rejects.toThrow(NameTakenError);
    expect(calls.filter((call) => !call.startsWith("PUT"))).toEqual([]);
  });

  it("keeps the original folder when copying its contents fails", async () => {
    const { fetch, calls } = fakeFetch((request) => {
      if (request.method === "PUT") return new Response(null, { status: 201 });
      if (request.method === "GET" && request.url === `${FOLDER}old/`) return new Response(null, { status: 500 });
      return new Response(null, { status: 404 });
    });

    await expect(renameResource({ url: `${FOLDER}old/` }, "new", fetch)).rejects.toThrow(/original folder was kept/);
    expect(calls.filter((call) => call.startsWith("DELETE"))).toEqual([]);
  });

  it("copies the contents into the new folder, then removes the original", async () => {
    const OLD = `${FOLDER}old/`;
    const listing = `@prefix ldp: <http://www.w3.org/ns/ldp#>. <> a ldp:Container; ldp:contains <a.txt>.`;
    let oldGone = false;
    const { fetch, calls } = fakeFetch((request) => {
      const turtle = { "Content-Type": "text/turtle" };
      if (request.method === "GET" && request.url === OLD) {
        if (oldGone) return new Response(null, { status: 404 });
        // A real fetch reports the URL it answered; Inrupt parses the listing against it.
        return Object.defineProperty(new Response(listing, { headers: turtle }), "url", { value: OLD });
      }
      if (request.method === "GET" && request.url === `${OLD}a.txt`) return new Response("a", { headers: { "Content-Type": "text/plain", ETag: '"a1"' } });
      if (request.method === "PUT") return new Response(null, { status: 201 });
      if (request.method === "DELETE") {
        if (request.url === OLD) oldGone = true;
        return new Response(null, { status: 205 });
      }
      return new Response(null, { status: 404 });
    });

    expect(await renameResource({ url: OLD }, "new", fetch)).toEqual({ url: `${FOLDER}new/`, sourceRemoved: true });
    const writes = calls.filter((call) => !call.startsWith("GET") && !call.startsWith("HEAD"));
    expect(writes.indexOf(`PUT ${FOLDER}new/a.txt`)).toBeGreaterThan(writes.indexOf(`PUT ${FOLDER}new/`));
    expect(writes.slice(-2)).toEqual([`DELETE ${OLD}a.txt`, `DELETE ${OLD}`]);
  });

  it("reports a folder whose removal failed part-way, rather than claiming both are whole", async () => {
    const OLD = `${FOLDER}old/`;
    const listing = `@prefix ldp: <http://www.w3.org/ns/ldp#>. <> a ldp:Container; ldp:contains <a.txt>.`;
    const { fetch, calls } = fakeFetch((request) => {
      if (request.method === "GET" && request.url === OLD) {
        return Object.defineProperty(new Response(listing, { headers: { "Content-Type": "text/turtle" } }), "url", { value: OLD });
      }
      if (request.method === "GET" && request.url === `${OLD}a.txt`) return new Response("a", { headers: { "Content-Type": "text/plain", ETag: '"a1"' } });
      if (request.method === "PUT") return new Response(null, { status: 201 });
      if (request.method === "DELETE") return new Response(null, { status: request.url === OLD ? 500 : 205 });
      return new Response(null, { status: 404 });
    });

    expect(await renameResource({ url: OLD }, "new", fetch)).toEqual({
      url: `${FOLDER}new/`,
      sourceRemoved: false,
      keptBecause: "failed",
    });
    expect(calls).toContain(`DELETE ${OLD}a.txt`);
  });

  it("keeps an edit made inside the folder while it was being renamed", async () => {
    const OLD = `${FOLDER}old/`;
    const listing = `@prefix ldp: <http://www.w3.org/ns/ldp#>. <> a ldp:Container; ldp:contains <a.txt>.`;
    const { fetch, calls } = fakeFetch((request) => {
      if (request.method === "GET" && request.url === OLD) {
        return Object.defineProperty(new Response(listing, { headers: { "Content-Type": "text/turtle" } }), "url", { value: OLD });
      }
      if (request.method === "GET" && request.url === `${OLD}a.txt`) {
        return new Response("a", { headers: { "Content-Type": "text/plain", ETag: '"a1"' } });
      }
      if (request.method === "PUT") return new Response(null, { status: 201 });
      // a.txt was edited after it was copied, so its ETag no longer matches.
      if (request.method === "DELETE" && request.url === `${OLD}a.txt`) return new Response(null, { status: 412 });
      return new Response(null, { status: 205 });
    });

    expect(await renameResource({ url: OLD }, "new", fetch)).toEqual({
      url: `${FOLDER}new/`,
      sourceRemoved: false,
      keptBecause: "changed",
    });
    expect(calls).not.toContain(`DELETE ${OLD}`);
  });

  it.each([
    ["a file elsewhere in the pod", "<../elsewhere/secret.txt>"],
    ["a file on another server", "<https://other.example/x.txt>"],
    ["something two levels down", "<sub/deep.txt>"],
  ])("refuses a listing that names %s, before copying or deleting anything", async (_label, entry) => {
    const OLD = `${FOLDER}old/`;
    const listing = `@prefix ldp: <http://www.w3.org/ns/ldp#>. <> a ldp:Container; ldp:contains <a.txt>, ${entry}.`;
    const { fetch, calls } = fakeFetch((request) => {
      if (request.method === "GET" && request.url === OLD) {
        return Object.defineProperty(new Response(listing, { headers: { "Content-Type": "text/turtle" } }), "url", { value: OLD });
      }
      if (request.method === "PUT") return new Response(null, { status: 201 });
      return new Response("x", { headers: { ETag: '"x"' } });
    });

    await expect(renameResource({ url: OLD }, "new", fetch)).rejects.toThrow(/original folder was kept/);
    expect(calls.filter((call) => call.startsWith("DELETE"))).toEqual([]);
    expect(calls.filter((call) => call.startsWith("GET") && call !== `GET ${OLD}`)).toEqual([]);
  });
});
