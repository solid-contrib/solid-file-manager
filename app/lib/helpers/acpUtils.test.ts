import { describe, expect, it } from "vitest";
import { Parser } from "n3";
import { fakeFetch } from "../testing/fakeFetch";
import {
  getResourceAccessList,
  OwnAccessError,
  removeAccessFromResource,
  UnmanagedAccessError,
  saveAcr,
  shareResourceWithAcp,
} from "./acpUtils";

const FILE = "https://pod.example/docs/notes.txt";
const FOLDER = "https://pod.example/docs/";
const ME = "https://pod.example/profile/card#me";
const BOB = "https://bob.example/profile/card#me";
const CAROL = "https://carol.example/profile/card#me";
const ACP = "http://www.w3.org/ns/solid/acp#";
const ACL = "http://www.w3.org/ns/auth/acl#";
const PREFIXES = `@prefix acp: <${ACP}>. @prefix acl: <${ACL}>.\n`;

/**
 * An ACP server holding one ACR for `resource` (Community Solid Server style:
 * `<resource>.acr`, typed in its Link header). `acr` is its Turtle (null: none
 * yet); `etag` is sent with it. Records every PUT.
 */
function acpServer(resource: string, acr: string | null, { etag = '"v1"' as string | null, acrUrl = `${resource}.acr` } = {}) {
  let body = acr;
  const puts: { body: string; ifMatch: string | null; ifNoneMatch: string | null }[] = [];
  const { fetch, calls } = fakeFetch(async (request) => {
    if (request.url === resource) {
      return new Response(null, { headers: { Link: `<${acrUrl}>; rel="acl"` } });
    }
    if (request.url !== acrUrl) return new Response(null, { status: 404 });
    if (request.method === "HEAD") {
      return new Response(null, { headers: { Link: `<${ACP}AccessControlResource>; rel="type"` } });
    }
    if (request.method === "PUT") {
      body = await request.text();
      puts.push({ body, ifMatch: request.headers.get("If-Match"), ifNoneMatch: request.headers.get("If-None-Match") });
      return new Response(null, { status: 205 });
    }
    if (body === null) return new Response(null, { status: 404 });
    return new Response(body, { headers: etag ? { ETag: etag } : {} });
  });
  return { fetch, calls, puts, current: () => body };
}

/** The ACR as N-Triples-like strings, resolved against `base`, for asserting what is in it. */
function triples(turtle: string, base: string): string[] {
  return new Parser({ baseIRI: base }).parse(turtle).map((q) => `${q.subject.value} ${q.predicate.value} ${q.object.value}`);
}

const levels = async (resource: string, fetch: typeof globalThis.fetch) =>
  Object.fromEntries((await getResourceAccessList(resource, fetch))!.map((e) => [e.webId, e.accessModes]));

/** A Community Solid Server ACR: fragment subjects, owner with Control, public read. */
const CSS_ACR = `${PREFIXES}
<#root> a acp:AccessControlResource; acp:resource <./notes.txt>;
  acp:accessControl <#owner>, <#public>.
<#owner> a acp:AccessControl; acp:apply [ a acp:Policy; acp:allow acl:Read, acl:Write, acl:Control;
  acp:anyOf [ a acp:Matcher; acp:agent <${ME}> ] ].
<#public> a acp:AccessControl; acp:apply [ a acp:Policy; acp:allow acl:Read;
  acp:anyOf [ a acp:Matcher; acp:agent acp:PublicAgent ] ].`;

describe("shareResourceWithAcp", () => {
  it("creates the ACR with acl:Read / acl:Write for the shared agent", async () => {
    const server = acpServer(FILE, null);

    await shareResourceWithAcp(FILE, [BOB], "Editor", server.fetch, ME);

    expect(server.puts).toHaveLength(1);
    expect(server.puts[0].ifNoneMatch).toBe("*");
    const written = triples(server.puts[0].body, `${FILE}.acr`);
    expect(written).toContain(`${FILE}.acr ${ACP}resource ${FILE}`);
    expect(written.some((t) => t.endsWith(`${ACP}allow ${ACL}Read`))).toBe(true);
    expect(written.some((t) => t.includes(`${ACP}mode`))).toBe(false);
    expect(await levels(FILE, server.fetch)).toEqual({ [BOB]: ["Read", "Write"] });
  });

  it("adds to an existing ACR with fragment subjects, keeping what was there", async () => {
    const server = acpServer(FILE, CSS_ACR);

    await shareResourceWithAcp(FILE, [BOB], "Viewer", server.fetch, ME);

    expect(server.puts[0].ifMatch).toBe('"v1"');
    expect(await levels(FILE, server.fetch)).toEqual({
      [ME]: ["Read", "Write", "Control"],
      [`${ACP}PublicAgent`]: ["Read"],
      [BOB]: ["Read"],
    });
  });

  it.each([
    ["Viewer", "Editor", ["Read", "Write"]],
    ["Editor", "Viewer", ["Read"]],
  ] as const)("changes a %s into an %s", async (from, to, expected) => {
    const server = acpServer(FILE, CSS_ACR);
    await shareResourceWithAcp(FILE, [BOB], from, server.fetch, ME);

    await shareResourceWithAcp(FILE, [BOB], to, server.fetch, ME);

    expect((await levels(FILE, server.fetch))[BOB]).toEqual(expected);
    // The earlier grant is gone, not just outvoted.
    const policies = triples(server.current()!, `${FILE}.acr`).filter((t) => t.endsWith(BOB));
    expect(policies).toHaveLength(1);
  });

  it("shares a folder's contents too (acp:memberAccessControl), but not a file's", async () => {
    const folder = acpServer(FOLDER, null);
    await shareResourceWithAcp(FOLDER, [BOB], "Viewer", folder.fetch, ME);
    expect(folder.puts[0].body).toContain("memberAccessControl");

    const file = acpServer(FILE, null);
    await shareResourceWithAcp(FILE, [BOB], "Viewer", file.fetch, ME);
    expect(file.puts[0].body).not.toContain("memberAccessControl");
  });

  it("works with an ESS ACR: typed, no acp:resource, controls in another document, no ETag", async () => {
    const acrUrl = "https://authorization.pod.example/01ABC";
    const inherited = "https://authorization.pod.example/01PARENT#owner";
    const server = acpServer(FILE, `<${acrUrl}> a <${ACP}AccessControlResource>; <${ACP}accessControl> <${inherited}>.`, {
      etag: null,
      acrUrl,
    });

    await shareResourceWithAcp(FILE, [BOB], "Viewer", server.fetch, ME);

    expect(server.puts[0]).toMatchObject({ ifMatch: null, ifNoneMatch: null });
    expect(triples(server.puts[0].body, acrUrl)).toContain(`${acrUrl} ${ACP}accessControl ${inherited}`);
    expect(await levels(FILE, server.fetch)).toEqual({ [BOB]: ["Read"] });
  });

  it("refuses to change the user's own access, without writing anything", async () => {
    const server = acpServer(FILE, CSS_ACR);

    await expect(shareResourceWithAcp(FILE, [BOB, ME], "Viewer", server.fetch, ME)).rejects.toThrow(OwnAccessError);
    expect(server.puts).toHaveLength(0);
  });

  it.each([
    ["full control", CSS_ACR, ME],
    [
      "a client condition",
      `${PREFIXES}<#root> acp:resource <./notes.txt>; acp:accessControl <#ac>.
<#ac> acp:apply [ acp:allow acl:Read, acl:Write; acp:anyOf [ acp:agent <${BOB}>; acp:client <https://app.example/id> ] ].`,
      BOB,
    ],
    [
      "an acp:allOf condition",
      `${PREFIXES}<#root> acp:resource <./notes.txt>; acp:accessControl <#ac>.
<#ac> acp:apply [ acp:allow acl:Read, acl:Write; acp:anyOf [ acp:agent <${BOB}> ]; acp:allOf [ acp:client <https://app.example/id> ] ].`,
      BOB,
    ],
  ])("won't replace access with %s by a plain grant (that could widen or hide it)", async (_label, acr, webId) => {
    const server = acpServer(FILE, acr);

    await expect(shareResourceWithAcp(FILE, [webId], "Viewer", server.fetch, undefined)).rejects.toThrow(UnmanagedAccessError);
    expect(server.puts).toHaveLength(0);
  });

  it("refuses an ACR it can't make sense of rather than guessing", async () => {
    const server = acpServer(FILE, `${PREFIXES}<#a> a acp:AccessControlResource. <#b> a acp:AccessControlResource.`);

    await expect(shareResourceWithAcp(FILE, [BOB], "Viewer", server.fetch, ME)).rejects.toThrow(/Couldn't read/);
    expect(server.puts).toHaveLength(0);
  });
});

describe("removeAccessFromResource", () => {
  it("removes a shared agent and nothing else", async () => {
    const server = acpServer(FILE, CSS_ACR);
    await shareResourceWithAcp(FILE, [BOB, CAROL], "Editor", server.fetch, ME);

    await removeAccessFromResource(FILE, BOB, server.fetch, ME);

    expect(await levels(FILE, server.fetch)).toEqual({
      [ME]: ["Read", "Write", "Control"],
      [`${ACP}PublicAgent`]: ["Read"],
      [CAROL]: ["Read", "Write"],
    });
    expect(server.current()).not.toContain(BOB);
  });

  it("never edits a policy that grants Control, so nobody loses it", async () => {
    const server = acpServer(FILE, CSS_ACR);

    await removeAccessFromResource(FILE, "https://other-owner.example/#me", server.fetch, ME);
    await removeAccessFromResource(FILE, ME, server.fetch, undefined);

    expect(server.puts).toHaveLength(0);
  });

  it("refuses to remove the user's own access", async () => {
    const server = acpServer(FILE, CSS_ACR);

    await expect(removeAccessFromResource(FILE, ME, server.fetch, ME)).rejects.toThrow(OwnAccessError);
    expect(server.puts).toHaveLength(0);
  });

  it("keeps the other agents of a matcher it shares with another policy", async () => {
    const server = acpServer(FILE, `${PREFIXES}
<#root> acp:resource <./notes.txt>; acp:accessControl <#ac>.
<#ac> acp:apply <#read>, <#owners>.
<#read> acp:allow acl:Read; acp:anyOf <#both>.
<#owners> acp:allow acl:Read, acl:Control; acp:anyOf <#both>.
<#both> acp:agent <${BOB}>, <${CAROL}>.`);

    await removeAccessFromResource(FILE, BOB, server.fetch, ME);

    // <#read> no longer names Bob; <#owners> (with Control) still uses <#both> unchanged.
    expect(await levels(FILE, server.fetch)).toEqual({ [BOB]: ["Read", "Control"], [CAROL]: ["Read", "Control"] });
    const written = triples(server.current()!, `${FILE}.acr`);
    expect(written).toContain(`${FILE}.acr#both ${ACP}agent ${BOB}`);
  });

  it.each([
    ["the matcher has other conditions", `acp:anyOf [ acp:agent <${BOB}>; acp:client <https://app.example/id> ]`],
    ["the policy has other conditions", `acp:anyOf [ acp:agent <${BOB}> ]; acp:allOf [ acp:client <https://app.example/id> ]`],
  ])("never widens access when %s", async (_label, conditions) => {
    const server = acpServer(FILE, `${PREFIXES}
<#root> acp:resource <./notes.txt>; acp:accessControl <#ac>.
<#ac> acp:apply [ acp:allow acl:Read; ${conditions} ].`);

    await removeAccessFromResource(FILE, BOB, server.fetch, ME);

    // The grant is removed whole, not left to match on the client alone.
    expect(server.current()).not.toContain("https://app.example/id");
    expect(await levels(FILE, server.fetch)).toEqual({});
  });
});

describe("removeAccessFromResource with conditional matchers", () => {
  it("removes only the one agent from a matcher that also has other agents and conditions", async () => {
    const server = acpServer(FILE, `${PREFIXES}
<#root> acp:resource <./notes.txt>; acp:accessControl <#ac>.
<#ac> acp:apply [ acp:allow acl:Read; acp:anyOf <#m> ].
<#m> acp:agent <${BOB}>, <${CAROL}>; acp:client <https://app.example/id>.`);

    await removeAccessFromResource(FILE, BOB, server.fetch, ME);

    const written = triples(server.current()!, `${FILE}.acr`);
    expect(written).toContain(`${FILE}.acr#m ${ACP}agent ${CAROL}`);
    expect(written).toContain(`${FILE}.acr#m ${ACP}client https://app.example/id`);
    expect(written.some((t) => t.endsWith(BOB))).toBe(false);
  });
});

describe("removeAccessFromResource with policies shared outside this ACR", () => {
  it("leaves a policy applied elsewhere in the document untouched", async () => {
    const server = acpServer(FILE, `${PREFIXES}
<#root> acp:resource <./notes.txt>; acp:accessControl <#ac>.
<#other> acp:resource <./other.txt>; acp:accessControl <#otherAc>.
<#ac> acp:apply <#p>.
<#otherAc> acp:apply <#p>.
<#p> acp:allow acl:Read; acp:anyOf [ acp:agent <${BOB}> ].`);

    await removeAccessFromResource(FILE, BOB, server.fetch, ME);

    const written = triples(server.current()!, `${FILE}.acr`);
    expect(written).toContain(`${FILE}.acr#otherAc ${ACP}apply ${FILE}.acr#p`);
    expect(written).not.toContain(`${FILE}.acr#ac ${ACP}apply ${FILE}.acr#p`);
    expect(written.filter((t) => t.endsWith(BOB))).toHaveLength(1);
    expect(await levels(FILE, server.fetch)).toEqual({});
  });

  it("leaves an access control that another ACR in the document also uses untouched", async () => {
    const server = acpServer(FILE, `${PREFIXES}
<#root> acp:resource <./notes.txt>; acp:accessControl <#ac>.
<#other> acp:resource <./other.txt>; acp:accessControl <#ac>.
<#ac> acp:apply <#p>.
<#p> acp:allow acl:Read; acp:anyOf <#m>.
<#m> acp:agent <${BOB}>.`);

    await removeAccessFromResource(FILE, BOB, server.fetch, ME);

    const written = triples(server.current()!, `${FILE}.acr`);
    expect(written).toEqual(
      expect.arrayContaining([
        `${FILE}.acr#other ${ACP}accessControl ${FILE}.acr#ac`,
        `${FILE}.acr#ac ${ACP}apply ${FILE}.acr#p`,
        `${FILE}.acr#p ${ACP}anyOf ${FILE}.acr#m`,
        `${FILE}.acr#m ${ACP}agent ${BOB}`,
      ]),
    );
    expect(written).not.toContain(`${FILE}.acr#root ${ACP}accessControl ${FILE}.acr#ac`);
    expect(await levels(FILE, server.fetch)).toEqual({});
  });
});

describe("getResourceAccessList", () => {
  it("lists agents from fragment subjects, marking Control holders as not removable", async () => {
    const server = acpServer(FILE, CSS_ACR);

    const list = await getResourceAccessList(FILE, server.fetch);

    expect(list).toEqual([
      { webId: ME, accessModes: ["Read", "Write", "Control"], canRemove: false },
      { webId: `${ACP}PublicAgent`, accessModes: ["Read"], canRemove: true },
    ]);
  });

  it("is empty when there is no ACR yet", async () => {
    expect(await getResourceAccessList(FILE, acpServer(FILE, null).fetch)).toEqual([]);
  });
});

describe("saveAcr", () => {
  /** Records the conditional headers of the PUT and answers with `status`. */
  function server(status = 205) {
    const sent: Record<string, string | null>[] = [];
    const { fetch } = fakeFetch((request) => {
      sent.push({ ifMatch: request.headers.get("If-Match"), ifNoneMatch: request.headers.get("If-None-Match") });
      return new Response(null, { status });
    });
    return { fetch, sent };
  }

  it.each([
    ["an ACR read with an ETag", { etag: '"v1"' }, { ifMatch: '"v1"', ifNoneMatch: null }],
    ["a new ACR", "new" as const, { ifMatch: null, ifNoneMatch: "*" }],
    ["an ACR read without an ETag", { etag: null }, { ifMatch: null, ifNoneMatch: null }],
  ])("guards %s", async (_label, previous, expected) => {
    const { fetch, sent } = server();

    await saveAcr(`${FILE}.acr`, "<> a <x>.", previous, fetch);

    expect(sent).toEqual([expected]);
  });

  it("explains a conflicting change instead of overwriting it", async () => {
    const { fetch } = server(412);

    await expect(saveAcr(`${FILE}.acr`, "", { etag: '"v1"' }, fetch)).rejects.toThrow(/changed by someone else/);
  });
});
