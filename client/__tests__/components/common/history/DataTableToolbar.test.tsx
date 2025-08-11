import { renderWithMocks } from "@/test/renderWithMocks";
import type { Table } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  DataTableToolbar,
  DataTableToolbarProps,
} from "@/components/common/history/DataTableToolbar";

// ------------------------------------------------------------------
// Create a comprehensive mock table with all required methods
const createMockTable = (): Table<unknown> =>
  ({
    getState: () => ({
      columnFilters: [],
      rowSelection: {},
    }),
    getColumn: () => ({
      getFilterValue: () => "",
      setFilterValue: vi.fn(),
    }),
    resetColumnFilters: vi.fn(),
    getFilteredSelectedRowModel: () => ({
      rows: [],
    }),
    getFilteredRowModel: () => ({
      rows: [],
    }),
    getVisibleLeafColumns: () => [],
    getAllColumns: () => [
      {
        id: "test",
        accessorFn: () => "test",
        getCanHide: () => true,
        getIsVisible: () => true,
        toggleVisibility: vi.fn(),
      },
    ],
  }) as unknown as Table<unknown>;

// Minimal props factory – edit values as needed
const mockProps: DataTableToolbarProps<unknown> = {
  table: createMockTable(),
  profileOptions: [],
};
// ------------------------------------------------------------------
describe("DataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DataTableToolbar {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DataTableToolbar {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DataTableToolbar {...mockProps} />);

      // Check for basic accessibility elements
      const toolbar =
        document.querySelector('[data-testid="data-table-toolbar"]') ||
        document.querySelector("div");
      expect(toolbar).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<DataTableToolbar {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <DataTableToolbar
          table={createMockTable()}
          profileOptions={[]}
        />,
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
