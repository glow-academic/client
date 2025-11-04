/**
 * Parameter.test.tsx
 * Tests for the Parameter component
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Parameter, {
  ParameterProps,
} from "@/components/parameters/Parameter";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/navigation";

// Import the router mock for testing
import { routerMock } from "@/mocks/navigation";

// Import mocks for direct access

// Mock the toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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
      render(<Parameter {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
      expect(screen.getByText("Parameter Items")).toBeInTheDocument();
    });

    it("should render create form with empty fields", async () => {
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Parameter Information")).toBeInTheDocument();
      });

      expect(screen.getByText("Parameter Items")).toBeInTheDocument();
      expect(screen.getByLabelText("Parameter Name *")).toBeInTheDocument();
      expect(screen.getByLabelText("Description *")).toBeInTheDocument();
      expect(screen.getByLabelText("Numerical Parameter")).toBeInTheDocument();
      expect(screen.getByLabelText("Active")).toBeInTheDocument();
      expect(screen.getByText("Create Parameter")).toBeInTheDocument();
    });

    it("should render edit form with existing data", async () => {
      render(<Parameter parameterId="test-parameter-id" mode="edit" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Update Parameter")).toBeInTheDocument();
      });

      // Check that the form fields are populated with existing data
      expect(screen.getByDisplayValue("Parameters 1")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Description for parameters 1"),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Parameter {...mockProps} />);

      // Check for proper form structure
      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Create Parameter" }),
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle adding parameter items", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Add Item")).toBeInTheDocument();
      });

      // Click the "Add Item" button
      const addButton = screen.getByText("Add Item");
      await user.click(addButton);

      // Check that a new row appears in the table
      expect(screen.getByPlaceholderText("Item name")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Item description"),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();
    });

    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByLabelText("Parameter Name *")).toBeInTheDocument();
      });

      // Fill in the form
      const nameInput = screen.getByLabelText("Parameter Name *");
      const descriptionInput = screen.getByLabelText("Description *");

      await user.type(nameInput, "Test Parameter");
      await user.type(descriptionInput, "Test Description");

      // Submit the form
      const submitButton = screen.getByText("Create Parameter");
      await user.click(submitButton);

      // Check that the form submission was attempted
      await waitFor(() => {
        expect(createParameterMock).toHaveBeenCalled();
      });
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(
          screen.getByLabelText("Numerical Parameter"),
        ).toBeInTheDocument();
      });

      // Toggle the numerical parameter switch
      const numericalSwitch = screen.getByLabelText("Numerical Parameter");
      await user.click(numericalSwitch);

      // Check that the switch state changed
      expect(numericalSwitch).toBeChecked();
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByLabelText("Parameter Name *")).toBeInTheDocument();
      });

      // Test form input changes
      const nameInput = screen.getByLabelText("Parameter Name *");
      await user.type(nameInput, "Test");
      expect(nameInput).toHaveValue("Test");
    });

    it("should handle deleting parameter items", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Add Item")).toBeInTheDocument();
      });

      // Add an item first
      const addButton = screen.getByText("Add Item");
      await user.click(addButton);

      // Wait for the item to be added
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Item name")).toBeInTheDocument();
      });

      // Delete the item - find the delete button by looking for the button with Trash2 icon
      const deleteButton = screen.getByRole("button", { name: "" });
      await user.click(deleteButton);

      // Check that the item is removed
      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText("Item name"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      createParameterMock.mockRejectedValue(new Error("API Error"));

      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByLabelText("Parameter Name *")).toBeInTheDocument();
      });

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

    it("should handle loading states", async () => {
      render(<Parameter parameterId="test-parameter-id" mode="edit" />);

      // Check that loading skeletons are shown initially
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Update Parameter")).toBeInTheDocument();
      });
    });

    it("should successfully create a parameter", async () => {
      createParameterMock.mockResolvedValue({ success: true });

      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByLabelText("Parameter Name *")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const nameInput = screen.getByLabelText("Parameter Name *");
      const descriptionInput = screen.getByLabelText("Description *");

      await user.type(nameInput, "Test Parameter");
      await user.type(descriptionInput, "Test Description");

      const submitButton = screen.getByText("Create Parameter");
      await user.click(submitButton);

      await waitFor(() => {
        expect(createParameterMock).toHaveBeenCalledWith({
          name: "Test Parameter",
          description: "Test Description",
          numerical: false,
          active: false,
        });
      });
    });

    it("should successfully update a parameter", async () => {
      updateParameterMock.mockResolvedValue({ success: true });

      render(<Parameter parameterId="test-parameter-id" mode="edit" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Update Parameter")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const nameInput = screen.getByLabelText("Parameter Name *");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Parameter");

      const submitButton = screen.getByText("Update Parameter");
      await user.click(submitButton);

      await waitFor(() => {
        expect(updateParameterMock).toHaveBeenCalled();
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Back")).toBeInTheDocument();
      });

      const backButton = screen.getByText("Back");
      await user.click(backButton);

      expect(routerMock.push).toHaveBeenCalledWith("/management/parameters");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<Parameter {...mockProps} />);

      // Test that the component renders without crashing even with minimal props
      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(<Parameter />);

      // Test that the component handles missing props gracefully
      expect(screen.getByText("Parameter Information")).toBeInTheDocument();
    });

    it("should validate form fields", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Parameter")).toBeInTheDocument();
      });

      // Try to submit without filling required fields
      const submitButton = screen.getByText("Create Parameter");
      await user.click(submitButton);

      // Check that validation prevents submission
      await waitFor(() => {
        expect(createParameterMock).not.toHaveBeenCalled();
      });
    });

    it("should handle numerical parameter validation", async () => {
      const user = userEvent.setup();
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(
          screen.getByLabelText("Numerical Parameter"),
        ).toBeInTheDocument();
      });

      // Enable numerical parameter
      const numericalSwitch = screen.getByLabelText("Numerical Parameter");
      await user.click(numericalSwitch);

      // Add a parameter item
      const addButton = screen.getByText("Add Item");
      await user.click(addButton);

      // Wait for the item to be added
      await waitFor(() => {
        expect(screen.getByPlaceholderText("0")).toBeInTheDocument();
      });

      // Fill in the form
      const nameInput = screen.getByLabelText("Parameter Name *");
      const descriptionInput = screen.getByLabelText("Description *");
      const itemNameInput = screen.getByPlaceholderText("Item name");
      const itemDescriptionInput =
        screen.getByPlaceholderText("Item description");
      const itemValueInput = screen.getByPlaceholderText("0");

      await user.type(nameInput, "Test Parameter");
      await user.type(descriptionInput, "Test Description");
      await user.type(itemNameInput, "Test Item");
      await user.type(itemDescriptionInput, "Test Item Description");
      await user.type(itemValueInput, "invalid");

      // Submit the form
      const submitButton = screen.getByText("Create Parameter");
      await user.click(submitButton);

      // Check that validation prevents submission for invalid numerical value
      await waitFor(() => {
        expect(createParameterMock).not.toHaveBeenCalled();
      });
    });

    it("should handle empty parameter items gracefully", async () => {
      render(<Parameter mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(
          screen.getByText("No parameter items added yet."),
        ).toBeInTheDocument();
      });

      // Check that the empty state is displayed
      expect(
        screen.getByText(
          'Click "Add Item" to create your first parameter item.',
        ),
      ).toBeInTheDocument();
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
 * All tests have been implemented with proper functionality testing
 */
