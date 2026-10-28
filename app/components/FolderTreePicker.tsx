"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    FolderTreeChild,
    ensureTrailingSlash,
    folderUrlsEqual,
    getAncestorFolderUrls
} from "../lib/helpers";
import { useFolderTree, type UseFolderTreeResult } from "../lib/hooks";

interface FolderTreePickerProps {
    roots: FolderTreeChild[];
    selectedUrl: string | null;
    onSelect: (folderUrl: string) => void;
    /**
     * A folder that may be browsed but cannot be chosen, e.g the one the resource is
     * already in.
     */
    currentUrl?: string | null;
}

export default function FolderTreePicker({
    roots,
    selectedUrl,
    onSelect,
    currentUrl,
}: FolderTreePickerProps) {
    const tree = useFolderTree();
    const { expandPath } = tree;

    // Expand the path to the current folder so the user can see where they are.
    const revealUrls = [
        ...new Set([
            ...roots.map((root) => ensureTrailingSlash(root.url)),
            ...(currentUrl ? roots.flatMap((root) =>
                getAncestorFolderUrls(currentUrl, root.url)) : []),
        ]),
    ];

    // make sure the path to the current folder is expanded once when the component mounts
    const revealKey = revealUrls.join("|");

    useEffect(() => {
        if (!revealKey) {
            return;
        }
        void expandPath(revealKey.split("|"));
    }, [revealKey, expandPath]);

    if (roots.length === 0) {
        return (
            <p className="px-4 py-3 text-sm text-muted-foreground">
                No folders available
            </p>
        );
    }

    return (
        <ul role="tree" aria-label="Destination folders" className="py-1">
            {roots.map((root) => (
                <FolderTreeNode
                    key={ensureTrailingSlash(root.url)}
                    node={root}
                    depth={0}
                    tree={tree}
                    selectedUrl={selectedUrl}
                    currentUrl={currentUrl}
                    onSelect={onSelect}
                />
            ))}
        </ul>
    );
}

interface FolderTreeNodeProps {
    node: FolderTreeChild;
    depth: number;
    /** Shared expand/load state, passed whole so the recursion stays readable. */
    tree: UseFolderTreeResult;
    selectedUrl: string | null;
    currentUrl?: string | null;
    onSelect: (folderUrl: string) => void;
}

/** One folder row, plus its children when the branch is open. */
function FolderTreeNode({
    node,
    depth,
    tree,
    selectedUrl,
    currentUrl,
    onSelect,
}: FolderTreeNodeProps) {
    const nodeUrl = ensureTrailingSlash(node.url);
    const isExpanded = tree.expandedUrls.has(nodeUrl);
    const isLoading = tree.loadingUrls.has(nodeUrl);
    const hasError = Boolean(tree.errorByUrl[nodeUrl]);
    const children = tree.childrenByUrl[nodeUrl];
    const isSelected =
        selectedUrl !== null && folderUrlsEqual(selectedUrl, nodeUrl);
    const isCurrent =
        currentUrl != null && folderUrlsEqual(currentUrl, nodeUrl);

    const rowRef = useRef<HTMLDivElement>(null);

    // Scroll the current folder into view.
    useEffect(() => {
        if (isCurrent) {
            rowRef.current?.scrollIntoView({ block: "nearest" });
        }
    }, [isCurrent]);

    const childIndent = `${(depth + 1) * 1.25 + 0.5}rem`;

    return (
        <li
            role="treeitem"
            aria-expanded={isExpanded}
            aria-selected={isSelected}
            aria-disabled={isCurrent || undefined}
        >
            <div
                ref={rowRef}
                className={cn(
                    "flex items-center gap-1 border-l-4 pr-2 transition-colors",
                    isSelected
                        ? "border-primary bg-primary/20"
                        : "border-transparent hover:bg-primary/10",
                )}
                style={{ paddingLeft: `${depth * 1.25}rem` }}
            >
                <button
                    type="button"
                    onClick={() => void tree.toggleExpand(nodeUrl)}
                                        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-primary/20"
                    aria-label={
                        isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`
                    }
                >
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => onSelect(nodeUrl)}
                    disabled={isCurrent}
                    title={node.name}
                                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Folder
                        className="h-5 w-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <span className="truncate text-sm text-foreground">{node.name}</span>
                    {isCurrent && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                            (current)
                        </span>
                    )}
                </button>
            </div>

            {isExpanded && (
                <ul role="group">
                    {isLoading && (
                        <li className="py-2 pr-2" style={{ paddingLeft: childIndent }}>
                            <Skeleton className="h-5 w-40" />
                        </li>
                    )}

                    {!isLoading && hasError && (
                        <li
                            className="py-2 pr-2 text-xs text-destructive"
                            style={{ paddingLeft: childIndent }}
                        >
                            Failed to load folders
                        </li>
                    )}

                    {!isLoading && !hasError && children?.length === 0 && (
                        <li
                            className="py-2 pr-2 text-xs text-muted-foreground"
                            style={{ paddingLeft: childIndent }}
                        >
                            No subfolders
                        </li>
                    )}

                    {!isLoading &&
                        !hasError &&
                        children?.map((child) => (
                            <FolderTreeNode
                                key={ensureTrailingSlash(child.url)}
                                node={child}
                                depth={depth + 1}
                                tree={tree}
                                selectedUrl={selectedUrl}
                                currentUrl={currentUrl}
                                onSelect={onSelect}
                            />
                        ))}
                </ul>
            )}
        </li>
    );
}
