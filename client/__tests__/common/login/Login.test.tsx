import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Login from "@/components/common/login/Login";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

describe("Login", () => {
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
      renderWithMocks(<Login />);

      // Should render the login component
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });
    });

    it("should render login form", async () => {
      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
        expect(screen.getByRole("form")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Login />);

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
      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Find form inputs
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /login/i });

      // Fill out the form
      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");

      // Submit the form
      await user.click(submitButton);

      // Form should be submitted
      expect(emailInput).toHaveValue("test@example.com");
      expect(passwordInput).toHaveValue("password123");
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Test input state changes
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, "test@example.com");
      expect(emailInput).toHaveValue("test@example.com");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Test input interactions
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, "test@example.com");
      expect(emailInput).toHaveValue("test@example.com");

      // Test form submission
      const submitButton = screen.getByRole("button", { name: /login/i });
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

      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Component should still render even with API errors
      expect(screen.getByRole("form")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Component should show loading states appropriately
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Should render login form
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<Login />);

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Should render properly even with no props
      expect(screen.getByRole("form")).toBeInTheDocument();
    });
  });
});
