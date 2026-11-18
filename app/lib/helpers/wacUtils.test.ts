import { describe, expect, it } from "vitest";
import { Parser } from "n3";
import { fakeFetch } from "../testing/fakeFetch";
import { OwnAccessError, UnmanagedAccessError } from "./acpUtils";
import { getWacAccessList, removeAccessWithWac, shareResourceWithWac } from "./wacUtils";

const ROOT = "https://pod.example/";
const FOLDER = "https://pod.example/docs/";
const FILE = "https://pod.example/docs/notes.txt";
const ME = "https://pod.example/profile/card#me";
const BOB = "https://bob.example/profile/card#me";
const CAROL = "https://carol.example/profile/card#me";
const ACL = "http://www.w3.org/ns/auth/acl#";
const FOAF_AGENT = "http://xmlns.com/foaf/0.1/Agent";
const PREFIXES = `@prefix acl: <${ACL}>. @prefix foaf: <http://xmlns.com/foaf/0.1/>.\n`;

/** The pod root's .acl as Community Solid Server writes it: public read of the root, owner Control everywhere. */
const ROOT_ACL = `${PREFIXES}
<#public> a acl:Authorization; acl:agentClass foaf:Agent; acl:accessTo <./>; acl:mode acl:Read.
<#owner> a acl:Authorization; acl:agent <${ME}>; acl:accessTo <./>; acl:default <./>; acl:mode acl:Read, acl:Write, acl:Control.`;

/**
 * A WAC server: every resource advertises `<url>.acl`; `acls` holds the
 * existing .acl documents by URL (anything else is 404). Records every PUT.
 */
function wacServer(acls: Record<string, string>) {
  const docs = new Map(Object.entries(acls));
  const puts: { url: string; body: string; ifMatch: string | null; ifNoneMatch: string | null }[] = [];
  const { fetch, calls } = fakeFetch(async (request) => {
    if (!request.url.endsWith(".acl")) {
      return new Response(null, { headers: { Link: `<${request.url}.acl>; rel="acl"` } });
    }
    if (request.method === "PUT") {
      const body = await request.text();
      puts.push({ url: request.url, body, ifMatch: request.headers.get("If-Match"), ifNoneMatch: request.headers.get("If-None-Match") });
      docs.set(request.url, body);
      return new Response(null, { status: 201 });
    }
    const doc = docs.get(request.url);
    return doc === undefined ? new Response(null, { status: 404 }) : new Response(doc, { headers: { ETag: '"v1"' } });
  });
  return { fetch, calls, puts, doc: (url: string) => docs.get(url) };
}

function triples(turtle: string, base: string): string[] {
  return new Parser({ baseIRI: base }).parse(turtle).map((q) => `${q.subject.value} ${q.predicate.value} ${q.object.value}`);
}

const levels = async (resource: string, fetch: typeof globalThis.fetch) =>
  Object.fromEntries((await getWacAccessList(resource, `${resource}.acl`, fetch)).map((e) => [e.webId, e.accessModes]));

describe("shareResourceWithWac", () => {
  it("creates a file's .acl from the inherited rules, keeping the owner's Control", async () => {
    const server = wacServer({ [`${ROOT}.acl`]: ROOT_ACL });

    await shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", server.fetch, ME);

    expect(server.puts).toHaveLength(1);
    expect(server.puts[0]).toMatchObject({ url: `${FILE}.acl`, ifNoneMatch: "*" });
    expect(await levels(FILE, server.fetch)).toEqual({ [ME]: ["Read", "Write", "Control"], [BOB]: ["Read"] });
    const written = triples(server.puts[0].body, `${FILE}.acl`);
    expect(written.some((t) => t.includes(`${ACL}default`))).toBe(false);
    // Public read of the root wasn't inherited (no acl:default), so it isn't copied.
    expect(written.some((t) => t.endsWith(FOAF_AGENT))).toBe(false);
  });

  it("keeps a folder's rules inherited by its contents (acl:default)", async () => {
    const server = wacServer({ [`${ROOT}.acl`]: ROOT_ACL });

    await shareResourceWithWac(FOLDER, `${FOLDER}.acl`, [BOB], "Editor", server.fetch, ME);

    const written = triples(server.puts[0].body, `${FOLDER}.acl`);
    const bobRule = written.find((t) => t.endsWith(` ${ACL}agent ${BOB}`))!.split(" ")[0];
    expect(written).toContain(`${bobRule} ${ACL}default ${FOLDER}`);
    expect(written.filter((t) => t.endsWith(`${ACL}default ${FOLDER}`))).toHaveLength(2); // owner and Bob
    expect(await levels(FOLDER, server.fetch)).toEqual({ [ME]: ["Read", "Write", "Control"], [BOB]: ["Read", "Write"] });
  });

  it("inherits from the nearest ancestor that has an .acl", async () => {
    const server = wacServer({
      [`${ROOT}.acl`]: ROOT_ACL,
      [`${FOLDER}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./>; acl:default <./>; acl:mode acl:Read, acl:Write, acl:Control.
<#carol> acl:agent <${CAROL}>; acl:default <./>; acl:mode acl:Read.`,
    });

    expect(await levels(FILE, server.fetch)).toEqual({ [ME]: ["Read", "Write", "Control"], [CAROL]: ["Read"] });
    expect(server.calls).not.toContain(`HEAD ${ROOT}`);
  });

  it.each([
    ["Viewer", "Editor", ["Read", "Write"]],
    ["Editor", "Viewer", ["Read"]],
  ] as const)("changes a %s into an %s, updating the existing .acl", async (from, to, expected) => {
    const server = wacServer({ [`${ROOT}.acl`]: ROOT_ACL });
    await shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], from, server.fetch, ME);

    await shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], to, server.fetch, ME);

    expect(server.puts[1].ifMatch).toBe('"v1"');
    expect((await levels(FILE, server.fetch))[BOB]).toEqual(expected);
    expect(triples(server.doc(`${FILE}.acl`)!, `${FILE}.acl`).filter((t) => t.endsWith(BOB))).toHaveLength(1);
  });

  it("refuses to create an .acl that would leave nobody with Control", async () => {
    const server = wacServer({ [`${ROOT}.acl`]: `${PREFIXES}<#r> acl:agentClass foaf:Agent; acl:default <./>; acl:mode acl:Read.` });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", server.fetch, ME)).rejects.toThrow(/keep the existing control/);
    expect(server.puts).toHaveLength(0);
  });

  it("refuses to change the user's own access", async () => {
    const server = wacServer({ [`${ROOT}.acl`]: ROOT_ACL });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [ME], "Viewer", server.fetch, ME)).rejects.toThrow(OwnAccessError);
    expect(server.puts).toHaveLength(0);
  });

  it.each([
    ["Control", `acl:agent <${BOB}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Control`],
    ["an origin restriction", `acl:agent <${BOB}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Write; acl:origin <https://app.example>`],
  ])("won't replace access with %s by a plain rule", async (_label, rule) => {
    const server = wacServer({ [`${FILE}.acl`]: `${PREFIXES}<#r> ${rule}.` });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", server.fetch, ME)).rejects.toThrow(UnmanagedAccessError);
    expect(server.puts).toHaveLength(0);
  });
});

describe("removeAccessWithWac", () => {
  it("removes one person from a rule naming others, keeping them", async () => {
    const server = wacServer({
      [`${FILE}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Write, acl:Control.
<#friends> acl:agent <${BOB}>, <${CAROL}>; acl:accessTo <./notes.txt>; acl:mode acl:Read.`,
    });

    await removeAccessWithWac(FILE, `${FILE}.acl`, BOB, server.fetch, ME);

    expect(await levels(FILE, server.fetch)).toEqual({ [ME]: ["Read", "Write", "Control"], [CAROL]: ["Read"] });
  });

  it("removes inherited access by creating the .acl without it", async () => {
    const server = wacServer({
      [`${ROOT}.acl`]: `${ROOT_ACL}\n<#bob> acl:agent <${BOB}>; acl:default <./>; acl:mode acl:Read.`,
    });

    await removeAccessWithWac(FILE, `${FILE}.acl`, BOB, server.fetch, ME);

    expect(server.puts[0]).toMatchObject({ url: `${FILE}.acl`, ifNoneMatch: "*" });
    expect(await levels(FILE, server.fetch)).toEqual({ [ME]: ["Read", "Write", "Control"] });
  });

  it("only changes this resource when a rule also covers others", async () => {
    const server = wacServer({
      [`${FILE}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Write, acl:Control.
<#both> acl:agent <${BOB}>; acl:accessTo <./notes.txt>, <./other.txt>; acl:mode acl:Read.`,
    });

    await removeAccessWithWac(FILE, `${FILE}.acl`, BOB, server.fetch, ME);

    const written = triples(server.doc(`${FILE}.acl`)!, `${FILE}.acl`);
    const otherRule = written.find((t) => t.endsWith(`${ACL}accessTo https://pod.example/docs/other.txt`))!.split(" ")[0];
    expect(written).toContain(`${otherRule} ${ACL}agent ${BOB}`);
    expect(await levels(FILE, server.fetch)).toEqual({ [ME]: ["Read", "Write", "Control"] });
  });

  it("never touches Control rules, and refuses the user's own access", async () => {
    const server = wacServer({ [`${FILE}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>, <${BOB}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Control.` });

    await removeAccessWithWac(FILE, `${FILE}.acl`, BOB, server.fetch, ME);
    await expect(removeAccessWithWac(FILE, `${FILE}.acl`, ME, server.fetch, ME)).rejects.toThrow(OwnAccessError);

    expect(server.puts).toHaveLength(0);
  });
});

describe("removeAccessWithWac edge cases", () => {
  it("keeps the other parts of a rule naming an agent class too", async () => {
    const server = wacServer({
      [`${FILE}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Write, acl:Control.
<#read> acl:agent <${BOB}>; acl:agentClass foaf:Agent; acl:agentGroup <https://pod.example/groups#team>; acl:accessTo <./notes.txt>; acl:mode acl:Read.`,
    });

    await removeAccessWithWac(FILE, `${FILE}.acl`, BOB, server.fetch, ME);

    const written = triples(server.doc(`${FILE}.acl`)!, `${FILE}.acl`);
    expect(written).toContain(`${FILE}.acl#read http://www.w3.org/ns/auth/acl#agentClass ${FOAF_AGENT}`);
    expect(written).toContain(`${FILE}.acl#read http://www.w3.org/ns/auth/acl#agentGroup https://pod.example/groups#team`);
    expect(written.some((t) => t.endsWith(BOB))).toBe(false);
  });

  it("leaves origin-restricted rules alone", async () => {
    const server = wacServer({
      [`${FILE}.acl`]: `${PREFIXES}<#r> acl:agent <${BOB}>; acl:accessTo <./notes.txt>; acl:mode acl:Read; acl:origin <https://app.example>.`,
    });

    await removeAccessWithWac(FILE, `${FILE}.acl`, BOB, server.fetch, ME);

    expect(server.puts).toHaveLength(0);
  });

  it("stops if an ancestor can't be checked, rather than guessing the inherited rules", async () => {
    const { fetch } = fakeFetch((request) =>
      request.url === FOLDER && request.method === "HEAD"
        ? new Response(null, { status: 500 })
        : request.url.endsWith(".acl")
          ? new Response(null, { status: 404 })
          : new Response(null, { headers: { Link: `<${request.url}.acl>; rel="acl"` } }),
    );

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/Couldn't find the access rules/);
  });

  it("stops on a failed ancestor check even if it advertises an .acl", async () => {
    const { fetch, calls } = fakeFetch((request) =>
      request.url === FOLDER && request.method === "HEAD"
        ? new Response(null, { status: 403, headers: { Link: `<${FOLDER}.acl>; rel="acl"` } })
        : request.url.endsWith(".acl")
          ? new Response(null, { status: 404 })
          : new Response(null, { headers: { Link: `<${request.url}.acl>; rel="acl"` } }),
    );

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/Couldn't find the access rules/);
    expect(calls).not.toContain(`HEAD ${ROOT}`);
  });

  it("won't copy inherited rules that changed while it was working", async () => {
    let rootEtag = '"v1"';
    const puts: string[] = [];
    const { fetch } = fakeFetch(async (request) => {
      if (!request.url.endsWith(".acl")) return new Response(null, { headers: { Link: `<${request.url}.acl>; rel="acl"` } });
      if (request.method === "PUT") {
        puts.push(request.url);
        return new Response(null, { status: 201 });
      }
      if (request.url !== `${ROOT}.acl`) return new Response(null, { status: 404 });
      const response = new Response(request.method === "HEAD" ? null : ROOT_ACL, { headers: { ETag: rootEtag } });
      rootEtag = '"v2"'; // someone edits the root's rules right after we read them
      return response;
    });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/changed by someone else/);
    expect(puts).toEqual([]);
  });

  it("won't copy inherited rules if a nearer folder gained its own rules meanwhile", async () => {
    let folderAclExists = false;
    const puts: string[] = [];
    const { fetch } = fakeFetch(async (request) => {
      if (!request.url.endsWith(".acl")) return new Response(null, { headers: { Link: `<${request.url}.acl>; rel="acl"` } });
      if (request.method === "PUT") {
        puts.push(request.url);
        return new Response(null, { status: 201 });
      }
      if (request.url === `${FOLDER}.acl`) {
        const status = folderAclExists ? 200 : 404;
        folderAclExists = true; // someone creates the folder's .acl right after we looked
        return new Response(null, { status });
      }
      if (request.url === `${ROOT}.acl`) return new Response(ROOT_ACL, { headers: { ETag: '"v1"' } });
      return new Response(null, { status: 404 });
    });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/changed by someone else/);
    expect(puts).toEqual([]);
  });

  it("won't copy inherited rules it can't check for changes (no ETag)", async () => {
    const puts: string[] = [];
    const { fetch } = fakeFetch(async (request) => {
      if (!request.url.endsWith(".acl")) return new Response(null, { headers: { Link: `<${request.url}.acl>; rel="acl"` } });
      if (request.method === "PUT") puts.push(request.url);
      return request.url === `${ROOT}.acl` ? new Response(ROOT_ACL) : new Response(null, { status: 404 });
    });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/safely copying/);
    expect(puts).toEqual([]);
  });

  it("never fetches an .acl advertised on another origin", async () => {
    const { fetch, calls } = fakeFetch((request) =>
      request.url === FOLDER
        ? new Response(null, { headers: { Link: '<https://attacker.example/collect>; rel="acl"' } })
        : request.url.endsWith(".acl")
          ? new Response(null, { status: 404 })
          : new Response(null, { headers: { Link: `<${request.url}.acl>; rel="acl"` } }),
    );

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/another server/);
    await expect(getWacAccessList(FILE, "https://attacker.example/x.acl", fetch)).rejects.toThrow(/another server/);
    expect(calls.some((c) => c.includes("attacker.example"))).toBe(false);
  });

  it("refuses redirects on every .acl and ancestor request, so none can leave the checked origin", async () => {
    const redirects: string[] = [];
    const server = wacServer({ [`${ROOT}.acl`]: ROOT_ACL });
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.method !== "PUT" && (request.url.endsWith(".acl") || request.url.endsWith("/"))) redirects.push(request.redirect);
      return server.fetch(input, init);
    }) as typeof globalThis.fetch;

    await shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME);

    expect(redirects.length).toBeGreaterThan(0);
    expect(new Set(redirects)).toEqual(new Set(["error"]));
  });

  it("won't give a storage root without an .acl rules from above it", async () => {
    const { fetch, calls } = fakeFetch((request) => {
      if (request.url.endsWith(".acl")) return new Response(null, { status: 404 });
      const headers: Record<string, string> = { Link: `<${request.url}.acl>; rel="acl"` };
      if (request.url === FOLDER) headers.Link += ', <http://www.w3.org/ns/pim/space#Storage>; rel="type"';
      return new Response(null, { headers });
    });

    await expect(shareResourceWithWac(FOLDER, `${FOLDER}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/Couldn't find the access rules/);
    expect(calls).not.toContain(`HEAD ${ROOT}`);
  });

  it("stops at the storage root instead of looking above it", async () => {
    const { fetch, calls } = fakeFetch((request) => {
      if (request.url.endsWith(".acl")) return new Response(null, { status: 404 });
      const headers: Record<string, string> = { Link: `<${request.url}.acl>; rel="acl"` };
      if (request.url === FOLDER) headers.Link += ', <http://www.w3.org/ns/pim/space#Storage>; rel="type"';
      return new Response(null, { headers });
    });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/Couldn't find the access rules/);
    expect(calls).not.toContain(`HEAD ${ROOT}`);
  });

  it.each(["foaf:Agent", "acl:AuthenticatedAgent"])("won't claim to make someone a viewer when %s can already write", async (who) => {
    const server = wacServer({
      [`${FILE}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Write, acl:Control.
<#all> acl:agentClass ${who}; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Write.`,
    });

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", server.fetch, ME)).rejects.toThrow(/Everyone can already edit/);
    await shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Editor", server.fetch, ME);
    expect(server.puts).toHaveLength(1);
  });

  it("reports a conflicting change instead of overwriting it", async () => {
    const { fetch } = fakeFetch((request) =>
      request.method === "PUT"
        ? new Response(null, { status: 412 })
        : new Response(`${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./notes.txt>; acl:mode acl:Control.`, { headers: { ETag: '"v1"' } }),
    );

    await expect(shareResourceWithWac(FILE, `${FILE}.acl`, [BOB], "Viewer", fetch, ME)).rejects.toThrow(/changed by someone else/);
  });
});

describe("getWacAccessList", () => {
  it("lists a folder's rules for its contents (acl:default only) too", async () => {
    const server = wacServer({
      [`${FOLDER}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./>; acl:default <./>; acl:mode acl:Read, acl:Write, acl:Control.
<#contents> acl:agent <${BOB}>; acl:default <./>; acl:mode acl:Read, acl:Write.`,
    });

    expect(await levels(FOLDER, server.fetch)).toEqual({ [ME]: ["Read", "Write", "Control"], [BOB]: ["Read", "Write"] });
  });

  it("lists the resource's own rules, marking Control holders as not removable", async () => {
    const server = wacServer({ [`${FILE}.acl`]: `${PREFIXES}<#owner> acl:agent <${ME}>; acl:accessTo <./notes.txt>; acl:mode acl:Read, acl:Write, acl:Control.
<#public> acl:agentClass foaf:Agent; acl:accessTo <./notes.txt>; acl:mode acl:Read.` });

    expect(await getWacAccessList(FILE, `${FILE}.acl`, server.fetch)).toEqual([
      { webId: ME, accessModes: ["Read", "Write", "Control"], canRemove: false },
      { webId: FOAF_AGENT, accessModes: ["Read"], canRemove: true },
    ]);
  });
});
