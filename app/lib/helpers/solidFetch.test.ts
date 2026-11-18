import { describe, expect, it, vi } from "vitest";
import { createOwnServers } from "./ownServers";
import { createSolidFetch } from "./solidFetch";

const sessionWith = (isLoggedIn: boolean, webId?: string) => ({
  info: { isLoggedIn, sessionId: "test", webId },
  fetch: vi.fn(async () => new Response("ok")),
});

describe("createSolidFetch", () => {
  it("sends requests through the logged-in session's fetch", async () => {
    const session = sessionWith(true);
    const solidFetch = createSolidFetch(() => session);

    const response = await solidFetch("https://pod.example/a.txt", { method: "HEAD" });

    expect(await response.text()).toBe("ok");
    expect(session.fetch).toHaveBeenCalledWith("https://pod.example/a.txt", { method: "HEAD" });
  });

  it("rejects rather than sending an unauthenticated request when logged out", async () => {
    const session = sessionWith(false);
    const solidFetch = createSolidFetch(() => session);

    await expect(solidFetch("https://pod.example/a.txt")).rejects.toThrow("Not authenticated");
    expect(session.fetch).not.toHaveBeenCalled();
  });

  it("looks the session up on every call, so it follows login and logout", async () => {
    let session = sessionWith(false);
    const solidFetch = createSolidFetch(() => session);

    await expect(solidFetch("https://pod.example/a.txt")).rejects.toThrow();
    session = sessionWith(true);
    await expect(solidFetch("https://pod.example/a.txt")).resolves.toBeInstanceOf(Response);
  });

  describe("with a login scope", () => {
    const WEBID = "https://id.example/alice#me";
    function setup(storages: string[] = []) {
      const session = sessionWith(true, WEBID);
      const plainFetch = vi.fn(async () => new Response("plain"));
      const own = createOwnServers();
      const releases = storages.map((url) => own.add(url, WEBID));
      const solidFetch = createSolidFetch(() => session, { isOwn: (url, webId) => own.includes(url, webId), plainFetch });
      return { session, plainFetch, own, solidFetch, releases };
    }

    it("logs in to the WebID's server and the user's storages", async () => {
      const { session, plainFetch, solidFetch } = setup(["https://storage.example/alice/"]);

      await solidFetch("https://id.example/alice");
      await solidFetch(new URL("https://storage.example/alice/notes.txt"));
      await solidFetch(new Request("https://storage.example/other-path/"));

      expect(session.fetch).toHaveBeenCalledTimes(3);
      expect(plainFetch).not.toHaveBeenCalled();
    });

    it.each([
      ["a contact's profile", "https://bob.example/profile/card#me"],
      ["a lookalike host", "https://storage.example.evil.example/alice/"],
      ["another port", "https://storage.example:8443/alice/"],
      ["plain http on the same host", "http://storage.example/alice/"],
    ])("sends %s without the login", async (_label, url) => {
      const { session, plainFetch, solidFetch } = setup(["https://storage.example/alice/"]);

      expect(await (await solidFetch(url, { method: "GET" })).text()).toBe("plain");
      expect(plainFetch).toHaveBeenCalledWith(url, { method: "GET" });
      expect(session.fetch).not.toHaveBeenCalled();
    });

    it("still rejects when logged out, rather than sending anything", async () => {
      const plainFetch = vi.fn(async () => new Response("plain"));
      const solidFetch = createSolidFetch(() => sessionWith(false), { isOwn: () => false, plainFetch });

      await expect(solidFetch("https://bob.example/")).rejects.toThrow("Not authenticated");
      expect(plainFetch).not.toHaveBeenCalled();
    });

    it("stops logging in to a storage once released, but keeps others on the same server", async () => {
      const { session, plainFetch, solidFetch, releases } = setup(["https://storage.example/a/", "https://storage.example/b/"]);

      releases[0]();
      releases[0](); // releasing twice doesn't undo the other registration
      await solidFetch("https://storage.example/a/x");
      releases[1]();
      await solidFetch("https://storage.example/a/x");

      expect(session.fetch).toHaveBeenCalledTimes(1);
      expect(plainFetch).toHaveBeenCalledTimes(1);
    });

    it("only counts storages registered for the WebID signed in now", async () => {
      const { session, plainFetch, own, solidFetch } = setup();

      own.add("https://previous-account.example/", "https://someone-else.example/#me");
      await solidFetch("https://previous-account.example/private");

      expect(plainFetch).toHaveBeenCalledTimes(1);
      expect(session.fetch).not.toHaveBeenCalled();
    });

    it("ignores a stale release from before logout, keeping the new registration", async () => {
      const { session, own, solidFetch, releases } = setup(["https://storage.example/alice/"]);

      own.clear(); // logout
      own.add("https://storage.example/alice/", WEBID); // signed back in
      releases[0](); // a check from the earlier session finishes now
      await solidFetch("https://storage.example/alice/");

      expect(session.fetch).toHaveBeenCalledTimes(1);
    });

    it("forgets every storage on clear (logout)", async () => {
      const { session, plainFetch, own, solidFetch } = setup(["https://storage.example/alice/"]);

      own.clear();
      await solidFetch("https://storage.example/alice/");

      expect(plainFetch).toHaveBeenCalledTimes(1);
      expect(session.fetch).not.toHaveBeenCalled();
    });
  });
});
