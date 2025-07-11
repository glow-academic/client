// Virtual proxy mock for all query functions
// This replaces thousands of individual vi.mock() calls with a single regex-based proxy

import { vi } from "vitest";

// Create a proxy that returns fresh stubs for any accessed property
const mockCache: Record<string, ReturnType<typeof vi.fn>> = {};

export const queryProxy: Record<string, ReturnType<typeof vi.fn>> = new Proxy(
  {},
  {
    get(_, key) {
      if (typeof key === "string" && !mockCache[key]) {
        // Create a fresh stub for this function
        mockCache[key] = vi.fn().mockResolvedValue([]);
      }
      return mockCache[key as string];
    },
  }
);  

// Reset all mocks helper
export const resetAllQueryMocks = () => {
  Object.values(mockCache).forEach((mock) => {
    if (mock && typeof mock.mockReset === "function") {
      mock.mockReset();
    }
  });

};
