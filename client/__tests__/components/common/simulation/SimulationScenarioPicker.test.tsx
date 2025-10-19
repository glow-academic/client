import type { ScenarioMappingItem } from "@/lib/api/v2/schemas/base";
import { render, screen } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  SimulationScenarioPicker,
  SimulationScenarioPickerProps,
} from "@/components/common/simulation/SimulationScenarioPicker";

// ------------------------------------------------------------------
// Mock data for testing
const mockScenarioMapping: Record<string, ScenarioMappingItem> = {
  "scenario-1": {
    name: "Test Scenario 1",
    description: "Description 1",
    persona_id: "persona-1",
    persona_mapping: {
      "persona-1": {
        name: "Student Persona",
        description: "A student",
        color: "#FF5733",
        icon: "user",
      },
    },
    document_mapping: {
      "doc-1": {
        name: "Document 1",
        description: "Test document",
      },
    },
    parameter_item_mapping: {
      "param-1": {
        name: "Item 1",
        description: "Parameter item 1",
        parameter_id: "p1",
        parameter_name: "Parameter 1",
      },
    },
    parameter_item_ids: ["param-1"],
    document_ids: ["doc-1"],
  },
  "scenario-2": {
    name: "Test Scenario 2",
    description: "Description 2",
    persona_id: null,
    persona_mapping: {},
    document_mapping: {},
    parameter_item_mapping: {},
    parameter_item_ids: [],
    document_ids: [],
  },
  "scenario-3": {
    name: "Test Scenario 3",
    description: "Description 3",
    persona_id: "persona-2",
    persona_mapping: {
      "persona-2": {
        name: "Teacher Persona",
        description: "A teacher",
        color: "#33FF57",
        icon: "user-check",
      },
    },
    document_mapping: {
      "doc-2": {
        name: "Document 2",
        description: "Another document",
      },
    },
    parameter_item_mapping: {
      "param-2": {
        name: "Item 2",
        description: "Parameter item 2",
        parameter_id: "p2",
        parameter_name: "Parameter 2",
      },
    },
    parameter_item_ids: ["param-2"],
    document_ids: ["doc-2"],
  },
};

const defaultProps: SimulationScenarioPickerProps = {
  scenarioMapping: mockScenarioMapping,
  validScenarioIds: ["scenario-1", "scenario-2", "scenario-3"],
  selectedScenarioIds: [],
  onSelect: vi.fn(),
};

// ------------------------------------------------------------------
describe("SimulationScenarioPicker", () => {
  describe("Basic Rendering", () => {
    it("renders without crashing", () => {
      render(<SimulationScenarioPicker {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /select scenarios/i })
      ).toBeInTheDocument();
    });

    it("renders with custom label", () => {
      render(
        <SimulationScenarioPicker {...defaultProps} label="Custom Label" />
      );
      expect(screen.getByText("Custom Label")).toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      render(
        <SimulationScenarioPicker
          {...defaultProps}
          placeholder="Custom placeholder"
        />
      );
      expect(
        screen.getByRole("button", { name: /custom placeholder/i })
      ).toBeInTheDocument();
    });

    it("shows selected scenario count when multiple selected", () => {
      render(
        <SimulationScenarioPicker
          {...defaultProps}
          selectedScenarioIds={["scenario-1", "scenario-2"]}
        />
      );
      expect(screen.getByText("2 scenarios selected")).toBeInTheDocument();
    });
  });

  describe("Filter Options Building", () => {
    it("opens popover when clicked", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      expect(screen.getByText("Test Scenario 1")).toBeInTheDocument();
      expect(screen.getByText("Test Scenario 2")).toBeInTheDocument();
      expect(screen.getByText("Test Scenario 3")).toBeInTheDocument();
    });

    it("opens filter popover when filter button clicked", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      // Check for filter sections
      expect(screen.getByText("Personas")).toBeInTheDocument();
      expect(screen.getByText("Documents")).toBeInTheDocument();
      expect(screen.getByText("Parameter Items")).toBeInTheDocument();
    });
  });

  describe("Persona Filtering", () => {
    it("filters scenarios by persona", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      // Open filter
      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      // Select a persona filter
      const studentPersona = screen.getByText("Student Persona");
      await user.click(studentPersona);

      // Close filter
      const doneButton = screen.getByRole("button", { name: /done/i });
      await user.click(doneButton);

      // Only scenario-1 should be visible now
      expect(screen.getByText("Test Scenario 1")).toBeInTheDocument();
      expect(screen.queryByText("Test Scenario 2")).not.toBeInTheDocument();
    });

    it('shows "No Persona" option when scenarios without personas exist', async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      expect(screen.getByText("No Persona")).toBeInTheDocument();
    });
  });

  describe("Document Filtering", () => {
    it("filters scenarios by document", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      // Select a document filter
      const document1 = screen.getByText("Document 1");
      await user.click(document1);

      const doneButton = screen.getByRole("button", { name: /done/i });
      await user.click(doneButton);

      // Only scenario-1 should be visible
      expect(screen.getByText("Test Scenario 1")).toBeInTheDocument();
      expect(screen.queryByText("Test Scenario 2")).not.toBeInTheDocument();
    });

    it('shows "No Documents" option when scenarios without documents exist', async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      expect(screen.getByText("No Documents")).toBeInTheDocument();
    });
  });

  describe("Parameter Item Filtering", () => {
    it("filters scenarios by parameter items", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      // Select a parameter item filter
      const paramItem = screen.getByText("Parameter 1: Item 1");
      await user.click(paramItem);

      const doneButton = screen.getByRole("button", { name: /done/i });
      await user.click(doneButton);

      // Only scenario-1 should be visible
      expect(screen.getByText("Test Scenario 1")).toBeInTheDocument();
      expect(screen.queryByText("Test Scenario 2")).not.toBeInTheDocument();
    });

    it('shows "No Parameter Items" option when scenarios without params exist', async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      expect(screen.getByText("No Parameter Items")).toBeInTheDocument();
    });
  });

  describe("AND Filter Logic", () => {
    it("applies AND logic across filter groups", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      // Select persona AND document - should show only scenario-1
      const studentPersona = screen.getByText("Student Persona");
      await user.click(studentPersona);

      const document1 = screen.getByText("Document 1");
      await user.click(document1);

      const doneButton = screen.getByRole("button", { name: /done/i });
      await user.click(doneButton);

      expect(screen.getByText("Test Scenario 1")).toBeInTheDocument();
      expect(screen.queryByText("Test Scenario 2")).not.toBeInTheDocument();
      expect(screen.queryByText("Test Scenario 3")).not.toBeInTheDocument();
    });
  });

  describe("Filter Badge Indicator", () => {
    it("shows active filter badge when filters are applied", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });

      // Badge should not be visible initially
      expect(screen.queryByLabelText("Active filters")).not.toBeInTheDocument();

      await user.click(filterButton);

      const studentPersona = screen.getByText("Student Persona");
      await user.click(studentPersona);

      const doneButton = screen.getByRole("button", { name: /done/i });
      await user.click(doneButton);

      // Badge should now be visible
      expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
    });
  });

  describe("Clear Filters", () => {
    it("clears all filters when Clear All is clicked", async () => {
      const user = userEvent.setup();
      render(<SimulationScenarioPicker {...defaultProps} />);

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const filterButton = screen.getByRole("button", {
        name: /filter by parameters/i,
      });
      await user.click(filterButton);

      // Select some filters
      const studentPersona = screen.getByText("Student Persona");
      await user.click(studentPersona);

      // Clear all
      const clearButton = screen.getByRole("button", { name: /clear all/i });
      await user.click(clearButton);

      // All scenarios should be visible again
      const doneButton = screen.getByRole("button", { name: /done/i });
      await user.click(doneButton);

      expect(screen.getByText("Test Scenario 1")).toBeInTheDocument();
      expect(screen.getByText("Test Scenario 2")).toBeInTheDocument();
      expect(screen.getByText("Test Scenario 3")).toBeInTheDocument();
    });
  });

  describe("Selection Handling", () => {
    it("calls onSelect when scenario is clicked", async () => {
      const onSelectMock = vi.fn();
      const user = userEvent.setup();
      render(
        <SimulationScenarioPicker {...defaultProps} onSelect={onSelectMock} />
      );

      const button = screen.getByRole("button", { name: /select scenarios/i });
      await user.click(button);

      const scenario1 = screen.getByText("Test Scenario 1");
      await user.click(scenario1);

      expect(onSelectMock).toHaveBeenCalledWith(["scenario-1"]);
    });

    it("deselects scenario when clicked again", async () => {
      const onSelectMock = vi.fn();
      const user = userEvent.setup();
      render(
        <SimulationScenarioPicker
          {...defaultProps}
          selectedScenarioIds={["scenario-1"]}
          onSelect={onSelectMock}
        />
      );

      const button = screen.getByRole("button", { name: /test scenario 1/i });
      await user.click(button);

      const scenario1 = screen.getByText("Test Scenario 1");
      await user.click(scenario1);

      expect(onSelectMock).toHaveBeenCalledWith([]);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty scenario mapping", () => {
      render(
        <SimulationScenarioPicker
          {...defaultProps}
          scenarioMapping={{}}
          validScenarioIds={[]}
        />
      );
      expect(
        screen.getByRole("button", { name: /select scenarios/i })
      ).toBeInTheDocument();
    });

    it("handles scenarios with missing nested data", () => {
      const incompleteMapping: Record<string, ScenarioMappingItem> = {
        "scenario-x": {
          name: "Incomplete Scenario",
          description: "Missing nested data",
          persona_id: null,
          persona_mapping: {},
          document_mapping: {},
          parameter_item_mapping: {},
          parameter_item_ids: [],
          document_ids: [],
        },
      };

      render(
        <SimulationScenarioPicker
          {...defaultProps}
          scenarioMapping={incompleteMapping}
          validScenarioIds={["scenario-x"]}
        />
      );
      expect(
        screen.getByRole("button", { name: /select scenarios/i })
      ).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for SimulationScenarioPicker:
 * Path: common/simulation/SimulationScenarioPicker.tsx
 *
 * Features:
 * - Uses ScenarioMappingItem from schemas with nested persona, document, parameter mappings
 * - Multi-section filter UI (Personas, Documents, Parameter Items)
 * - AND logic across filter groups, OR within groups
 * - Filter badge indicator shows active filters
 * - Handles "No X" options for empty data
 * - Frequency-based sorting for filter options
 */
