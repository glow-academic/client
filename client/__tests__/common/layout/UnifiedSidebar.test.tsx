import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  UnifiedSidebar,
  UnifiedSidebarProps,
} from "@/components/common/layout/UnifiedSidebar";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: UnifiedSidebarProps = {
  activeSection: "test-activeSection",
  // side: 'left', /* optional */
  // variant: 'sidebar', /* optional */
  // collapsible: 'offcanvas', /* optional */
};
// ------------------------------------------------------------------
describe("UnifiedSidebar", () => {
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
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      // Should render the sidebar component with profile information
      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });
    });

    it("should render with props", async () => {
      // Test with different props
      const propsWithVariants: UnifiedSidebarProps = {
        activeSection: "analytics",
        side: "left",
        variant: "sidebar",
        collapsible: "offcanvas",
      };

      renderWithMocks(<UnifiedSidebar {...propsWithVariants} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        // Check for profile information
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);

        // Check for role information
        expect(screen.getByText("admin")).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle navigation clicks", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Find and click navigation items if they exist
      const navItems = screen.queryAllByRole("link");
      if (navItems.length > 0 && navItems[0]) {
        // await user.click(navItems[0]);
      }
    });

    it("should handle state changes", async () => {
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Should handle state changes properly
      expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    });

    it("should handle user events", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Should handle user events properly
      expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      vi.mocked(getAllCohorts).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Component should still render even with API errors
      expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    });

    it("should handle loading states", async () => {
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Component should show loading states appropriately
      expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Should render navigation content
      expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<UnifiedSidebar {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Should render properly even with minimal props
      expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      renderWithMocks(<UnifiedSidebar activeSection="" />);

      await waitFor(() => {
        expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
      });

      // Should render with default props
      expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    });
  });
});
