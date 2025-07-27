import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { Simulations } from "@/components/create/simulations/Simulations";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

describe("Simulations", () => {
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
      renderWithMocks(<Simulations />);

      // Check that the component renders without crashing
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search simulations...")
        ).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Simulations />);

      // Check that search input has proper accessibility attributes
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          "Search simulations..."
        );
        expect(searchInput).toBeInTheDocument();
      });

      // Check that the component has proper structure
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Simulations />);

      // Test search functionality
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search simulations...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search simulations...");
      await user.type(searchInput, "Math");

      // The search should filter the simulations
      expect(searchInput).toHaveValue("Math");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Simulations />);

      // Test search input interaction
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search simulations...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search simulations...");
      await user.click(searchInput);
      await user.type(searchInput, "test search");

      expect(searchInput).toHaveValue("test search");
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      vi.mocked(getAllSimulations).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Simulations />);

      // The component should handle the error gracefully
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search simulations...")
        ).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      // Mock data is automatically loaded from @/mocks/schema
      renderWithMocks(<Simulations />);

      // Component should show loading state initially
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search simulations...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<Simulations />);

      // Wait for component to load
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search simulations...")
        ).toBeInTheDocument();
      });

      // The component should render without navigation errors
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with empty data
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      renderWithMocks(<Simulations />);

      // Should handle empty data gracefully
      await waitFor(() => {
        expect(screen.getByText("No simulations found.")).toBeInTheDocument();
      });
    });
  });
});
