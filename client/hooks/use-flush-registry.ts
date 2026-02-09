import { useCallback, useMemo, useRef } from "react";

/**
 * Manages a registry of flush callbacks from creatable resource components.
 * Each resource component registers a flush function that creates its draft resource
 * and returns the resulting ID(s). flushAllResources() calls them all in parallel.
 *
 * Returns a registerFlushCallbacks object (plain object with specific keys)
 * and flushAllResources to call them all in parallel.
 */

export function useFlushRegistry<FR extends Record<string, unknown>>(
  keys: readonly string[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flushRegistryRef = useRef<Map<string, () => Promise<any>>>(new Map());

  const createRegisterFlush = useCallback(
    (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (flush: () => Promise<any>) => {
        flushRegistryRef.current.set(key, flush);
      };
    },
    []
  );

  // Build registerFlush callbacks as a plain object to avoid mapped type issues
  // with exactOptionalPropertyTypes in JSX
  const registerFlushCallbacks = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const key of keys) {
      result[key] = createRegisterFlush(key);
    }
    return result;
    // keys is a static array passed at call site — safe to stringify for deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRegisterFlush, JSON.stringify(keys)]);

  const flushAllResources = useCallback(async (): Promise<FR> => {
    const flushPromises = Array.from(flushRegistryRef.current.values()).map(
      (flush) => flush()
    );
    const flushResults = await Promise.all(flushPromises);

    const mergedFlushResults = flushResults.reduce<FR>(
      (acc, result) => (result ? { ...acc, ...result } : acc),
      {} as FR
    );

    return mergedFlushResults;
  }, []);

  return {
    flushRegistryRef,
    registerFlushCallbacks,
    flushAllResources,
  };
}
