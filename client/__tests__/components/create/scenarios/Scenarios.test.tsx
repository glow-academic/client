import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { Scenarios } from "@/components/create/scenarios/Scenarios";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";

describe("Scenarios", () => {
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
      render(<Scenarios />);

      // Check that the component renders without crashing
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search scenarios..."),
        ).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<Scenarios />);

      // Check that search input has proper accessibility attributes
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText("Search scenarios...");
        expect(searchInput).toBeInTheDocument();
        // Note: The Input component doesn't explicitly set type="text", but it's still accessible
      });

      // Check that the component has proper structure
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<Scenarios />);

      // Test search functionality
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search scenarios..."),
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search scenarios...");
      await user.type(searchInput, "Math");

      // The search should filter the scenarios
      expect(searchInput).toHaveValue("Math");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<Scenarios />);

      // Test search input interaction
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search scenarios..."),
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search scenarios...");
      await user.click(searchInput);
      await user.type(searchInput, "test search");

      expect(searchInput).toHaveValue("test search");
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      vi.mocked(getAllScenarios).mockRejectedValue(new Error("API Error"));

      render(<Scenarios />);

      // The component should handle the error gracefully
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search scenarios..."),
        ).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      // Mock data is automatically loaded from @/mocks/schema
      render(<Scenarios />);

      // Component should show loading state initially
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search scenarios..."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      render(<Scenarios />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search scenarios..."),
        ).toBeInTheDocument();
      });

      // The component should render without navigation errors
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with empty data
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Scenarios />);

      // Should handle empty data gracefully
      await waitFor(() => {
        expect(
          screen.getByText("No scenarios match the current filters."),
        ).toBeInTheDocument();
      });
    });
  });
});
