import { ensureTrailingSlash } from "../helpers";
import type { FileItemData } from "@/app/components/FileItem";

export type ContainerListing = FileItemData[];

type CacheEntry = {
  items: ContainerListing;
};

type CacheListener = () => void;

let cacheVersion = 0;
const listings = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ContainerListing>>();
const listeners = new Set<CacheListener>();

function cacheKey(containerUrl: string): string {
  return ensureTrailingSlash(containerUrl);
}

function notifyCacheListeners(): void {
  cacheVersion += 1;
  listeners.forEach((listener) => listener());
}

/** Returns a cached listing, or undefined on miss. */
export function getContainerListing(
  containerUrl: string,
): ContainerListing | undefined {
  return listings.get(cacheKey(containerUrl))?.items;
}

/** Store a container listing in the shared cache. */
export function setContainerListing(
  containerUrl: string,
  items: ContainerListing,
): void {
  listings.set(cacheKey(containerUrl), { items });
  notifyCacheListeners();
}

/** Subscribe to cache invalidation (e.g. FolderTree local mirror). */
export function subscribeContainerCache(listener: CacheListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getContainerCacheVersion(): number {
  return cacheVersion;
}

/** Drop one container from the cache (and any in-flight fetch for it). */
export function invalidateContainerListing(containerUrl: string): void {
  const key = cacheKey(containerUrl);
  listings.delete(key);
  inflight.delete(key);
  notifyCacheListeners();
}

/** Clear all cached listing (e.g on logout)  */
export function clearContainerCache(): void {
  listings.clear();
  inflight.clear();
  notifyCacheListeners();
}

/**
 * Fetch with shared cache + in-flight dedupe.
 * - Cache hit → return immediately
 * - Same URL already fetching → await the same promise
 * - Otherwise → call loader, store result, return it
 *
 * Pass force: true to bypass cache (used after mutations / refreshKey).
 */
export async function loadContainerListing(
  containerUrl: string,
  loader: () => Promise<ContainerListing>,
  options?: { force?: boolean },
): Promise<ContainerListing> {
  const key = cacheKey(containerUrl);

  if (!options?.force) {
    const cached = listings.get(key);
    if (cached) {
      return cached.items;
    }

    const pending = inflight.get(key);
    if (pending) {
      return pending;
    }
  }

  const request = loader()
    .then((items) => {
      listings.set(key, { items });
      notifyCacheListeners();
      return items;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}
