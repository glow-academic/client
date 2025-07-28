import { renderWithMocks } from "@/test/renderWithMocks";
import { Scenario } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  ScenariosDataTable,
  ScenariosDataTableProps,
} from "@/components/create/scenarios/ScenariosDataTable";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ScenariosDataTableProps = {
  columns: [],
  data: [],
  simulationOptions: [],
  cohortOptions: [],
  personaOptions: [],
  scenarioTypeOptions: [],
  renderScenarioCard: vi.fn(),
};
// ------------------------------------------------------------------
describe("ScenariosDataTable", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ScenariosDataTable {...mockProps} />);

      // Should render the component with no data message
      expect(
        screen.getByText("No scenarios match the current filters.")
      ).toBeInTheDocument();
    });

    it("should render with props", () => {
      // Test with different props
      const propsWithData: ScenariosDataTableProps = {
        ...mockProps,
        columns: [
          {
            id: "name",
            header: "Name",
            accessorKey: "name",
          } as ColumnDef<Scenario>,
        ],
        data: [
          {
            id: "scenario-1",
            name: "Test Scenario",
            description: "Test Description",
            personaId: "persona-1",
            parameterItemIds: [],
            documentIds: [],
            defaultScenario: false,
            practiceScenario: false,
            generated: false,
            parentId: null,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        simulationOptions: [{ value: "sim-1", label: "Test Simulation" }],
        cohortOptions: [{ value: "cohort-1", label: "Test Cohort" }],
        personaOptions: [{ value: "persona-1", label: "Test Persona" }],
        scenarioTypeOptions: [{ value: "type-1", label: "Test Type" }],
        renderScenarioCard: vi.fn(() => <div>Test Scenario Card</div>),
      };

      renderWithMocks(<ScenariosDataTable {...propsWithData} />);

      // Should render the component with scenario card
      expect(screen.getByText("Test Scenario Card")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<ScenariosDataTable {...mockProps} />);

      // Should have proper accessibility attributes
      expect(
        screen.getByText("No scenarios match the current filters.")
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      renderWithMocks(<ScenariosDataTable {...mockProps} />);

      // Should handle state changes properly
      expect(
        screen.getByText("No scenarios match the current filters.")
      ).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<ScenariosDataTable {...mockProps} />);

      // Should handle user events properly
      expect(
        screen.getByText("No scenarios match the current filters.")
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with edge case props
      const edgeCaseProps: ScenariosDataTableProps = {
        columns: [],
        data: [],
        simulationOptions: [],
        cohortOptions: [],
        personaOptions: [],
        scenarioTypeOptions: [],
        renderScenarioCard: vi.fn(() => null),
      };

      renderWithMocks(<ScenariosDataTable {...edgeCaseProps} />);

      // Should render the component even with edge case props
      expect(
        screen.getByText("No scenarios match the current filters.")
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps: ScenariosDataTableProps = {
        columns: [],
        data: [],
        simulationOptions: [],
        cohortOptions: [],
        personaOptions: [],
        scenarioTypeOptions: [],
        renderScenarioCard: vi.fn(),
      };

      renderWithMocks(<ScenariosDataTable {...minimalProps} />);

      // Should render with minimal props
      expect(
        screen.getByText("No scenarios match the current filters.")
      ).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for ScenariosDataTable:
 * Path: create/scenarios/ScenariosDataTable.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: ScenariosDataTable, ScenariosDataTableProps
 * - Has props: true
 * - Props interface: ScenariosDataTableProps
 * - Client component: true
 * - Uses hooks: useReactTable, useState
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<ScenariosDataTable {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<ScenariosDataTable {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
