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
 * IMPORTANT: composeRefs must NOT return a cleanup function. Returning a cleanup
 * that calls setRef(ref, null) for each sub-ref triggers setState recursively
 * during React's safelyDetachRef in the commit phase. Instead, we let React call
 * the stable callback with null on unmount (the pre-React-19 fallback behavior).
 */
import * as React from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(ref: PossibleRef<T>, value: T): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (node: T) => {
    refs.forEach((ref) => setRef(ref, node));
    // Do NOT return a cleanup function here. Returning a cleanup that calls
    // setRef(ref, null) causes infinite setState loops during React's commit
    // phase when function refs dispatch state updates (e.g. Radix Tooltip's
    // onTriggerChange). Without a cleanup, React falls back to calling this
    // callback with null on unmount, which safely nulls refs once.
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
