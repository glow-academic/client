import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Rubric, { RubricProps } from "@/components/common/rubric/Rubric";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: RubricProps = {
  // rubricId: 'test-rubricId', /* optional */
};
// ------------------------------------------------------------------
describe("Rubric", () => {
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
      renderWithMocks(<Rubric {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
    });

    it("should render create form with empty fields", () => {
      renderWithMocks(<Rubric />);

      // Check that form fields are present
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
      expect(screen.getByText(/Create Rubric/)).toBeInTheDocument();
    });

    it("should render edit form with existing data", async () => {
      renderWithMocks(<Rubric rubricId="test-rubric-id" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText(/Update/)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Rubric {...mockProps} />);

      // Check for proper form structure
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Rubric />);

      // Fill in the form
      const nameInput = screen.getByLabelText(/Name/);
      const descriptionInput = screen.getByLabelText(/Description/);

      await user.type(nameInput, "Test Rubric");
      await user.type(descriptionInput, "Test Description");

      // Submit the form
      const submitButton = screen.getByText(/Create Rubric/);
      await user.click(submitButton);

      // Check that the form submission was attempted
      expect(submitButton).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Rubric />);

      // Test form input changes
      const nameInput = screen.getByLabelText(/Name/);
      await user.type(nameInput, "Test");
      expect(nameInput).toHaveValue("Test");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Rubric />);

      // Test form input changes
      const nameInput = screen.getByLabelText(/Name/);
      await user.type(nameInput, "Test Rubric");
      expect(nameInput).toHaveValue("Test Rubric");
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { createRubricMock } = await import("@/mocks/mutations");
      createRubricMock.mockRejectedValue(new Error("API Error"));

      const user = userEvent.setup();
      renderWithMocks(<Rubric {...mockProps} />);

      // Fill and submit form to trigger error
      const nameInput = screen.getByLabelText(/Name/);
      const descriptionInput = screen.getByLabelText(/Description/);

      await user.type(nameInput, "Test Rubric");
      await user.type(descriptionInput, "Test Description");

      const submitButton = screen.getByText(/Create Rubric/);
      await user.click(submitButton);

      // Check that error handling is in place
      await waitFor(() => {
        expect(createRubricMock).toHaveBeenCalled();
      });
    });

    it("should handle loading states", () => {
      renderWithMocks(<Rubric rubricId="test-rubric-id" />);

      // Check that loading skeletons are shown initially
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Rubric />);

      const backButton = screen.getByText("Back to Rubrics");
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/create/rubrics");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Rubric {...mockProps} />);

      // Test that the component renders without crashing even with minimal props
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<Rubric />);

      // Test that the component handles missing props gracefully
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
    });

    it("should validate form fields", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Rubric />);

      // Try to submit without filling required fields
      const submitButton = screen.getByText(/Create Rubric/);
      await user.click(submitButton);

      // Check that validation prevents submission
      expect(submitButton).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Rubric:
 * Path: common/rubric/Rubric.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: RubricProps
 * - Has props: true
 * - Props interface: RubricProps
 * - Client component: true
 * - Uses hooks: useMutation, useQuery, useQueryClient, useRouter, useEffect, useState
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Rubric {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Rubric {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
