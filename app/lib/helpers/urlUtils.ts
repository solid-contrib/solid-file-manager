/**
 * URL utility functions for processing and extracting information from URLs
 */

/**
 * Extracts a display name from a URL
 * @param url - The URL to extract the name from
 * @returns The decoded name extracted from the URL path
 */
export function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    let name = pathParts[pathParts.length - 1] || urlObj.hostname;
    
    try {
      name = decodeURIComponent(name);
    } catch (e) {
      // Keep original name if decoding fails
    }
    
    return name;
  } catch (e) {
    // If URL parsing fails, try to extract from the string directly
    const parts = url.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] || url;
    try {
      return decodeURIComponent(lastPart);
    } catch {
      return lastPart;
    }
  }
}

/**
 * Resolves a relative URL to an absolute URL
 * @param url - The URL to resolve (may be relative or absolute)
 * @param baseUrl - The base URL to resolve against
 * @returns The absolute URL
 */
export function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch (e) {
    return url;
  }
}

/**
 * Checks if a URL has a file extension that indicates it's likely a file
 * @param url - The URL to check
 * @returns true if the URL has a known file extension
 */
export function isLikelyFile(url: string): boolean {
  const fileExtension = url.split('.').pop()?.toLowerCase();
  const knownFileExtensions = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'pdf'];
  return fileExtension ? knownFileExtensions.includes(fileExtension) : false;
}

