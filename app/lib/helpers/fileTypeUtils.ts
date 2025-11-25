/**
 * Determines the file type based on URL, MIME type, and filename
 * @param fileUrl - The URL of the file
 * @param mimeType - Optional MIME type of the file
 * @param fileName - Optional filename (useful for files without extensions)
 * @returns The detected file type
 */
export function getFileType(
  fileUrl: string,
  mimeType?: string,
  fileName?: string
): "image" | "pdf" | "doc" | "text" | "other" {
  // Prioritize MIME type (content type) over file extension
  if (mimeType) {
    // Images
    if (mimeType.startsWith("image/")) return "image";
    
    // PDFs
    if (mimeType === "application/pdf") return "pdf";
    
    // Word documents
    if (
      mimeType === "application/msword" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/vnd.ms-word.document.macroEnabled.12"
    )
      return "doc";
    
    // Text files - check various text MIME types
    if (mimeType.startsWith("text/")) return "text";
    
    // JSON, XML, and other text-based formats
    if (
      mimeType === "application/json" ||
      mimeType === "application/xml" ||
      mimeType === "text/xml" ||
      mimeType === "application/javascript" ||
      mimeType === "application/x-javascript" ||
      mimeType === "text/javascript" ||
      mimeType === "application/x-sh" ||
      mimeType === "application/x-yaml" ||
      mimeType === "text/yaml" ||
      mimeType === "application/x-csv" ||
      mimeType === "text/csv"
    )
      return "text";
  }

  // Check for common text file names without extensions
  const fileNameUpper = fileName?.toUpperCase() || "";
  const commonTextFiles = [
    "README",
    "LICENSE",
    "CHANGELOG",
    "CONTRIBUTING",
    "AUTHORS",
    "COPYING",
    "INSTALL",
    "MAKEFILE",
    "DOCKERFILE",
    ".GITIGNORE",
    ".GITATTRIBUTES",
    ".ENV",
  ];
  if (
    commonTextFiles.some(
      (name) => fileNameUpper === name || fileNameUpper.startsWith(name)
    )
  ) {
    return "text";
  }

  const extension = fileUrl.split(".").pop()?.toLowerCase();
  const imageExtensions = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "svg",
    "bmp",
    "ico",
  ];
  const textExtensions = [
    "txt",
    "md",
    "json",
    "xml",
    "html",
    "css",
    "js",
    "ts",
    "jsx",
    "tsx",
    "csv",
    "log",
  ];

  if (extension && imageExtensions.includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (extension === "doc" || extension === "docx") return "doc";
  if (extension && textExtensions.includes(extension)) return "text";

  return "other";
}

