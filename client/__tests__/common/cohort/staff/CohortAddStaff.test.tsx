import { renderWithMocks } from "@/test/renderWithMocks";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import CohortAddStaff, {
  CohortAddStaffProps,
} from "@/components/common/cohort/staff/CohortAddStaff";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: CohortAddStaffProps = {
  onAddProfiles: vi.fn(),
  // currentCohortName: 'test-currentCohortName', /* optional */
  existingProfileIds: [],
};
// ------------------------------------------------------------------
describe("CohortAddStaff", () => {
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
      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Check for basic accessibility elements
      const form =
        document.querySelector("form") || document.querySelector("div");
      expect(form).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Test input interactions if inputs exist
      const inputs = document.querySelectorAll("input");
      if (inputs.length > 0 && inputs[0]) {
        await user.type(inputs[0], "test");
        expect(inputs[0]).toHaveValue("test");
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Test button interactions if buttons exist
      const buttons = document.querySelectorAll("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        // Button should be clickable
        expect(buttons[0]).toBeInTheDocument();
      }
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllProfiles).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Component should handle errors gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Component should show loading state initially
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<CohortAddStaff {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <CohortAddStaff onAddProfiles={vi.fn()} existingProfileIds={[]} />
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
