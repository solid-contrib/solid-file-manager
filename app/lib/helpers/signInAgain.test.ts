import { describe, expect, it, vi } from "vitest";
import { createSignInAgain } from "./signInAgain";

function setUp(path = "/?url=https%3A%2F%2Fpod.example%2F", startAt = 1_000_000) {
  let now = startAt;
  const memory = new Map<string, string>();
  const logout = vi.fn(async () => {});
  const navigate = vi.fn();
  const signInAgain = createSignInAgain({
    logout,
    navigate,
    currentPath: () => path,
    storage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) },
    now: () => now,
  });
  return { signInAgain, logout, navigate, advance: (ms: number) => (now += ms) };
}

describe("createSignInAgain", () => {
  it("signs out, then goes to login with a way back to the current page", async () => {
    const { signInAgain, logout, navigate } = setUp();

    await signInAgain();

    expect(logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/login?returnTo=%2F%3Furl%3Dhttps%253A%252F%252Fpod.example%252F");
    expect(logout.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });

  it("goes to plain /login from the home page", async () => {
    const { signInAgain, navigate } = setUp("/");

    await signInAgain();

    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("runs once per page, however many requests fail", async () => {
    const { signInAgain, logout } = setUp();

    await Promise.all([signInAgain(), signInAgain(), signInAgain()]);

    expect(logout).toHaveBeenCalledOnce();
  });

  it("does not send the user back to login again within two minutes (no loops)", async () => {
    const first = setUp();
    await first.signInAgain();

    const reloaded = createSignInAgain({
      logout: first.logout,
      navigate: first.navigate,
      currentPath: () => "/",
      storage: { getItem: () => String(1_000_000), setItem: () => {} },
      now: () => 1_000_000 + 60_000,
    });
    await reloaded();

    expect(first.navigate).toHaveBeenCalledOnce();
  });

  it("still goes to login if signing out fails", async () => {
    const { signInAgain, logout, navigate } = setUp("/");
    logout.mockRejectedValueOnce(new Error("network"));

    await signInAgain();

    expect(navigate).toHaveBeenCalledWith("/login");
  });
});
