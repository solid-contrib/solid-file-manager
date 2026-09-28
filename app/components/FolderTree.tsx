"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight, ChevronDown, Folder } from "lucide-react";
import { SolidStorage } from "../lib/hooks/useSolidStorages";
import { FolderTreeChild, folderUrlsEqual, ensureTrailingSlash, getAuthenticatedSession, fetchContainerListing, foldersFromListing } from "../lib/helpers";
import { getContainerListing, loadContainerListing, subscribeContainerCache, getContainerCacheVersion } from "../lib/cache";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

interface FolderTreeProps {
    storages: SolidStorage[];
    currentFolderUrl?: string | null;
    onNavigate: (folderUrl: string) => void;
}

export default function FolderTree({
    storages,
    currentFolderUrl,
    onNavigate
}: FolderTreeProps) {
    const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
    const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
    const [errorByUrl, setErrorByUrl] = useState<Record<string, string>>({});

    const cacheVersion = useSyncExternalStore(
        subscribeContainerCache,
        getContainerCacheVersion,
        getContainerCacheVersion,
    )

    // Children come from the shared cache, not a local copy.
    // cacheVersion makes this recompute when listings are written or invalidated.
    const childrenByUrl = useMemo(() => {
        // cacheVersion is read so listings recompute after cache writes/invalidation.
        void cacheVersion;
        const next: Record<string, FolderTreeChild[]> = {};
        for (const url of expandedUrls) {
            const cached = getContainerListing(url);
            if (cached) {
                next[url] = foldersFromListing(cached);
            }
        }
        return next;
    }, [cacheVersion, expandedUrls])

    const expandedUrlsRef = useRef(expandedUrls);
    expandedUrlsRef.current = expandedUrls;

    // Keep the current folder URL in one shape so highlight checks stay reliable.
    const normalizedCurrentFolderUrl = useMemo(() => (
        currentFolderUrl ? ensureTrailingSlash(currentFolderUrl) : null
    ), [currentFolderUrl]);

    // Load child folders via the shared container cache (same data as main browse).
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
            await loadContainerListing(
                normalizedUrl,
                () => fetchContainerListing(normalizedUrl, fetch),
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to load folders";
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
                    void loadChildren(url)
                }
            }
        })
    }, [loadChildren])

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

    // Render one folder row and its nested children when expanded.
    const renderNode = useCallback((node: FolderTreeChild) => {
        const nodeUrl = ensureTrailingSlash(node.url);
        const isExpanded = expandedUrls.has(nodeUrl);
        const isLoading = loadingUrls.has(nodeUrl);
        const children = childrenByUrl[nodeUrl] || [];
        const hasError = Boolean(errorByUrl[nodeUrl]);
        const isCurrent = normalizedCurrentFolderUrl != null && folderUrlsEqual(normalizedCurrentFolderUrl, nodeUrl);

        return (
            <SidebarMenuItem key={nodeUrl}>
                <div className="flex w-full items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => void toggleExpand(nodeUrl)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                        aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                    </button>

                    <SidebarMenuButton
                        isActive={isCurrent}
                        className="flex-1"
                        onClick={() => onNavigate(nodeUrl)}
                        title={node.name}
                        aria-current={isCurrent ? "page" : undefined}
                    >
                        <Folder aria-hidden="true" />
                        <span>{node.name}</span>
                    </SidebarMenuButton>
                </div>

                {isExpanded && (
                    <SidebarMenuSub>
                        {isLoading && (
                            <SidebarMenuSubItem>
                                <SidebarMenuSkeleton showIcon />
                            </SidebarMenuSubItem>
                        )}

                        {!isLoading && hasError && (
                            <SidebarMenuSubItem>
                                <p className="px-2 py-1 text-xs text-destructive">
                                    Failed to load folders
                                </p>
                            </SidebarMenuSubItem>
                        )}

                        {!isLoading &&
                            !hasError &&
                            children.map((child) => renderNode(child))}
                    </SidebarMenuSub>
                )}
            </SidebarMenuItem>
        );
    }, [
        childrenByUrl,
        errorByUrl,
        expandedUrls,
        loadingUrls,
        normalizedCurrentFolderUrl,
        onNavigate,
        toggleExpand,
    ],
    );

    // Turn storage roots into the same shape used by child folder nodes.
    const rootNodes: FolderTreeChild[] = useMemo(
        () =>
            storages.map((storage) => ({
                url: ensureTrailingSlash(storage.url),
                name: storage.name || storage.url,
            })), [storages],
    );

    if (rootNodes.length === 0) {
        return (
            <p className="px-3 py-2 text-sm text-muted-foreground">
                No storages found
            </p>
        );
    }
    return (
        <SidebarMenu aria-label="My Storages">
            {rootNodes.map((node) => renderNode(node))}
        </SidebarMenu>
    );
}
