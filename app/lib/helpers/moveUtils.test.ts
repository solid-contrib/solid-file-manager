import { describe, expect, it, vi } from "vitest";
import { fakeFetch } from "../testing/fakeFetch";
import { getHttpStatus } from "./httpErrorUtils";
import {
  IndeterminateMoveError,
  moveFileResource,
  moveFileWithConflictChoice,
} from "./moveUtils";

const SOURCE = "https://pod.example/inbox/note.txt";
const DEST = "https://pod.example/archive/";
const file = { url: SOURCE, name: "note.txt" };

/** A pod that serves the source file, accepts writes and deletes, unless overridden. */
function pod(overrides: Record<string, (request: Request) => Response | Promise<Response>> = {}) {
  return fakeFetch((request) => {
    const override = overrides[`${request.method} ${request.url}`];
    if (override) return override(request);
    if (request.method === "GET" && request.url === SOURCE) {
      return new Response("hello", { headers: { "Content-Type": "text/plain" } });
    }
    if (request.method === "POST" && request.url === DEST) {
      const slug = request.headers.get("Slug") ?? "unnamed";
      return new Response(null, { status: 201, headers: { Location: DEST + slug } });
    }
    if (request.method === "PUT" || request.method === "DELETE") {
      return new Response(null, { status: 205 });
    }
    return new Response(null, { status: 404 });
  });
}

describe("moveFileResource", () => {
  it("deletes the original only after the write is confirmed", async () => {
    let confirmWrite!: () => void;
    const { fetch, calls } = pod({
      [`POST ${DEST}`]: () =>
        new Promise<Response>((resolve) => {
          confirmWrite = () =>
            resolve(new Response(null, { status: 201, headers: { Location: `${DEST}note.txt` } }));
        }),
    });

    const moving = moveFileResource(file, DEST, fetch);
    await vi.waitFor(() => expect(confirmWrite).toBeTypeOf("function"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).not.toContain(`DELETE ${SOURCE}`);

    confirmWrite();
    const result = await moving;

    expect(calls).toEqual([`GET ${SOURCE}`, `POST ${DEST}`, `DELETE ${SOURCE}`]);
    expect(result).toEqual({
      url: `${DEST}note.txt`,
      name: "note.txt",
      requestedName: "note.txt",
      originalName: "note.txt",
      sourceRemoved: true,
    });
  });

  it("reports the name the server actually chose", async () => {
    const { fetch } = pod({
      [`POST ${DEST}`]: () =>
        new Response(null, { status: 201, headers: { Location: `${DEST}server-chosen.txt` } }),
    });

    const result = await moveFileResource(file, DEST, fetch, "renamed.txt");

    expect(result).toMatchObject({ name: "server-chosen.txt", requestedName: "renamed.txt" });
  });

  it("keeps the original when the write is refused", async () => {
    const { fetch, calls } = pod({ [`POST ${DEST}`]: () => new Response(null, { status: 403 }) });

    const error = await moveFileResource(file, DEST, fetch).catch((e: unknown) => e);

    expect(getHttpStatus(error)).toBe(403);
    expect(calls).not.toContain(`DELETE ${SOURCE}`);
  });

  it("keeps the original when the write cannot be confirmed", async () => {
    const { fetch, calls } = pod({
      [`POST ${DEST}`]: () => {
        throw new TypeError("network down");
      },
    });

    await expect(moveFileResource(file, DEST, fetch)).rejects.toBeInstanceOf(IndeterminateMoveError);
    expect(calls).not.toContain(`DELETE ${SOURCE}`);
  });

  it("reports both copies when the original cannot be removed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetch } = pod({ [`DELETE ${SOURCE}`]: () => new Response(null, { status: 403 }) });

    const result = await moveFileResource(file, DEST, fetch);

    expect(result.sourceRemoved).toBe(false);
  });

  it("treats an original that is already gone as removed", async () => {
    const { fetch } = pod({ [`DELETE ${SOURCE}`]: () => new Response(null, { status: 404 }) });

    const result = await moveFileResource(file, DEST, fetch);

    expect(result.sourceRemoved).toBe(true);
  });
});

describe("moveFileWithConflictChoice", () => {
  const conflict = { existingName: "note.txt", targetUrl: `${DEST}note.txt` };

  it("replace: overwrites the existing resource, then removes the original", async () => {
    const { fetch, calls } = pod();

    const result = await moveFileWithConflictChoice(file, DEST, "note.txt", conflict, "replace", fetch);

    expect(calls).toEqual([`GET ${SOURCE}`, `PUT ${conflict.targetUrl}`, `DELETE ${SOURCE}`]);
    expect(result).toMatchObject({ url: conflict.targetUrl, name: "note.txt", sourceRemoved: true });
  });

  it("keep both: tries numbered names until one is free", async () => {
    const slugs: (string | null)[] = [];
    const { fetch } = pod({
      [`POST ${DEST}`]: (request) => {
        const slug = request.headers.get("Slug");
        slugs.push(slug);
        return slug === "note (1).txt"
          ? new Response(null, { status: 409 })
          : new Response(null, { status: 201, headers: { Location: `${DEST}${slug}` } });
      },
    });

    const result = await moveFileWithConflictChoice(file, DEST, "note.txt", conflict, "keepBoth", fetch);

    expect(slugs).toEqual(["note (1).txt", "note (2).txt"]);
    expect(result).toMatchObject({ name: "note (2).txt", sourceRemoved: true });
  });
});
