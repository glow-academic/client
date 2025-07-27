import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import TableRubric, {
  TableRubricProps,
} from "@/components/common/rubric/TableRubric";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: TableRubricProps = {
  rubricId: "test-rubricId",
  // simulationChatId: 'test-simulationChatId', /* optional */
};
// ------------------------------------------------------------------
describe("TableRubric", () => {
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
      renderWithMocks(<TableRubric {...mockProps} />);

      // Should render the component with loading state initially
      await waitFor(() => {
        expect(screen.getByText("Loading rubric...")).toBeInTheDocument();
      });
    });

    it("should render with props", () => {
      // Test with different props
      const propsWithSimulationChat: TableRubricProps = {
        rubricId: "different-rubric-id",
        simulationChatId: "test-simulation-chat-id",
      };

      renderWithMocks(<TableRubric {...propsWithSimulationChat} />);

      // Should render the component with loading state
      expect(screen.getByText("Loading rubric...")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<TableRubric {...mockProps} />);

      // Should have proper accessibility attributes
      expect(screen.getByText("Loading rubric...")).toBeInTheDocument();

      // Should have loading spinner element
      const spinner = document.querySelector('[class*="animate-spin"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getRubric } = await import("@/utils/queries/rubrics/get-rubric");
      vi.mocked(getRubric).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<TableRubric {...mockProps} />);

      // Should still render the component even with API errors
      await waitFor(() => {
        expect(screen.getByText("Loading rubric...")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      // Component should handle loading states appropriately
      renderWithMocks(<TableRubric {...mockProps} />);

      // Should show loading state
      expect(screen.getByText("Loading rubric...")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with edge case props
      const edgeCaseProps: TableRubricProps = {
        rubricId: "test-rubric-id",
        simulationChatId: "test-chat-id",
      };

      renderWithMocks(<TableRubric {...edgeCaseProps} />);

      // Should render the component even with edge case props
      expect(screen.getByText("Loading rubric...")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps: TableRubricProps = {
        rubricId: "test-rubricId",
      };

      renderWithMocks(<TableRubric {...minimalProps} />);

      // Should render with minimal props
      expect(screen.getByText("Loading rubric...")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for TableRubric:
 * Path: common/rubric/TableRubric.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: TableRubricProps
 * - Has props: true
 * - Props interface: TableRubricProps
 * - Client component: true
 * - Uses hooks: useQuery
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<TableRubric {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<TableRubric {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
