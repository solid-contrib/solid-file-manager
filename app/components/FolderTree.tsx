"use client";

import { useMemo} from "react";
import { ChevronRight, ChevronDown, Folder } from "lucide-react";
import { SolidStorage } from "../lib/hooks/useSolidStorages";
import { FolderTreeChild, folderUrlsEqual, ensureTrailingSlash } from "../lib/helpers";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useFolderTree } from "../lib/hooks/useFolderTree";

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
    const { expandedUrls, loadingUrls, errorByUrl, childrenByUrl, toggleExpand } =
        useFolderTree();

    // Keep the current folder URL in one shape so highlight checks stay reliable.
    const normalizedCurrentFolderUrl = useMemo(() => (
        currentFolderUrl ? ensureTrailingSlash(currentFolderUrl) : null
    ), [currentFolderUrl]);

    // Render one folder row and its nested children when expanded.
    function renderNode(node: FolderTreeChild) {
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

                {isExpanded && (isLoading || hasError || children.length > 0) && (
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
    }

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
