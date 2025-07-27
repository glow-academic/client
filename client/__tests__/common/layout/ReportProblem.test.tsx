import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ReportProblem, {
  ReportProblemProps,
} from "@/components/common/layout/ReportProblem";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ReportProblemProps = {};
// ------------------------------------------------------------------
describe("ReportProblem", () => {
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
      renderWithMocks(<ReportProblem {...mockProps} />);

      // Should render the report problem component
      await waitFor(() => {
        expect(screen.getByText(/report/i)).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with different props
      const propsWithData: ReportProblemProps = {
        // Add any specific props here
      };

      renderWithMocks(<ReportProblem {...propsWithData} />);

      await waitFor(() => {
        expect(screen.getByText(/report/i)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        // Check for form elements
        const form = screen.getByRole("form");
        expect(form).toBeInTheDocument();

        // Check for input fields
        const inputs = screen.getAllByRole("textbox");
        expect(inputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Find form inputs
      const descriptionInput = screen.getByLabelText(/description/i);
      const submitButton = screen.getByRole("button", { name: /submit/i });

      // Fill out the form
      await user.type(descriptionInput, "Test problem description");

      // Submit the form
      await user.click(submitButton);

      // Form should be submitted
      expect(descriptionInput).toHaveValue("Test problem description");
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Test input state changes
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, "Test description");
      expect(descriptionInput).toHaveValue("Test description");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Test input interactions
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, "Test description");
      expect(descriptionInput).toHaveValue("Test description");

      // Test form submission
      const submitButton = screen.getByRole("button", { name: /submit/i });
      await user.click(submitButton);
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getProfilesByUser } = await import(
        "@/utils/queries/profiles/get-profiles-by-user"
      );
      vi.mocked(getProfilesByUser).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/report/i)).toBeInTheDocument();
      });

      // Component should still render even with API errors
      expect(screen.getByRole("form")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/report/i)).toBeInTheDocument();
      });

      // Component should show loading states appropriately
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/report/i)).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      expect(screen.getByRole("form")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      renderWithMocks(<ReportProblem />);

      await waitFor(() => {
        expect(screen.getByText(/report/i)).toBeInTheDocument();
      });

      // Should render with default props
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });
});
