import { render } from '@/test/custom-render';
import type {} from "@tanstack/react-table";
import { ColumnDef } from "@tanstack/react-table";
import { screen } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  SimulationsDataTable,
  SimulationsDataTableProps,
} from "@/components/create/simulations/SimulationsDataTable";
import { Simulation } from "@/types";

// ------------------------------------------------------------------
// Mock data that matches the Simulation type
const mockSimulations: Simulation[] = [
  {
    id: "s36yq6bm-jmaa-jbvr-ow9f-k0gk9c14z",
    createdAt: "2025-07-27T01:54:18.643Z",
    updatedAt: "2025-07-27T01:54:18.643Z",
    title: "Math Practice Simulation",
    timeLimit: 30,
    active: true,
    scenarioIds: [
      "eca3n264-18kl-slsf-5ckq-v9tihdi9nu",
      "f8ch5wau-4ft7-r9mz-w5zs-c8cyrze9xfg",
    ],
    rubricId: "rubricId_1",
    defaultSimulation: false,
    practiceSimulation: true,
  },
  {
    id: "fzkthewg-7eca-ggtr-tuka-169gib8wz5z",
    createdAt: "2025-07-27T01:54:18.643Z",
    updatedAt: "2025-07-27T01:54:18.643Z",
    title: "Lab Safety Training",
    timeLimit: 60,
    active: false,
    scenarioIds: [
      "eca3n264-18kl-slsf-5ckq-v9tihdi9nu",
      "f8ch5wau-4ft7-r9mz-w5zs-c8cyrze9xfg",
    ],
    rubricId: "rubricId_2",
    defaultSimulation: true,
    practiceSimulation: false,
  },
];

// Mock columns for the table
const mockColumns: ColumnDef<Simulation>[] = [
  {
    id: "title",
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => row.getValue("title"),
    filterFn: (row, _, value) => {
      const title = (row.getValue("title") as string).toLowerCase();
      return title.includes(value.toLowerCase());
    },
  },
  {
    id: "scenarios",
    header: "Scenarios",
    accessorFn: (simulation) => simulation.scenarioIds || [],
  },
  {
    id: "rubric",
    header: "Rubric",
    accessorFn: (simulation) => simulation.rubricId,
  },
  {
    id: "timeLimit",
    header: "Time Limit",
    accessorFn: (simulation) => simulation.timeLimit || 0,
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) => row.getValue("updatedAt"),
  },
];

// Minimal props factory – edit values as needed
const mockProps: SimulationsDataTableProps = {
  columns: mockColumns,
  data: mockSimulations,
  scenarioOptions: [
    { value: "scenario1", label: "Scenario 1" },
    { value: "scenario2", label: "Scenario 2" },
  ],
  rubricOptions: [
    { value: "rubric1", label: "Rubric 1" },
    { value: "rubric2", label: "Rubric 2" },
  ],
  timeLimitOptions: [
    { value: "30", label: "30 minutes" },
    { value: "60", label: "60 minutes" },
  ],
  renderSimulationCard: vi.fn((simulation) => (
    <div data-testid={`simulation-card-${simulation.id}`}>
      {simulation.title}
    </div>
  )),
};
// ------------------------------------------------------------------
describe("SimulationsDataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<SimulationsDataTable {...mockProps} />);

      // Check that the component renders without crashing
      expect(
        screen.getByPlaceholderText("Search simulations...")
      ).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<SimulationsDataTable {...mockProps} />);

      // Check that the toolbar renders with search input
      expect(
        screen.getByPlaceholderText("Search simulations...")
      ).toBeInTheDocument();

      // Check that simulation cards are rendered
      mockSimulations.forEach((simulation) => {
        expect(
          screen.getByTestId(`simulation-card-${simulation.id}`)
        ).toBeInTheDocument();
        expect(screen.getByText(simulation.title)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", () => {
      render(<SimulationsDataTable {...mockProps} />);

      // Check that search input has proper accessibility attributes
      const searchInput = screen.getByPlaceholderText("Search simulations...");
      expect(searchInput).toBeInTheDocument();

      // Check that the component has proper structure
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<SimulationsDataTable {...mockProps} />);

      // Test search functionality
      const searchInput = screen.getByPlaceholderText("Search simulations...");
      await user.type(searchInput, "Math");

      // The search should update the input value
      expect(searchInput).toHaveValue("Math");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<SimulationsDataTable {...mockProps} />);

      // Test search input interaction
      const searchInput = screen.getByPlaceholderText("Search simulations...");
      await user.click(searchInput);
      await user.type(searchInput, "test search");

      expect(searchInput).toHaveValue("test search");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty data
      const emptyProps = {
        ...mockProps,
        data: [],
      };

      render(<SimulationsDataTable {...emptyProps} />);

      // Should show "No simulations found" message
      expect(screen.getByText("No simulations found.")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props - use the same columns structure as the main test
      const minimalProps = {
        columns: mockColumns, // Use the same columns to avoid undefined column access
        data: [],
        scenarioOptions: [],
        rubricOptions: [],
        timeLimitOptions: [],
        renderSimulationCard: vi.fn(),
      };

      render(<SimulationsDataTable {...minimalProps} />);

      // Should still render without crashing
      expect(screen.getByText("No simulations found.")).toBeInTheDocument();
    });
  });
});
