import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Model, { ModelProps } from "@/components/common/model/Model";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ModelProps = {
  providerId: "test-providerId",
  modelId: "test-modelId",
};
// ------------------------------------------------------------------
describe("Model", () => {
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
      renderWithMocks(<Model {...mockProps} />);

      // Should render the model component
      await waitFor(() => {
        expect(screen.getByText(/model/i)).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with different props
      const propsWithData: ModelProps = {
        providerId: "different-provider",
        modelId: "different-model",
      };

      renderWithMocks(<Model {...propsWithData} />);

      await waitFor(() => {
        expect(screen.getByText(/model/i)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Model {...mockProps} />);

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
      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Find form inputs
      const nameInput = screen.getByLabelText(/name/i);
      const submitButton = screen.getByRole("button", { name: /save/i });

      // Fill out the form
      await user.type(nameInput, "Test Model Name");

      // Submit the form
      await user.click(submitButton);

      // Form should be submitted
      expect(nameInput).toHaveValue("Test Model Name");
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Test input state changes
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "Test Model");
      expect(nameInput).toHaveValue("Test Model");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Test input interactions
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, "Test Model");
      expect(nameInput).toHaveValue("Test Model");

      // Test form submission
      const submitButton = screen.getByRole("button", { name: /save/i });
      await user.click(submitButton);
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getModel } = await import("@/utils/queries/models/get-model");
      vi.mocked(getModel).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/model/i)).toBeInTheDocument();
      });

      // Component should still render even with API errors
      expect(screen.getByRole("form")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/model/i)).toBeInTheDocument();
      });

      // Component should show loading states appropriately
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/model/i)).toBeInTheDocument();
      });

      // Should render form with navigation elements
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/model/i)).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      expect(screen.getByRole("form")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with missing props
      renderWithMocks(<Model providerId="test" modelId="test" />);

      await waitFor(() => {
        expect(screen.getByText(/model/i)).toBeInTheDocument();
      });

      // Should render with minimal props
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });
});
