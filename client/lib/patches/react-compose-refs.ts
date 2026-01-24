/**
 * Local fix for @radix-ui/react-compose-refs
 *
 * The upstream useComposedRefs uses `React.useCallback(composeRefs(...refs), refs)`
 * which creates a new array for deps on every call. With React 19's ref cleanup
 * semantics, this causes infinite re-attach loops when many composed refs (e.g.
 * 12+ Radix Tooltips calling setState via onTriggerChange) exceed React's max
 * update depth during the commit phase.
 *
 * Fix: store refs in a mutable ref and return a stable callback with [] deps.
 */
import * as React from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(ref: PossibleRef<T>, value: T): void | (() => void) {
  if (typeof ref === "function") {
    return ref(value) as void | (() => void);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (node: T) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup === "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup === "function") {
            cleanup();
          } else {
            setRef(refs[i], null as unknown as T);
          }
        }
      };
    }
  };
}

function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  // Store latest refs in a mutable ref so the callback is always stable
  const currentRefs = React.useRef(refs);
  currentRefs.current = refs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback((node: T) => {
    return composeRefs(...currentRefs.current)(node);
  }, []);
}

export { composeRefs, useComposedRefs };
