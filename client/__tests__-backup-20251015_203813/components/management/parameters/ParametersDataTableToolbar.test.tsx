import { render } from "@/test/custom-render";
import type { Table } from "@tanstack/react-table";
import { screen } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  ParametersDataTableToolbar,
  ParametersDataTableToolbarProps,
} from "@/components/management/parameters/ParametersDataTableToolbar";

// Import mocks
import "@/mocks/api";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockTable = {
  getState: () => ({
    columnFilters: [],
  }),
  getColumn: vi.fn(() => ({
    getFilterValue: vi.fn(() => ""),
    setFilterValue: vi.fn(),
    getFacetedUniqueValues: vi.fn(() => new Map()),
  })),
  resetColumnFilters: vi.fn(),
} as unknown as Table<{
  name: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  numerical: boolean;
  active: boolean;
}>;

const mockProps: ParametersDataTableToolbarProps = {
  table: mockTable,
  typeOptions: [
    { value: "true", label: "Numerical" },
    { value: "false", label: "Categorical" },
  ],
  itemCountOptions: [
    { value: "0", label: "0 items" },
    { value: "1-5", label: "1-5 items" },
  ],
  statusOptions: [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ],
  scenarioOptions: [
    { value: "scenario1", label: "Scenario 1" },
    { value: "scenario2", label: "Scenario 2" },
  ],
};
// ------------------------------------------------------------------
describe("ParametersDataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<ParametersDataTableToolbar {...mockProps} />);

      // Should render the search input
      expect(
        screen.getByPlaceholderText("Search parameters..."),
      ).toBeInTheDocument();

      // Should render filter options
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Items")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Scenarios")).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<ParametersDataTableToolbar {...mockProps} />);

      // Should render filter buttons
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Items")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Scenarios")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<ParametersDataTableToolbar {...mockProps} />);

      // Search input should be accessible
      const searchInput = screen.getByPlaceholderText("Search parameters...");
      expect(searchInput).toBeInTheDocument();

      // Filter buttons should be accessible
      const filterButtons = screen.getAllByRole("button");
      expect(filterButtons.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle search input changes", async () => {
      const user = userEvent.setup();
      render(<ParametersDataTableToolbar {...mockProps} />);

      const searchInput = screen.getByPlaceholderText("Search parameters...");
      await user.type(searchInput, "test parameter");

      // Input should be interactive
      expect(searchInput).toBeInTheDocument();
    });

    it("should handle filter interactions", async () => {
      const user = userEvent.setup();
      render(<ParametersDataTableToolbar {...mockProps} />);

      // Click on filter buttons
      const filterButtons = screen.getAllByRole("button");
      if (filterButtons.length > 0 && filterButtons[0]) {
        await user.click(filterButtons[0]);
        expect(filterButtons[0]).toBeInTheDocument();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty options
      const emptyProps: ParametersDataTableToolbarProps = {
        table: mockTable,
        typeOptions: [],
        itemCountOptions: [],
        statusOptions: [],
        scenarioOptions: [],
      };

      render(<ParametersDataTableToolbar {...emptyProps} />);

      // Should still render the search input
      expect(
        screen.getByPlaceholderText("Search parameters..."),
      ).toBeInTheDocument();

      // Should not render filter options when empty
      expect(screen.queryByText("Type")).not.toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps = {
        table: mockTable,
        typeOptions: [],
        itemCountOptions: [],
        statusOptions: [],
        scenarioOptions: [],
      };

      render(<ParametersDataTableToolbar {...minimalProps} />);

      // Should still render without crashing
      expect(
        screen.getByPlaceholderText("Search parameters..."),
      ).toBeInTheDocument();
    });
  });
});
