/**
 * Next.js instrumentation file — runs once when the server starts.
 *
 * Node.js v22 exposes an experimental `localStorage` global when the
 * `--localstorage-file` flag is present (Cursor IDE injects this).
 * The implementation is incomplete — `getItem`/`setItem` throw — which
 * crashes Next.js dev-overlay code that checks `typeof localStorage !== 'undefined'`.
 *
 * We replace it with a minimal in-memory shim so SSR doesn't blow up.
 */
export async function register() {
  if (typeof globalThis.localStorage !== "undefined") {
    try {
      // Test if it actually works
      globalThis.localStorage.getItem("__test__");
    } catch {
      // Replace with a no-op shim
      const store = new Map<string, string>();
      globalThis.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
        get length() {
          return store.size;
        },
        key: (index: number) => [...store.keys()][index] ?? null,
      } as Storage;
    }
  }
}
