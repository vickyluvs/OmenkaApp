import { useEffect, DependencyList } from "react";

/**
 * A custom hook that wraps useEffect with a debounce timer.
 * @param effect The logic you want to run (e.g., your Firestore save).
 * @param deps The dependency array (e.g., [activeProject]).
 * @param delayMs How long to wait after the last change before firing.
 */
export function useDebouncedEffect(
  effect: () => void | (() => void),
  deps: DependencyList,
  delayMs: number
) {
  useEffect(() => {
    // Set the timer
    const handler = setTimeout(() => {
      const cleanup = effect();
      
      // If the effect returns a cleanup function, we need to handle it
      if (typeof cleanup === "function") {
        return cleanup;
      }
    }, delayMs);

    // This is the magic part: if the user types again before the 
    // timer finishes, this return cancels the previous timer.
    return () => clearTimeout(handler);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs]);
}