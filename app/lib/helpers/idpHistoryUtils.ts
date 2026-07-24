const LAST_IDP_KEY = "solid-file-manager-last-idp";

export function getLastIdp(): string {
  if (typeof window === "undefined") return "";

  try {
    return localStorage.getItem(LAST_IDP_KEY)?.trim() ?? "";
  } catch (error) {
    console.warn(
      "Could not read last identity provider from localStorage",
      error,
    );
    return "";
  }
}

export function saveLastIdp(issuer: string): void {
  if (typeof window === "undefined") return;
  const value = issuer.trim();
  if (!value) return;
  try {
    localStorage.setItem(LAST_IDP_KEY, value);
  } catch (error) {
    console.warn(
      "Could not save last identity provider to localStorage",
      error,
    );
  }
}
