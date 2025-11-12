/**
 * Helper functions for filtering files and storage items
 */

/**
 * Checks if a URL or name represents a profile-related item that should be hidden from the file manager
 * @param url - The URL to check
 * @param name - Optional name to check (for additional filtering)
 * @returns true if the item should be filtered out (is profile-related)
 */
export function isProfileItem(url: string, name?: string): boolean {
  const urlLower = url.toLowerCase();
  const nameLower = name?.toLowerCase() || "";
  
  return (
    urlLower.includes('/profile/') ||
    urlLower.includes('/card') ||
    urlLower.endsWith('/profile') ||
    urlLower.includes('profile/card') ||
    nameLower.includes('card')
  );
}

/**
 * Filters out profile-related items from an array of file/storage data
 * @param items - Array of items with url and optional name properties
 * @returns Filtered array without profile-related items
 */
export function filterProfileItems<T extends { url: string; name?: string }>(
  items: T[]
): T[] {
  return items.filter((item) => !isProfileItem(item.url, item.name));
}

