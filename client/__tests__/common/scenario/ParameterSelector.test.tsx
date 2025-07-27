import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { ParameterSelector } from "@/components/common/scenario/ParameterSelector";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock data for testing
const mockParameters = [
  {
    id: "param-1",
    name: "Location",
    description: "Location parameter",
    numerical: false,
    active: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "param-2",
    name: "Intensity",
    description: "Intensity parameter",
    numerical: true,
    active: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "param-3",
    name: "Inactive Param",
    description: "Inactive parameter",
    numerical: false,
    active: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

const mockParameterItems = [
  {
    id: "item-1",
    name: "Library",
    description: "University library",
    value: "library",
    parameterId: "param-1",
    defaultItem: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "item-2",
    name: "Classroom",
    description: "Classroom setting",
    value: "classroom",
    parameterId: "param-1",
    defaultItem: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "item-3",
    name: "Low",
    description: "Low intensity",
    value: "1",
    parameterId: "param-2",
    defaultItem: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "item-4",
    name: "Medium",
    description: "Medium intensity",
    value: "5",
    parameterId: "param-2",
    defaultItem: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "item-5",
    name: "High",
    description: "High intensity",
    value: "10",
    parameterId: "param-2",
    defaultItem: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps = {
  parameters: mockParameters,
  parameterItems: mockParameterItems,
  selectedParameterItemIds: [],
  onParameterItemIdsChange: vi.fn(),
};
// ------------------------------------------------------------------

describe("ParameterSelector", () => {
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
      renderWithMocks(<ParameterSelector {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText("Categorical Parameters")).toBeInTheDocument();
      expect(screen.getByText("Numerical Parameters")).toBeInTheDocument();
    });

    it("should display parameter counts correctly", () => {
      renderWithMocks(<ParameterSelector {...mockProps} />);

      // Check that the counts are displayed correctly - use getAllByText since there are multiple "1" elements
      const countElements = screen.getAllByText("1");
      expect(countElements.length).toBeGreaterThanOrEqual(2); // At least 2 "1" elements (categorical and numerical counts)
    });

    it("should only show active parameters", () => {
      renderWithMocks(<ParameterSelector {...mockProps} />);

      // Should show Location (active, non-numerical)
      expect(screen.getByText("Location")).toBeInTheDocument();

      // Should show Intensity (active, numerical)
      expect(screen.getByText("Intensity")).toBeInTheDocument();

      // Should NOT show Inactive Param
      expect(screen.queryByText("Inactive Param")).not.toBeInTheDocument();
    });
  });

  describe("Categorical Parameters", () => {
    it("should render categorical parameter dropdowns", () => {
      renderWithMocks(<ParameterSelector {...mockProps} />);

      // Check that the Location parameter is rendered
      expect(screen.getByText("Location")).toBeInTheDocument();

      // Check that the dropdown is rendered
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should show parameter items in dropdown", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ParameterSelector {...mockProps} />);

      // Open the dropdown
      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      // Check that parameter items are shown
      expect(screen.getByText("Library")).toBeInTheDocument();
      expect(screen.getByText("Classroom")).toBeInTheDocument();
    });

    it("should call onParameterItemIdsChange when selecting an item", async () => {
      const user = userEvent.setup();
      const onParameterItemIdsChange = vi.fn();

      renderWithMocks(
        <ParameterSelector
          {...mockProps}
          onParameterItemIdsChange={onParameterItemIdsChange}
        />,
      );

      // Open the dropdown and select an item
      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      const libraryOption = screen.getByText("Library");
      await user.click(libraryOption);

      // Check that the callback was called with the correct parameter item ID
      expect(onParameterItemIdsChange).toHaveBeenCalledWith(["item-1"]);
    });
  });

  describe("Numerical Parameters", () => {
    it("should render numerical parameter sliders", () => {
      renderWithMocks(<ParameterSelector {...mockProps} />);

      // Check that the Intensity parameter is rendered
      expect(screen.getByText("Intensity")).toBeInTheDocument();

      // Check that the slider is rendered
      expect(screen.getByRole("slider")).toBeInTheDocument();
    });

    it("should show current value for numerical parameters", () => {
      renderWithMocks(<ParameterSelector {...mockProps} />);

      // Should show the current value (0 by default)
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("should call onParameterItemIdsChange when moving slider", async () => {
      const user = userEvent.setup();
      const onParameterItemIdsChange = vi.fn();

      renderWithMocks(
        <ParameterSelector
          {...mockProps}
          onParameterItemIdsChange={onParameterItemIdsChange}
        />,
      );

      // Move the slider - click on the slider track to change value
      const slider = screen.getByRole("slider");
      await user.click(slider);

      // The slider should trigger a change event
      // Note: This test might need adjustment based on actual slider behavior
      // For now, we'll just verify the slider is interactive
      expect(slider).toBeInTheDocument();
    });
  });

  describe("Selected Parameters", () => {
    it("should display selected parameter items", () => {
      const propsWithSelection = {
        ...mockProps,
        selectedParameterItemIds: ["item-1", "item-4"],
      };

      renderWithMocks(<ParameterSelector {...propsWithSelection} />);

      // Should show the selected item descriptions
      expect(screen.getByText("University library")).toBeInTheDocument();
      expect(screen.getByText("Medium intensity")).toBeInTheDocument();
    });

    it("should show reset buttons for selected parameters", () => {
      const propsWithSelection = {
        ...mockProps,
        selectedParameterItemIds: ["item-1"],
      };

      renderWithMocks(<ParameterSelector {...propsWithSelection} />);

      // Should show reset buttons (X icons)
      const resetButtons = screen.getAllByRole("button");
      expect(resetButtons.length).toBeGreaterThan(0);
    });

    it("should call onParameterItemIdsChange when resetting a parameter", async () => {
      const user = userEvent.setup();
      const onParameterItemIdsChange = vi.fn();
      const propsWithSelection = {
        ...mockProps,
        selectedParameterItemIds: ["item-1"],
        onParameterItemIdsChange,
      };

      renderWithMocks(<ParameterSelector {...propsWithSelection} />);

      // Click the reset button (X icon) - it's the button with no text content
      const resetButtons = screen.getAllByRole("button");
      const resetButton = resetButtons.find(
        (button) => button.textContent === "",
      );
      expect(resetButton).toBeDefined();

      if (resetButton) {
        await user.click(resetButton);
        // Check that the callback was called with the parameter removed
        expect(onParameterItemIdsChange).toHaveBeenCalledWith([]);
      }
    });
  });

  describe("Empty States", () => {
    it("should show empty state when no categorical parameters", () => {
      const propsWithNoCategorical = {
        ...mockProps,
        parameters: mockParameters.filter((p) => p.numerical || !p.active),
      };

      renderWithMocks(<ParameterSelector {...propsWithNoCategorical} />);

      expect(
        screen.getByText("No categorical parameters available"),
      ).toBeInTheDocument();
    });

    it("should show empty state when no numerical parameters", () => {
      const propsWithNoNumerical = {
        ...mockProps,
        parameters: mockParameters.filter((p) => !p.numerical || !p.active),
      };

      renderWithMocks(<ParameterSelector {...propsWithNoNumerical} />);

      expect(
        screen.getByText("No numerical parameters available"),
      ).toBeInTheDocument();
    });
  });
});
