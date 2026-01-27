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
 * Additionally, guard against re-entry by tracking refs processed recently.
 */
import * as React from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

// Track refs being processed to prevent infinite loops.
// Key insight: cleanup refs (null) can also trigger setState in Radix components.
// We need to guard BOTH attach and detach calls by tracking the ref function itself.
const recentlyProcessedRefs = new WeakMap<Function, number>();
const COOLDOWN_MS = 100;

function setRef<T>(ref: PossibleRef<T>, value: T): void {
  if (typeof ref === "function") {
    const now = Date.now();

    // Guard against infinite loops - track by ref function, not by node
    // This catches both attach (value=node) and detach (value=null) calls
    const lastProcessed = recentlyProcessedRefs.get(ref);
    if (lastProcessed && now - lastProcessed < COOLDOWN_MS) {
      return;
    }
    recentlyProcessedRefs.set(ref, now);

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
