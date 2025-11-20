import JSZip from "jszip";
import { getSolidDataset, getContainedResourceUrlAll, UrlString } from "@inrupt/solid-client";
import { decodeResourceNameFromUrl, ensureTrailingSlash } from "./copyUtils";

/**
 * Downloads a single file
 */
export async function downloadFile(
    fileUrl: string,
    fileName: string,
    fetchFn: typeof fetch
): Promise<void> {
    try {
        console.log("downloadFile: Starting fetch for", fileUrl);
        const response = await fetchFn(fileUrl);

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Failed to fetch file: ${response.status} ${errorText}`);
        }

        const blob = await response.blob();

        // Create a download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);

        // Trigger download immediately
        link.click();

        // Clean up after a delay to ensure download starts
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error("Failed to download file:", error);
        throw new Error(`Failed to download file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Recursively collects all files in a folder
 */
async function collectFolderFiles(
    folderUrl: string,
    fetchFn: typeof fetch,
    zip: JSZip,
    basePath: string = "",
    visited: Set<string> = new Set()
): Promise<void> {
    const normalizedUrl = ensureTrailingSlash(folderUrl);

    // Prevent infinite loops
    if (visited.has(normalizedUrl)) {
        return;
    }
    visited.add(normalizedUrl);

    try {
        const dataset = await getSolidDataset(normalizedUrl as UrlString, { fetch: fetchFn });
        const containedResources = getContainedResourceUrlAll(dataset);

        for (const resourceUrl of containedResources) {
            if (resourceUrl.endsWith("/")) {
                // It's a folder - recurse
                const folderName = decodeResourceNameFromUrl(resourceUrl);
                const folderPath = basePath ? `${basePath}/${folderName}` : folderName;
                await collectFolderFiles(resourceUrl, fetchFn, zip, folderPath, visited);
            } else {
                // It's a file - add to zip
                try {
                    const response = await fetchFn(resourceUrl);

                    if (!response.ok) {
                        console.warn(`Failed to fetch file ${resourceUrl}: ${response.status} ${response.statusText}`);
                        continue;
                    }

                    const blob = await response.blob();
                    const fileName = decodeResourceNameFromUrl(resourceUrl);
                    const filePath = basePath ? `${basePath}/${fileName}` : fileName;

                    zip.file(filePath, blob);
                } catch (error) {
                    console.warn(`Failed to add file ${resourceUrl} to zip:`, error);

                }
            }
        }
    } catch (error) {
        console.error(`Failed to access folder ${folderUrl}:`, error);
        throw error;
    }
}

/**
 * Downloads a folder as a ZIP file
 */
export async function downloadFolderAsZip(
    folderUrl: string,
    folderName: string,
    fetchFn: typeof fetch
): Promise<void> {
    try {
        const zip = new JSZip();

        // Collect all files recursively
        await collectFolderFiles(folderUrl, fetchFn, zip);

        // Generate the ZIP file
        const zipBlob = await zip.generateAsync({ type: "blob" });

        // Create a download link
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${folderName}.zip`;
        link.style.display = "none";
        document.body.appendChild(link);

        // Trigger download immediately
        link.click();

        // Clean up after a delay to ensure download starts
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error("Failed to download folder as zip:", error);
        throw new Error(`Failed to download folder: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

