import { DataTableToolbar } from "@/components/common/history/data-table-toolbar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Column, Table, TableState } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <SessionProvider session={null}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
};

// Helper function to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

// Mock the child components
vi.mock("@/components/common/history/data-table-view-options", () => ({
  DataTableViewOptions: () => <div data-testid="view-options">View</div>,
}));

vi.mock("@/components/common/history/export-button", () => ({
  ExportButton: () => <div data-testid="export-button">Export</div>,
}));

vi.mock("@/components/ui/date-picker-range", () => ({
  DatePickerWithRange: ({
    dateRange,
  }: {
    dateRange?: { from?: Date; to?: Date };
  }) => (
    <button
      role="button"
      aria-label={
        dateRange
          ? `${dateRange.from?.toLocaleDateString()} - ${dateRange.to?.toLocaleDateString()}`
          : "filter by date"
      }
    >
      {dateRange
        ? `${dateRange.from?.toLocaleDateString()} - ${dateRange.to?.toLocaleDateString()}`
        : "Pick a date"}
    </button>
  ),
}));

vi.mock("@/components/common/history/data-table-faceted-filter", () => ({
  DataTableFacetedFilter: ({ title }: { title: string }) => (
    <div data-testid="faceted-filter-name">{title}</div>
  ),
}));

// Mock the table column for testing
const mockColumn = {
  setFilterValue: vi.fn(),
  getFilterValue: vi.fn(() => ""),
  columnDef: { header: "Test Column" },
  id: "test-column",
  depth: 0,
  accessorFn: vi.fn(),
  columns: [],
  parent: undefined as unknown as Column<unknown, unknown>,
  getFlatColumns: vi.fn(() => []),
  getLeafColumns: vi.fn(() => []),
} as Partial<Column<unknown, unknown>> as Column<unknown, unknown>;

const mockTable = {
  getColumn: vi.fn(() => mockColumn),
  getState: vi.fn(
    (): TableState => ({
      columnFilters: [],
      columnVisibility: {},
      columnOrder: [],
      columnPinning: { left: [], right: [] },
      rowPinning: { top: [], bottom: [] },
      columnSizing: {},
      columnSizingInfo: {
        startOffset: null,
        startSize: null,
        deltaOffset: null,
        deltaPercentage: null,
        isResizingColumn: false,
        columnSizingStart: [],
      },
      expanded: {},
      grouping: [],
      pagination: { pageIndex: 0, pageSize: 10 },
      rowSelection: {},
      sorting: [],
      globalFilter: undefined,
    })
  ),
  resetColumnFilters: vi.fn(),
} as Partial<Table<unknown>> as Table<unknown>;

const mockUserOptions = [
  { value: "user1", label: "User 1" },
  { value: "user2", label: "User 2" },
];

const mockClassOptions = [
  { value: "class1", label: "Class 1" },
  { value: "class2", label: "Class 2" },
];

const mockScoreRangeOptions = [
  { value: "0-10", label: "0-10" },
  { value: "10-20", label: "10-20" },
];

describe("DataTableToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(
        screen.getByPlaceholderText("Filter simulations...")
      ).toBeInTheDocument();
    });

    it("should render filter input for simulations", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(
        screen.getByPlaceholderText("Filter simulations...")
      ).toBeInTheDocument();
    });

    it("should render export button when showExport is true", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          showExport={true}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    it("should not render export button when showExport is false", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          showExport={false}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.queryByTestId("export-button")).not.toBeInTheDocument();
    });

    it("should render view options", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.getByTestId("view-options")).toBeInTheDocument();
    });
  });

  describe("Filter Input", () => {
    it("should handle search input correctly", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      const input = screen.getByPlaceholderText("Filter simulations...");
      await user.clear(input);
      await user.type(input, "test search");

      expect(mockTable.getColumn).toHaveBeenCalledWith("simulationTitle");
      // Check that setFilterValue was called with the search text (it gets called for each character)
      // We need to check that the final complete string was called
      expect(mockColumn.setFilterValue).toHaveBeenNthCalledWith(
        11,
        "test search"
      );
    });

    it("should display current filter value", () => {
      const tableWithFilter: Partial<Table<unknown>> = {
        ...mockTable,
        getColumn: vi.fn(() => ({
          ...mockColumn,
          getFilterValue: vi.fn(() => "existing filter"),
        })),
      };

      renderWithProviders(
        <DataTableToolbar
          table={tableWithFilter as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      const input = screen.getByDisplayValue("existing filter");
      expect(input).toBeInTheDocument();
    });

    it("should clear filter when input is cleared", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      const input = screen.getByPlaceholderText("Filter simulations...");
      await user.type(input, "test");
      await user.clear(input);

      // user.clear() triggers individual character deletions, so we check the final call
      expect(mockColumn.setFilterValue).toHaveBeenNthCalledWith(8, "");
    });
  });

  describe("Faceted Filters", () => {
    it("should render user filter", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("should render class filter", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(mockTable.getColumn).toHaveBeenCalledWith("classIds");
    });

    it("should not render filters when options are empty", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={[]}
          classOptions={[]}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      // Filters should not render when options are empty
      expect(screen.queryByText("Name")).not.toBeInTheDocument();
      expect(screen.queryByText("Class")).not.toBeInTheDocument();
    });
  });

  describe("Reset Filters", () => {
    it("should show reset button when filters are active", () => {
      const tableWithFilters: Partial<Table<unknown>> = {
        ...mockTable,
        getState: vi.fn(
          () =>
            ({
              columnFilters: [
                { id: "userId", value: "user1" },
                { id: "classIds", value: "class1" },
              ],
            }) as TableState
        ),
      };

      renderWithProviders(
        <DataTableToolbar
          table={tableWithFilters as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.getByText("Reset")).toBeInTheDocument();
    });

    it("should not show reset button when no filters are active", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.queryByText("Reset")).not.toBeInTheDocument();
    });

    it("should ignore date filter when determining if filters are active", () => {
      const tableWithDateFilter: Partial<Table<unknown>> = {
        ...mockTable,
        getState: vi.fn(
          () =>
            ({
              columnFilters: [
                { id: "createdAt", value: [new Date(), new Date()] },
              ],
            }) as TableState
        ),
      };

      renderWithProviders(
        <DataTableToolbar
          table={tableWithDateFilter as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.queryByText("Reset")).not.toBeInTheDocument();
    });

    it("should reset filters when reset button is clicked", async () => {
      const user = userEvent.setup();
      const tableWithFilters: Partial<Table<unknown>> = {
        ...mockTable,
        getState: vi.fn(
          () =>
            ({
              columnFilters: [{ id: "userId", value: "user1" }],
            }) as TableState
        ),
      };

      renderWithProviders(
        <DataTableToolbar
          table={tableWithFilters as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      const resetButton = screen.getByText("Reset");
      await user.click(resetButton);

      expect(mockTable.resetColumnFilters).toHaveBeenCalled();
    });
  });

  describe("Date Picker", () => {
    it("should render date picker when setDateRange is provided", () => {
      const mockSetDateRange = vi.fn();

      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          setDateRange={mockSetDateRange}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(
        screen.getByRole("button", { name: /filter by date/i })
      ).toBeInTheDocument();
    });

    it("should not render date picker when setDateRange is not provided", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(screen.queryByTestId("date-picker")).not.toBeInTheDocument();
    });

    it("should pass dateRange to date picker", () => {
      const mockSetDateRange = vi.fn();
      const testDateRange = {
        from: new Date("2025-06-08"),
        to: new Date("2025-06-08"),
      };

      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          dateRange={testDateRange}
          setDateRange={mockSetDateRange}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(
        screen.getByRole("button", { name: /6\/8\/2025/i })
      ).toBeInTheDocument();
    });
  });

  describe("Props Handling", () => {
    it("should pass correct props to child components", () => {
      const mockSetDateRange = vi.fn();

      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          dateRange={{
            from: new Date("2025-06-08"),
            to: new Date("2025-06-08"),
          }}
          setDateRange={mockSetDateRange}
          scoreRangeOptions={mockScoreRangeOptions}
          showExport={true}
        />
      );

      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(screen.getByText("View")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /6\/8\/2025/i })
      ).toBeInTheDocument();
    });

    it("should handle missing optional props", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
          showExport={false}
        />
      );

      expect(screen.getByText("View")).toBeInTheDocument();
      expect(screen.queryByText("Export")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /filter by date/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Column Access", () => {
    it("should access correct columns for filtering", () => {
      renderWithProviders(
        <DataTableToolbar
          table={mockTable as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(mockTable.getColumn).toHaveBeenCalledWith("simulationTitle");
      expect(mockTable.getColumn).toHaveBeenCalledWith("profileId");
      expect(mockTable.getColumn).toHaveBeenCalledWith("classIds");
    });

    it("should handle missing columns gracefully", () => {
      const tableWithMissingColumns: Partial<Table<unknown>> = {
        ...mockTable,
        getColumn: vi.fn(() => undefined),
      };

      renderWithProviders(
        <DataTableToolbar
          table={tableWithMissingColumns as Table<unknown>}
          profileOptions={mockUserOptions}
          classOptions={mockClassOptions}
          scoreRangeOptions={mockScoreRangeOptions}
        />
      );

      expect(
        screen.getByPlaceholderText("Filter simulations...")
      ).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for data-table-toolbar:
 * Path: common/history/data-table-toolbar.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: DataTableToolbar
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: userOptions, uses, users, userId
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * renderWithProviders(<data-table-toolbar />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * renderWithProviders(<data-table-toolbar {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
