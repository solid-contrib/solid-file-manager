/**
 * Helper functions for managing rename metadata in localStorage
 * This is a fallback when the server doesn't support metadata updates
 */

const RENAME_METADATA_KEY = "solid-file-manager-rename-metadata";

interface RenameMetadata {
  [resourceUrl: string]: string; // Maps resource URL to custom display name
}

/**
 * Get all rename metadata from localStorage
 */
export function getRenameMetadata(): RenameMetadata {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = localStorage.getItem(RENAME_METADATA_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Failed to parse rename metadata:", error);
    return {};
  }
}

/**
 * Get the custom name for a resource, if it exists
 */
export function getCustomName(resourceUrl: string): string | null {
  const metadata = getRenameMetadata();
  return metadata[resourceUrl] || null;
}

/**
 * Set a custom name for a resource
 */
export function setCustomName(resourceUrl: string, customName: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const metadata = getRenameMetadata();
    metadata[resourceUrl] = customName;
    localStorage.setItem(RENAME_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error("Failed to save rename metadata:", error);
  }
}

/**
 * Remove a custom name for a resource
 */
export function removeCustomName(resourceUrl: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const metadata = getRenameMetadata();
    delete metadata[resourceUrl];
    localStorage.setItem(RENAME_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error("Failed to remove rename metadata:", error);
  }
}

/**
 * Clear all rename metadata
 */
export function clearRenameMetadata(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(RENAME_METADATA_KEY);
  } catch (error) {
    console.error("Failed to clear rename metadata:", error);
  }
}

