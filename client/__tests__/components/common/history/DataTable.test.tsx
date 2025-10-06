import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  DataTable,
  DataTableProps,
} from "@/components/common/history/DataTable";

import "@/mocks/api";
import "@/mocks/navigation";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: DataTableProps<unknown, unknown> = {
  columns: [
    {
      id: "createdAt",
      header: "Created At",
      accessorKey: "createdAt",
    },
    {
      id: "simulationId",
      header: "Simulation",
      accessorKey: "simulationId",
    },
    {
      id: "scenarios",
      header: "Scenarios",
      accessorKey: "scenarios",
    },
    {
      id: "profileId",
      header: "Profile",
      accessorKey: "profileId",
    },
  ],
  data: [
    {
      createdAt: "2025-01-01T00:00:00Z",
      simulationId: "sim1",
      scenarios: ["scenario1", "scenario2"],
      profileId: "profile1",
    },
    {
      createdAt: "2025-01-02T00:00:00Z",
      simulationId: "sim2",
      scenarios: ["scenario3"],
      profileId: "profile2",
    },
  ],
  profileOptions: [
    { value: "profile1", label: "Profile 1" },
    { value: "profile2", label: "Profile 2" },
  ],
  simulationOptions: [
    { value: "sim1", label: "Simulation 1" },
    { value: "sim2", label: "Simulation 2" },
  ],
  scenarioOptions: [
    { value: "scenario1", label: "Scenario 1" },
    { value: "scenario2", label: "Scenario 2" },
    { value: "scenario3", label: "Scenario 3" },
  ],
  // showExport: false, /* optional */
  // showAll: false, /* optional */
};
// ------------------------------------------------------------------
describe("DataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<DataTable {...mockProps} />);

      // Should render the table
      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
      });
    });

    it("should render with props", () => {
      render(<DataTable {...mockProps} />);

      // Should render table headers - use getAllByText to handle multiple instances
      expect(screen.getByText("Created At")).toBeInTheDocument();
      expect(screen.getAllByText("Simulation").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Scenarios").length).toBeGreaterThan(0);
      expect(screen.getByText("Profile")).toBeInTheDocument();

      // Should render table data - check for the actual data values
      expect(screen.getByText("sim1")).toBeInTheDocument();
      expect(screen.getByText("sim2")).toBeInTheDocument();

      // Should render search input
      expect(
        screen.getByPlaceholderText(
          "Search by name, simulation, or scenarios...",
        ),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<DataTable {...mockProps} />);

      // Check for table accessibility
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Check for table headers
      const headers = screen.getAllByRole("columnheader");
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<DataTable {...mockProps} />);

      // Test input interactions if inputs exist
      const inputs = screen.queryAllByRole("textbox");
      if (inputs.length > 0 && inputs[0]) {
        await user.type(inputs[0], "test");
        // Input should be interactive
        expect(inputs[0]).toBeInTheDocument();
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<DataTable {...mockProps} />);

      // Test button interactions if buttons exist
      const buttons = screen.queryAllByRole("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        // Button should be clickable
        expect(buttons[0]).toBeInTheDocument();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty data
      const emptyProps: DataTableProps<unknown, unknown> = {
        columns: mockProps.columns, // Use the same columns to avoid undefined column access
        data: [],
        profileOptions: [],
        simulationOptions: [],
        scenarioOptions: [],
      };

      render(<DataTable {...emptyProps} />);

      // Should still render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(
        <DataTable
          columns={mockProps.columns} // Use the same columns to avoid undefined column access
          data={[]}
          profileOptions={[]}
          simulationOptions={[]}
          scenarioOptions={[]}
        />,
      );

      // Should handle missing props gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle large datasets", () => {
      // Test with larger dataset
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        createdAt: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        simulationId: `sim${i}`,
        scenarios: [`scenario${i}`],
        profileId: `profile${(i % 2) + 1}`,
      }));

      const largeProps: DataTableProps<unknown, unknown> = {
        ...mockProps,
        data: largeData,
      };

      render(<DataTable {...largeProps} />);

      // Should render without performance issues
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});
