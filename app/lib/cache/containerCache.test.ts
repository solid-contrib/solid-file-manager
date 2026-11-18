import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearContainerCache,
  getContainerListing,
  invalidateContainerListing,
  loadContainerListing,
  subscribeContainerCache,
  type ContainerListing,
} from "./containerCache";

const FOLDER = "https://pod.example/docs/";
const listing = (...names: string[]) =>
  names.map((name) => ({ name, url: FOLDER + name })) as unknown as ContainerListing;

beforeEach(() => clearContainerCache());

describe("loadContainerListing", () => {
  it("serves a cached listing without calling the loader again", async () => {
    const loader = vi.fn(async () => listing("a.txt"));

    await loadContainerListing(FOLDER, loader);
    const second = await loadContainerListing(FOLDER, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toEqual(listing("a.txt"));
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const loader = vi.fn(async () => listing("a.txt"));

    await Promise.all([loadContainerListing(FOLDER, loader), loadContainerListing(FOLDER, loader)]);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("treats URLs with and without a trailing slash as the same folder", async () => {
    await loadContainerListing("https://pod.example/docs", async () => listing("a.txt"));

    expect(getContainerListing(FOLDER)).toEqual(listing("a.txt"));
  });

  it("reloads when forced", async () => {
    const loader = vi.fn(async () => listing("a.txt"));

    await loadContainerListing(FOLDER, loader);
    await loadContainerListing(FOLDER, loader, { force: true });

    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("invalidateContainerListing", () => {
  it("drops the cached listing and notifies subscribers", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeContainerCache(listener);
    await loadContainerListing(FOLDER, async () => listing("a.txt"));
    listener.mockClear();

    invalidateContainerListing(FOLDER);

    expect(getContainerListing(FOLDER)).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  // KNOWN BUG (baseline review, 2026-11-16): this records today's behaviour.
  // Once fixed, the listing should be undefined; flip the assertion then.
  it("KNOWN BUG: a load that was in flight restores a stale listing after invalidation", async () => {
    let finish: ((items: ContainerListing) => void) | undefined;
    const pending = loadContainerListing(
      FOLDER,
      () => new Promise<ContainerListing>((resolve) => (finish = resolve)),
    );
    expect(finish).toBeTypeOf("function");

    invalidateContainerListing(FOLDER);
    finish?.(listing("stale.txt"));
    await pending;

    expect(getContainerListing(FOLDER)).toEqual(listing("stale.txt"));
  });
});
