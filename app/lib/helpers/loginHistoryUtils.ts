const LAST_ENTRY_KEY = "solid-file-manager-last-idp";

export function getLastLoginEntry(): string {
  if (typeof window === "undefined") return "";

  try {
    return localStorage.getItem(LAST_ENTRY_KEY)?.trim() ?? "";
  } catch (error) {
    console.warn("Could not read the last login entry from localStorage", error);
    return "";
  }
}

export function saveLastLoginEntry(entry: string): void {
  if (typeof window === "undefined") return;
  const value = entry.trim();
  if (!value) return;
  try {
    localStorage.setItem(LAST_ENTRY_KEY, value);
  } catch (error) {
    console.warn("Could not save the last login entry to localStorage", error);
  }
}
