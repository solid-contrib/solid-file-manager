import { describe, expect, it } from "vitest";
import { fakeFetch } from "../testing/fakeFetch";
import { getAccessList, shareResource } from "./sharing";

const FILE = "https://pod.example/notes.txt";
const ME = "https://pod.example/profile/card#me";
const BOB = "https://bob.example/profile/card#me";
const ACL = "http://www.w3.org/ns/auth/acl#";
const ACP = "http://www.w3.org/ns/solid/acp#";

/** A server whose access-control documents are `<url>.acl` (WAC) or `<url>.acr` typed as ACP. */
function server(kind: "wac" | "acp") {
  const ext = kind === "wac" ? ".acl" : ".acr";
  const docs = new Map<string, string>([
    [`https://pod.example/.acl`, `<#owner> <${ACL}agent> <${ME}>; <${ACL}default> <./>; <${ACL}mode> <${ACL}Control>.`],
  ]);
  const puts: string[] = [];
  const { fetch } = fakeFetch(async (request) => {
    if (!request.url.endsWith(ext) && !request.url.endsWith(".acl")) {
      return new Response(null, { headers: { Link: `<${request.url}${ext}>; rel="acl"` } });
    }
    if (request.method === "PUT") {
      puts.push(request.url);
      docs.set(request.url, await request.text());
      return new Response(null, { status: 201 });
    }
    const headers = kind === "acp" ? { Link: `<${ACP}AccessControlResource>; rel="type"` } : undefined;
    if (request.method === "HEAD") {
      return new Response(null, { status: docs.has(request.url) ? 200 : 404, headers: { ...headers, ...(docs.has(request.url) ? { ETag: '"v1"' } : {}) } });
    }
    const doc = docs.get(request.url);
    return doc === undefined ? new Response(null, { status: 404, headers }) : new Response(doc, { headers: { ...headers, ETag: '"v1"' } });
  });
  return { fetch, puts };
}

describe("sharing", () => {
  it("refuses on a server without access control, without writing", async () => {
    const puts: string[] = [];
    const { fetch } = fakeFetch((request) => {
      if (request.method === "PUT") puts.push(request.url);
      return new Response(null);
    });

    await expect(shareResource(FILE, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/doesn't offer access control/);
    expect(await getAccessList(FILE, fetch)).toBeNull();
    expect(puts).toEqual([]);
  });

  it.each([
    ["WAC", "wac", `${FILE}.acl`],
    ["ACP", "acp", `${FILE}.acr`],
  ] as const)("shares through %s when the server uses it", async (_label, kind, document) => {
    const { fetch, puts } = server(kind);

    await shareResource(FILE, [BOB], "Viewer", fetch, ME);

    expect(puts).toEqual([document]);
    expect((await getAccessList(FILE, fetch))?.find((e) => e.webId === BOB)?.accessModes).toEqual(["Read"]);
  });
});
