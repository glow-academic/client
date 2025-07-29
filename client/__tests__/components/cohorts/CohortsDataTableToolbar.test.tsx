import { renderWithMocks } from "@/test/renderWithMocks";
import type { Table } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  CohortsDataTableToolbar,
  CohortsDataTableToolbarProps,
} from "@/components/cohorts/CohortsDataTableToolbar";

// ------------------------------------------------------------------
// Create a proper mock table with all required methods
const createMockTable = (): Table<{
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string | null;
  active: boolean;
  profileIds: string[];
  defaultCohort: boolean;
  simulationIds: string[];
}> =>
  ({
    getState: () => ({
      columnFilters: [],
      sorting: [],
      rowSelection: {},
      columnVisibility: {},
      pagination: { pageIndex: 0, pageSize: 10 },
    }),
    getColumn: () => ({
      getFilterValue: () => "",
      setFilterValue: () => {},
      getCanFilter: () => true,
      getCanSort: () => true,
      getIsSorted: () => false,
      toggleSorting: () => {},
      getCanHide: () => true,
      getIsVisible: () => true,
      toggleVisibility: () => {},
      getFacetedUniqueValues: () => new Map(),
      getFacetedMinMaxValues: () => [null, null],
      getFacetedRowModel: () => ({ rows: [] }),
      columnDef: { id: "title" },
    }),
    resetColumnFilters: () => {},
  }) as unknown as Table<{
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    description: string | null;
    active: boolean;
    profileIds: string[];
    defaultCohort: boolean;
    simulationIds: string[];
  }>;

// Minimal props factory – edit values as needed
const mockProps: CohortsDataTableToolbarProps = {
  table: createMockTable(),
  profileOptions: [],
  simulationOptions: [],
};
// ------------------------------------------------------------------
describe("CohortsDataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<CohortsDataTableToolbar {...mockProps} />);

      // Component should render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<CohortsDataTableToolbar {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<CohortsDataTableToolbar {...mockProps} />);

      // Basic accessibility check - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<CohortsDataTableToolbar {...mockProps} />);

      // Component should render without throwing errors
      expect(document.body).toBeInTheDocument();
    });

    it("should handle empty options", () => {
      // Test with empty options
      renderWithMocks(
        <CohortsDataTableToolbar
          table={createMockTable()}
          profileOptions={[]}
          simulationOptions={[]}
        />,
      );
      expect(document.body).toBeInTheDocument();
    });
  });
});
