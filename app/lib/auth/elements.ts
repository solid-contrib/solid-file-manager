let registration: Promise<void> | null = null;

// Dynamic import: the module runs customElements.define() on classes extending
// HTMLElement as soon as it loads, which throws during server rendering. Call
// this from an effect.
export function ensureElementsRegistered(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error(
      "ensureElementsRegistered() must run in the browser: the element module extends HTMLElement at import time.",
    );
  }

  registration ??= import("@solid/reactive-authentication/registerElements").then(
    () => undefined,
  );
  return registration;
}
