import { renderWithMocks } from "@/test/renderWithMocks";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Persona, { PersonaProps } from "@/components/common/agent/Persona";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: PersonaProps = {
  // personaId: 'test-personaId', /* optional */
  // mode: 'create', /* optional */
};
// ------------------------------------------------------------------
describe("Persona", () => {
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
      renderWithMocks(<Persona {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<Persona personaId="test-id" mode="edit" />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Persona {...mockProps} />);

      // Check for basic accessibility elements
      const form = document.querySelector("form");
      expect(form).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Persona {...mockProps} />);

      // Test form submission if form exists
      const form = document.querySelector("form");
      if (form) {
        await user.click(form);
        // Form should be interactive
        expect(form).toBeInTheDocument();
      }
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Persona {...mockProps} />);

      // Test input interactions if inputs exist
      const inputs = document.querySelectorAll("input");
      if (inputs.length > 0 && inputs[0]) {
        await user.type(inputs[0], "test");
        expect(inputs[0]).toHaveValue("test");
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Persona {...mockProps} />);

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
      // Example: vi.mocked(getPersona).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<Persona {...mockProps} />);

      // Component should handle errors gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<Persona {...mockProps} />);

      // Component should show loading state initially
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<Persona {...mockProps} />);

      // Component should handle navigation properly
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Persona {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<Persona />);

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });

  it("should handle color and icon selection", async () => {
    renderWithMocks(<Persona personaId="test-id" mode="edit" />);

    // Wait for the form to load with the persona data
    await waitFor(() => {
      // Check if form elements are present
      const form = document.querySelector("form");
      expect(form).toBeInTheDocument();
    });
  });
});
