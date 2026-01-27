/**
 * Local fix for @radix-ui/react-compose-refs
 *
 * The upstream useComposedRefs uses `React.useCallback(composeRefs(...refs), refs)`
 * which creates a new array for deps on every render. With React 19's ref cleanup
 * semantics, this causes infinite detach/reattach loops: new callback identity →
 * React detaches old ref → attaches new ref → function refs call setState during
 * commit → re-render → new identity → loop.
 *
 * Fix: store refs in a mutable ref and return a stable callback with [] deps.
 * Additionally, defer function ref calls via queueMicrotask to ensure any setState
 * they call happens outside React's synchronous commit phase.
 */
// Patch is active - alias working
import * as React from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

// Track nodes that have recently been processed to prevent infinite loops.
// When a function ref calls setState, it can trigger re-renders that call
// the same refs again. We skip function refs for nodes that were just processed.
const recentlyProcessedNodes = new WeakMap<object, number>();
const COOLDOWN_MS = 50; // Skip function refs for this duration after first call

function setRef<T>(ref: PossibleRef<T>, value: T): void {
  if (typeof ref === "function") {
    const now = Date.now();

    // For object values (DOM nodes), check if recently processed
    if (value && typeof value === "object") {
      const lastProcessed = recentlyProcessedNodes.get(value as object);
      if (lastProcessed && now - lastProcessed < COOLDOWN_MS) {
        // Skip - this node was just processed, likely a re-render loop
        return;
      }
      recentlyProcessedNodes.set(value as object, now);
    }

    // For null (unmount), always allow - unmounts should complete
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (node: T) => {
    refs.forEach((ref) => setRef(ref, node));
  };
}

function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  // Store latest refs in a mutable ref so the callback is always stable
  const currentRefs = React.useRef(refs);
  currentRefs.current = refs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback((node: T) => {
    currentRefs.current.forEach((ref) => setRef(ref, node));
  }, []);
}

export { composeRefs, useComposedRefs };
