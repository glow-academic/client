/**
 * Server-side polyfill for localStorage and sessionStorage
 *
 * Node.js 22+ has experimental localStorage that doesn't work correctly.
 * This polyfill provides a no-op implementation for SSR compatibility.
 *
 * Import this at the top of your app's entry point (instrumentation.ts or layout.tsx)
 */

// Only run on server side
if (typeof window === "undefined") {
  // Check if localStorage exists but doesn't work correctly (Node.js 22+ issue)
  const needsPolyfill = (() => {
    try {
      // Node.js 22+ has localStorage but getItem may not be a function
      if (typeof globalThis.localStorage !== "undefined") {
        // Test if getItem is a function
        if (typeof globalThis.localStorage.getItem !== "function") {
          return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  })();

  if (needsPolyfill) {
    // Create a simple in-memory storage mock
    const createStorageMock = (): Storage => {
      const store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = String(value);
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          for (const key in store) {
            delete store[key];
          }
        },
        key: (index: number) => Object.keys(store)[index] ?? null,
        get length() {
          return Object.keys(store).length;
        },
      };
    };

    // Override global localStorage and sessionStorage
    Object.defineProperty(globalThis, "localStorage", {
      value: createStorageMock(),
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, "sessionStorage", {
      value: createStorageMock(),
      writable: true,
      configurable: true,
    });
  }
}

export {};
