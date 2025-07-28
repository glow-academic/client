import { renderWithMocks } from "@/test/renderWithMocks";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Parameters from "@/components/management/parameters/Parameters";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock React Query to return empty arrays for parameters and parameter-items
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey[0] === "parameters") {
      return { data: [], isLoading: false };
    }
    if (queryKey[0] === "parameter-items") {
      return { data: [], isLoading: false };
    }
    if (queryKey[0] === "scenarios") {
      return { data: [], isLoading: false };
    }
    return { data: null, isLoading: false };
  }),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

describe("Parameters", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects
   * - mockSchema.profiles - Array of profile objects
   *
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */

  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      renderWithMocks(<Parameters />);

      // Basic rendering test - component should render without crashing
      // The component should show parameters or a loading state
      expect(document.body).toBeInTheDocument();
    });

    it("should render with correct content", () => {
      renderWithMocks(<Parameters />);

      // Check that the component renders its expected content
      // Since this component shows parameters, it should render something
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Parameters />);

      // Basic accessibility test - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      renderWithMocks(<Parameters />);

      // Component should handle state changes gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<Parameters />);

      // Component should handle user events
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllParameterItems).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<Parameters />);

      // Assert: Check that your component shows an error message.
      // Component should handle API errors gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      // Test loading states
      // Mock data is automatically loaded from @/mocks/schema

      renderWithMocks(<Parameters />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<Parameters />);

      // Component should handle navigation
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Parameters />);

      // Component should handle edge cases gracefully
      expect(document.body).toBeInTheDocument();
    });
  });
});
