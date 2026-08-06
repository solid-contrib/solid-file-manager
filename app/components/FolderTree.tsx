"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon } from "@heroicons/react/24/outline";
import { SolidStorage } from "../lib/hooks/useSolidStorages";
import { FolderTreeChild, folderUrlsEqual, ensureTrailingSlash, getAuthenticatedSession, fetchContainerListing, foldersFromListing } from "../lib/helpers";
import { getContainerListing, loadContainerListing } from "../lib/cache";

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
    const [childrenByUrl, setChildrenByUrl] = useState<Record<string, FolderTreeChild[]>>({});
    const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
    const [errorByUrl, setErrorByUrl] = useState<Record<string, string>>({});

    // Keep the current folder URL in one shape so highlight checks stay reliable.
    const normalizedCurrentFolderUrl = useMemo(() => (
        currentFolderUrl ? ensureTrailingSlash(currentFolderUrl) : null
    ), [currentFolderUrl]);

    // Load child folders via the shared container cache (same data as main browse).
    const loadChildren = useCallback(async (folderUrl: string) => {
        const normalizedUrl = ensureTrailingSlash(folderUrl);

        const cached = getContainerListing(normalizedUrl);
        if (cached) {
            setChildrenByUrl((prev) => ({
                ...prev,
                [normalizedUrl]: foldersFromListing(cached),
            }));
            return;
        }

        if (childrenByUrl[normalizedUrl]) {
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
            const listing = await loadContainerListing(
                normalizedUrl,
                () => fetchContainerListing(normalizedUrl, fetch),
            );
            setChildrenByUrl((prev) => ({
                ...prev,
                [normalizedUrl]: foldersFromListing(listing),
            }));
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
    }, [childrenByUrl]);

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
    const renderNode = useCallback((node: FolderTreeChild, depth: number) => {
        const nodeUrl = ensureTrailingSlash(node.url);
        const isExpanded = expandedUrls.has(nodeUrl);
        const isLoading = loadingUrls.has(nodeUrl);
        const children = childrenByUrl[nodeUrl] || [];
        const hasError = Boolean(errorByUrl[nodeUrl]);
        const isCurrent = normalizedCurrentFolderUrl != null && folderUrlsEqual(normalizedCurrentFolderUrl, nodeUrl);

        return (
            <li key={nodeUrl}>
                <div
                    className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm ${isCurrent ? "bg-[#F3EDFF] text-black font-medium" : "text-gray-700 hover:bg-gray-100"
                        }`}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                    <button
                        type="button"
                        onClick={() => void toggleExpand(nodeUrl)}
                        className="rounded p-0.5 hover:bg-gray-200"
                        aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? (
                            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                        ) : (
                            <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate(nodeUrl)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        title={node.name}
                        aria-current={isCurrent ? "page" : undefined}
                    >
                        <FolderIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{node.name}</span>
                    </button>
                </div>

                {isExpanded && (
                    <ul className="space-y-0.5">
                        {isLoading && (
                            <li
                                className="px-2 py-1 text-xs text-gray-500"
                                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                                aria-live="polite"
                            >
                                Loading...
                            </li>
                        )}

                        {!isLoading && hasError && (
                            <li
                                className="px-2 py-1 text-xs text-red-600"
                                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                            >
                                Failed to load folders
                            </li>
                        )}

                        {!isLoading && !hasError && children.length === 0 && (
                            <li
                                className="px-2 py-1 text-xs text-gray-500"
                                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                            >
                                No folders
                            </li>
                        )}

                        {!isLoading && !hasError && children.map((child) => renderNode(child, depth + 1))}
                    </ul>
                )}
            </li>
        )
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
        return <p className="px-3 py-2 text-sm text-gray-500">No storages found</p>
    }

    return (
        <ul className="space-y-0.5" aria-label="My Storages">
            {rootNodes.map((node) => renderNode(node, 0))}
        </ul>
    );
}
