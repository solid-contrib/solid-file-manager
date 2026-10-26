"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore
} from "react";
import {
    FolderTreeChild,
    ensureTrailingSlash,
    getAuthenticatedSession,
    fetchContainerListing,
    foldersFromListing,
} from "../helpers";
import {
    getContainerListing,
    loadContainerListing,
    subscribeContainerCache,
    getContainerCacheVersion,
} from "../cache";


export interface UseFolderTreeResult {
    expandedUrls: Set<string>;
    loadingUrls: Set<string>;
    errorByUrl: Record<string, string>;
    /** Child folders per expanded folder URL. */
    childrenByUrl: Record<string, FolderTreeChild[]>;
    toggleExpand: (folderUrl: string) => Promise<void>;
}

/**
 * Expand/collapse state for a lazily loaded folder tree.
 *
 * Children are never kept locally: they are read back out of the shared container cache.
 */

export function useFolderTree(): UseFolderTreeResult {
    const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
    const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
    const [errorByUrl, setErrorByUrl] = useState<Record<string, string>>({});

    const cacheVersion = useSyncExternalStore(
        subscribeContainerCache,
        getContainerCacheVersion,
        getContainerCacheVersion
    )

    // get the children from the shared cache
    const childrenByUrl = useMemo(() => {
        void cacheVersion; // force recompute when the cache changes
        const next: Record<string, FolderTreeChild[]> = {};
        for (const url of expandedUrls) {
            const cached = getContainerListing(url);
            if (cached) {
                next[url] = foldersFromListing(cached);
            }
        }
        return next;
    }, [expandedUrls, cacheVersion]);

    const expandedUrlsRef = useRef(expandedUrls);
    expandedUrlsRef.current = expandedUrls;

    // Load child folders via the shared container cache
    const loadChildren = useCallback(async (folderUrl: string) => {
        const normalizedUrl = ensureTrailingSlash(folderUrl);

        if (getContainerListing(normalizedUrl)) {
            return;
        }

        setLoadingUrls((prev) => {
            const next = new Set(prev);
            next.add(normalizedUrl);
            return next;
        });

        setErrorByUrl((prev) => {
            if (!(normalizedUrl in prev)) return prev;
            const next = { ...prev };
            delete next[normalizedUrl];
            return next;
        });

        try {
            const { fetch } = getAuthenticatedSession();
            await loadContainerListing(normalizedUrl,
                () => fetchContainerListing(normalizedUrl, fetch));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load folders";
            setErrorByUrl((prev) => ({ ...prev, [normalizedUrl]: message }));
        } finally {
            setLoadingUrls((prev) => {
                const next = new Set(prev);
                next.delete(normalizedUrl);
                return next;
            });
        }
    }, []);

    // After cache invalidation, refetch any expanded folder that no longer has a listing.
    useEffect(() => {
        return subscribeContainerCache(() => {
            for (const url of expandedUrlsRef.current) {
                if (!getContainerListing(url)) {
                    void loadChildren(url);
                }
            }
        })
    }, [loadChildren]);

    // Open or close a folder branch. Fetch children only when opening.
    const toggleExpand = useCallback(async (folderUrl: string) => {
        const normalizedUrl = ensureTrailingSlash(folderUrl);

        const isExpanded = expandedUrls.has(normalizedUrl);

        if (isExpanded) {
            setExpandedUrls((prev) => {
                const next = new Set(prev);
                next.delete(normalizedUrl);
                return next;
            });
            return;
        }

        setExpandedUrls((prev) => {
            const next = new Set(prev);
            next.add(normalizedUrl);
            return next;
        });

        await loadChildren(normalizedUrl);
    }, [expandedUrls, loadChildren]);

    return {
        expandedUrls,
        loadingUrls,
        errorByUrl,
        childrenByUrl,
        toggleExpand,
    };
}
