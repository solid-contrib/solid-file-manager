import { describe, expect, it } from "vitest";
import { fakeFetch } from "../testing/fakeFetch";
import { discoverAccessControl, linkTargets } from "./accessControl";

const RESOURCE = "https://pod.example/docs/notes.txt";
const acpType = '<http://www.w3.org/ns/solid/acp#AccessControlResource>; rel="type"';

/** A server where HEAD on `resource` advertises `aclLink`, and HEAD on that answers with `aclHeaders`. */
function server(aclLink: string | null, aclStatus: number, aclHeaders: Record<string, string> = {}) {
  return fakeFetch((request) => {
    if (request.url === RESOURCE) {
      const headers: Record<string, string> = { Link: '<http://www.w3.org/ns/ldp#Resource>; rel="type"' };
      if (aclLink) headers.Link += `, ${aclLink}`;
      return new Response(null, { status: 200, headers });
    }
    return new Response(null, { status: aclStatus, headers: aclHeaders });
  });
}

describe("linkTargets", () => {
  it("finds every target of a relation, resolving relative URLs", () => {
    const response = new Response(null, {
      headers: { Link: '<notes.txt.acr>; rel="acl", <http://www.w3.org/ns/ldp#Resource>; rel="type", <x>; rel="describedby acl"' },
    });
    expect(linkTargets(response, "acl", RESOURCE)).toEqual([
      "https://pod.example/docs/notes.txt.acr",
      "https://pod.example/docs/x",
    ]);
  });

  it("is not confused by quoted parameter values containing commas or semicolons", () => {
    const response = new Response(null, {
      headers: { Link: '<a>; title="notes, shared; v2"; rel="acl", <b>; rel=type' },
    });
    expect(linkTargets(response, "acl", RESOURCE)).toEqual(["https://pod.example/docs/a"]);
    expect(linkTargets(response, "type", RESOURCE)).toEqual(["https://pod.example/docs/b"]);
  });

  it("ignores rel= written inside another parameter's quoted value", () => {
    const response = new Response(null, { headers: { Link: '<a>; title="example; rel=acl", <b>; rel="acl"' } });
    expect(linkTargets(response, "acl", RESOURCE)).toEqual(["https://pod.example/docs/b"]);
  });
});

describe("discoverAccessControl", () => {
  it("recognises ACP from the type of the advertised document (Community Solid Server, ESS)", async () => {
    const { fetch } = server('<https://pod.example/docs/notes.txt.acr>; rel="acl"', 401, { Link: acpType });

    expect(await discoverAccessControl(RESOURCE, fetch)).toEqual({
      kind: "acp",
      url: "https://pod.example/docs/notes.txt.acr",
    });
  });

  it("follows whatever URL the server advertises, rather than guessing one", async () => {
    const { fetch, calls } = server('<https://acr.pod.example/abc?ext=acr>; rel="acl"', 200, { Link: acpType });

    expect(await discoverAccessControl(RESOURCE, fetch)).toEqual({ kind: "acp", url: "https://acr.pod.example/abc?ext=acr" });
    expect(calls).toEqual([`HEAD ${RESOURCE}`, "HEAD https://acr.pod.example/abc?ext=acr"]);
  });

  it.each([
    ["exists", 200],
    ["doesn't exist yet", 404],
  ])("treats a readable document without the ACP type as WAC (solidcommunity.net), when it %s", async (_label, status) => {
    const { fetch } = server('<https://pod.example/docs/notes.txt.acl>; rel="acl"', status);

    expect(await discoverAccessControl(RESOURCE, fetch)).toEqual({ kind: "wac", url: "https://pod.example/docs/notes.txt.acl" });
  });

  it.each([401, 403])("can't tell what a refused, untyped document is (ESS before you may manage access): %i", async (status) => {
    const { fetch } = server('<https://authorization.pod.example/01ABC>; rel="acl"', status);

    expect(await discoverAccessControl(RESOURCE, fetch)).toEqual({ kind: "restricted", url: "https://authorization.pod.example/01ABC" });
  });

  it.each([405, 500])("doesn't mistake a failing server (%i) for WAC", async (status) => {
    const { fetch } = server('<https://pod.example/docs/notes.txt.acr>; rel="acl"', status);

    await expect(discoverAccessControl(RESOURCE, fetch)).rejects.toThrow(/Couldn't check/);
  });

  it("doesn't mistake a failing resource request for 'no access control'", async () => {
    const { fetch } = fakeFetch(() => new Response(null, { status: 503 }));

    await expect(discoverAccessControl(RESOURCE, fetch)).rejects.toThrow(/Couldn't check/);
  });

  it("reports no access control when the server advertises none", async () => {
    const { fetch, calls } = server(null, 404);

    expect(await discoverAccessControl(RESOURCE, fetch)).toBeNull();
    expect(calls).toHaveLength(1);
  });
});
