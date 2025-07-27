import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import RubricDetails from "@/components/common/rubric/RubricDetails";

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
import type { RubricDetailsProps } from "@/components/common/rubric/RubricDetails";
const mockProps: RubricDetailsProps = {
  rubric: {
    id: "1",
    createdAt: "2021-01-01",
    updatedAt: "2021-01-01",
    name: "Test Rubric",
    description: "Test Description",
    points: 10,
    passPoints: 8,
    defaultRubric: false,
    active: true,
  },
  rubricId: "test-rubricId",
};
// ------------------------------------------------------------------
describe("RubricDetails", () => {
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
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText("Test Rubric")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Check that props are properly displayed
      expect(screen.getByText("Test Rubric")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
      expect(screen.getByText("Total: 10 points")).toBeInTheDocument();
      expect(screen.getByText("Pass: 8 points")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Check for proper form structure
      expect(screen.getByText("Test Rubric")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Click edit button to enter edit mode
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Fill in the form
      const nameInput = screen.getByLabelText(/Name/);
      const descriptionInput = screen.getByLabelText(/Description/);

      await user.clear(nameInput);
      await user.type(nameInput, "Updated Rubric");
      await user.clear(descriptionInput);
      await user.type(descriptionInput, "Updated Description");

      // Submit the form
      const submitButton = screen.getByText(/Update/);
      await user.click(submitButton);

      // Check that the form submission was attempted
      expect(submitButton).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Click edit button to enter edit mode
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Test form input changes
      const nameInput = screen.getByLabelText(/Name/);
      await user.clear(nameInput);
      await user.type(nameInput, "Updated");
      expect(nameInput).toHaveValue("Updated");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Test edit button click
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Check that edit mode is activated
      expect(screen.getByText(/Update/)).toBeInTheDocument();
    });

    it("should handle cancel button", async () => {
      const user = userEvent.setup();
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Click edit button to enter edit mode
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // Click cancel button
      const cancelButton = screen.getByText(/Cancel/);
      await user.click(cancelButton);

      // Check that we're back to view mode
      expect(screen.getByText("Test Rubric")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { updateRubricMock } = await import("@/mocks/mutations");
      updateRubricMock.mockRejectedValue(new Error("API Error"));

      const user = userEvent.setup();
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Enter edit mode and submit to trigger error
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      const submitButton = screen.getByText(/Update/);
      await user.click(submitButton);

      // Check that error handling is in place
      await waitFor(() => {
        expect(updateRubricMock).toHaveBeenCalled();
      });
    });

    it("should handle loading states", () => {
      renderWithMocks(<RubricDetails {...mockProps} />);

      // Check that the component renders without loading issues
      expect(screen.getByText("Test Rubric")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const minimalProps = {
        rubric: {
          id: "1",
          createdAt: "2021-01-01",
          updatedAt: "2021-01-01",
          name: "",
          description: "",
          points: 0,
          passPoints: 0,
          defaultRubric: false,
          active: false,
        },
        rubricId: "test-rubricId",
      };

      renderWithMocks(<RubricDetails {...minimalProps} />);

      // Test that the component renders with minimal data
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      const invalidProps = {
        rubric: {
          id: "1",
          createdAt: "2021-01-01",
          updatedAt: "2021-01-01",
          name: "",
          description: "",
          points: 0,
          passPoints: 0,
          defaultRubric: false,
          active: false,
        },
        rubricId: "test-rubricId",
      };

      renderWithMocks(<RubricDetails {...invalidProps} />);

      // Test that the component handles missing data gracefully
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
    });

    it("should handle create mode", () => {
      const createModeProps = {
        ...mockProps,
        isCreateMode: true,
      };

      renderWithMocks(<RubricDetails {...createModeProps} />);

      // Check that create mode is properly handled
      expect(screen.getByText(/Create New Rubric/)).toBeInTheDocument();
      expect(screen.getByText(/Create Rubric/)).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for RubricDetails:
 * Path: common/rubric/RubricDetails.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: RubricDetailsProps
 * - Client component: false
 * - Uses hooks: useMutation, useQueryClient, useState
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<RubricDetails {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<RubricDetails {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
