import "@testing-library/jest-dom/vitest";

// Import all mock modules to execute their vi.mock() calls globally
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/extra";
import "@/mocks/navigation";

// Setup global test environment
beforeEach(() => {
  // Clear all mocks before each test for isolation
  vi.clearAllMocks();
});
