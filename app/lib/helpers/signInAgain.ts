const LAST_RUN_KEY = "solid-file-manager-sign-in-again-at";
/** Never send the user back to login more than once in this window (avoids loops). */
const MIN_INTERVAL_MS = 2 * 60_000;

interface SignInAgainOptions {
  logout: () => Promise<void>;
  navigate: (url: string) => void;
  /** The current path and query, e.g. "/?url=…". */
  currentPath: () => string;
  storage?: Pick<Storage, "getItem" | "setItem">;
  now?: () => number;
}

/**
 * Signs out and sends the user to /login, returning them to the current page
 * afterwards. Used when the session can no longer reach a server (e.g. ESS
 * token exchange has no valid ID token). Runs at most once per page and once
 * per two minutes, so a server that keeps refusing can't cause a login loop.
 * (If the browser blocks sessionStorage, only the once-per-page limit applies.)
 */
export function createSignInAgain({ logout, navigate, currentPath, storage, now = Date.now }: SignInAgainOptions) {
  let started = false;

  return async (): Promise<void> => {
    if (started) return;
    try {
      const lastRun = Number(storage?.getItem(LAST_RUN_KEY) ?? 0);
      if (lastRun && now() - lastRun < MIN_INTERVAL_MS) return;
      storage?.setItem(LAST_RUN_KEY, String(now()));
    } catch {
      // Storage unavailable: the per-page guard still applies.
    }
    started = true;

    try {
      await logout();
    } catch {
      // Still go to login; the session is unusable anyway.
    }
    const here = currentPath();
    navigate(here === "/" || here.startsWith("/login") ? "/login" : `/login?returnTo=${encodeURIComponent(here)}`);
  };
}
