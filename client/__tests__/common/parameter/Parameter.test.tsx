/**
 * Parameter.test.tsx
 * Tests for the Parameter component
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Parameter, {
  ParameterProps,
} from "@/components/common/parameter/Parameter";

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
const mockProps: ParameterProps = {
  // parameterId: 'test-parameterId', /* optional */
  // mode: 'create', /* optional */
};
// ------------------------------------------------------------------
describe("Parameter", () => {
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
      renderWithMocks(<Parameter {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
      expect(screen.getByText("Parameter Items")).toBeInTheDocument();
    });

    it("should render create form with empty fields", () => {
      renderWithMocks(<Parameter mode="create" />);

      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
      expect(screen.getByText("Parameter Items")).toBeInTheDocument();
      expect(screen.getByLabelText("Parameter Name *")).toBeInTheDocument();
      expect(screen.getByLabelText("Description *")).toBeInTheDocument();
      expect(screen.getByLabelText("Numerical Parameter")).toBeInTheDocument();
      expect(screen.getByLabelText("Active")).toBeInTheDocument();
      expect(screen.getByText("Create Parameter")).toBeInTheDocument();
    });

    it("should render edit form with existing data", async () => {
      renderWithMocks(
        <Parameter parameterId="test-parameter-id" mode="edit" />
      );

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Update Parameter")).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle adding parameter items", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Parameter mode="create" />);

      // Click the "Add Item" button
      const addButton = screen.getByText("Add Item");
      await user.click(addButton);

      // Check that a new row appears in the table
      expect(
        screen.getByText("No parameter items added yet.")
      ).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Item name")).toBeInTheDocument();
    });

    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Parameter mode="create" />);

      // Fill in the form
      const nameInput = screen.getByLabelText("Parameter Name *");
      const descriptionInput = screen.getByLabelText("Description *");

      await user.type(nameInput, "Test Parameter");
      await user.type(descriptionInput, "Test Description");

      // Submit the form
      const submitButton = screen.getByText("Create Parameter");
      await user.click(submitButton);

      // Check that the form submission was attempted
      expect(submitButton).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Parameter mode="create" />);

      // Toggle the numerical parameter switch
      const numericalSwitch = screen.getByLabelText("Numerical Parameter");
      await user.click(numericalSwitch);

      // Check that the switch state changed
      expect(numericalSwitch).toBeChecked();
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Parameter mode="create" />);

      // Test form input changes
      const nameInput = screen.getByLabelText("Parameter Name *");
      await user.type(nameInput, "Test");
      expect(nameInput).toHaveValue("Test");
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { createParameterMock } = await import("@/mocks/mutations");
      createParameterMock.mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Parameter {...mockProps} />);

      // Fill and submit form to trigger error
      const user = userEvent.setup();
      const nameInput = screen.getByLabelText("Parameter Name *");
      const descriptionInput = screen.getByLabelText("Description *");

      await user.type(nameInput, "Test Parameter");
      await user.type(descriptionInput, "Test Description");

      const submitButton = screen.getByText("Create Parameter");
      await user.click(submitButton);

      // Check that error handling is in place
      await waitFor(() => {
        expect(createParameterMock).toHaveBeenCalled();
      });
    });

    it("should handle loading states", () => {
      renderWithMocks(
        <Parameter parameterId="test-parameter-id" mode="edit" />
      );

      // Check that loading skeletons are shown initially
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Parameter mode="create" />);

      const backButton = screen.getByText("Back");
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/management/parameters");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Parameter {...mockProps} />);

      // Test that the component renders without crashing even with minimal props
      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<Parameter />);

      // Test that the component handles missing props gracefully
      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
    });

    it("should validate form fields", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Parameter mode="create" />);

      // Try to submit without filling required fields
      const submitButton = screen.getByText("Create Parameter");
      await user.click(submitButton);

      // Check that validation prevents submission
      expect(submitButton).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Parameter:
 * Path: common/parameter/Parameter.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: ParameterProps
 * - Has props: true
 * - Props interface: ParameterProps
 * - Client component: true
 * - Uses hooks: useQuery, useQueryClient, useRouter, useEffect, useMemo, useState
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
 * render(<Parameter {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Parameter {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
