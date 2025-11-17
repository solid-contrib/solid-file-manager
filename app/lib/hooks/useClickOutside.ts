import { useEffect, useRef, RefObject } from "react";

interface UseClickOutsideOptions {
  isEnabled: boolean;
  onOutsideClick: () => void;
  refs: RefObject<Element | null>[];
  delayBeforeEnable?: number;
  listenerDelay?: number;
}

/**
 * Hook to detect clicks outside of specified elements
 * @param isEnabled - Whether the click outside detection should be active
 * @param onOutsideClick - Callback to execute when clicking outside
 * @param refs - Array of refs to elements that should be excluded from outside click detection
 * @param delayBeforeEnable - Delay in ms before enabling click outside detection (prevents immediate closure)
 * @param listenerDelay - Delay in ms before adding event listeners
 */
export function useClickOutside({
  isEnabled,
  onOutsideClick,
  refs,
  delayBeforeEnable = 300,
  listenerDelay = 100,
}: UseClickOutsideOptions) {
  const justOpenedRef = useRef(false);

  useEffect(() => {
    if (!isEnabled) {
      justOpenedRef.current = false;
      return;
    }

    justOpenedRef.current = true;
    const timeoutId = setTimeout(() => {
      justOpenedRef.current = false;
    }, delayBeforeEnable);

    const handleClickOutside = (event: Event) => {
      if (justOpenedRef.current) return;

      const target = event.target as Node;
      const isOutside = refs.every(
        (ref) => ref.current && !ref.current.contains(target)
      );

      if (isOutside) {
        onOutsideClick();
      }
    };

    const listenerTimeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }, listenerDelay);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(listenerTimeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [isEnabled, onOutsideClick, refs, delayBeforeEnable, listenerDelay]);
}

