/**
 * Breadcrumb utility functions for building navigation breadcrumbs
 */

export interface BreadcrumbItem {
  name: string;
  path: string;
}

/**
 * Builds breadcrumb items for navigation within a storage
 * @param selectedStorageId - The ID of the currently selected storage
 * @param selectedStorageUrl - The URL of the currently selected storage
 * @param selectedStorageName - The name of the currently selected storage
 * @param currentPath - The current path within the storage
 * @returns Array of breadcrumb items
 */
export function buildBreadcrumbItems(
  selectedStorageId: string | null,
  selectedStorageUrl: string | undefined,
  selectedStorageName: string | undefined,
  currentPath: string
): BreadcrumbItem[] {
  if (!selectedStorageId) {
    return [{ name: "My Solid Storages", path: "/" }];
  }

  const items: BreadcrumbItem[] = [
    { name: "My Solid Storages", path: "/" },
    { name: selectedStorageName || "Storage", path: selectedStorageUrl || "/" },
  ];

  if (currentPath !== "/" && currentPath !== selectedStorageUrl) {
    const storageUrl = selectedStorageUrl || "";
    const storagePath = new URL(storageUrl).pathname;
    const currentPathObj = new URL(currentPath);
    const relativePath = currentPathObj.pathname
      .replace(storagePath, "")
      .replace(/^\/|\/$/g, "");
    const segments = relativePath.split("/").filter(Boolean);
    
    segments.forEach((segment, index) => {
      const pathSegments = segments.slice(0, index + 1);
      const path = storageUrl + pathSegments.join("/") + "/";
      items.push({ name: decodeURIComponent(segment), path });
    });
  }

  return items;
}

