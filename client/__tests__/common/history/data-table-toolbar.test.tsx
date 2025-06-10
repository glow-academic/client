import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { DataTableToolbar } from "@/components/common/history/data-table-toolbar";

// Mock the child components
vi.mock("@/components/common/history/data-table-view-options", () => ({
  DataTableViewOptions: ({ table }: any) => (
    <div data-testid="view-options">View Options</div>
  ),
}));

vi.mock("@/components/common/history/export-button", () => ({
  ExportButton: ({ table }: any) => (
    <div data-testid="export-button">Export</div>
  ),
}));

vi.mock("@/components/ui/date-picker-range", () => ({
  DatePickerWithRange: ({ dateRange, setDateRange }: any) => (
    <div data-testid="date-picker">Date Picker</div>
  ),
}));

vi.mock("@/components/common/history/data-table-faceted-filter", () => ({
  DataTableFacetedFilter: ({ column, title, options }: any) => (
    <div data-testid={`faceted-filter-${title?.toLowerCase()}`}>
      {title} Filter
    </div>
  ),
}));

// Mock the table object for testing
const mockColumn = {
  getFilterValue: vi.fn(() => ""),
  setFilterValue: vi.fn(),
};

const mockTable = {
  getColumn: vi.fn((id: string) => mockColumn),
  getState: vi.fn(() => ({
    columnFilters: [],
  })),
  resetColumnFilters: vi.fn(),
};

const mockUserOptions = [
  { value: "user1", label: "User 1" },
  { value: "user2", label: "User 2" },
];

const mockClassOptions = [
  { value: "class1", label: "Class 1" },
  { value: "class2", label: "Class 2" },
];

describe("DataTableToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      expect(
        screen.getByPlaceholderText("Filter chats..."),
      ).toBeInTheDocument();
    });

    it("should render filter input for chats mode", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      expect(
        screen.getByPlaceholderText("Filter chats..."),
      ).toBeInTheDocument();
    });

    it("should render filter input for attempts mode", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="attempts"
        />,
      );

      expect(
        screen.getByPlaceholderText("Filter simulations..."),
      ).toBeInTheDocument();
    });

    it("should render export button", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    it("should render view options", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      expect(screen.getByTestId("view-options")).toBeInTheDocument();
    });
  });

  describe("Filter Input", () => {
    it("should handle search input for chats", async () => {
      const user = userEvent.setup();

      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      const input = screen.getByPlaceholderText("Filter chats...");
      await user.clear(input);
      await user.type(input, "test search");

      expect(mockTable.getColumn).toHaveBeenCalledWith("title");
      // Check that the final value was set correctly
      const calls = mockColumn.setFilterValue.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe("test search");
    });

    it("should handle search input for attempts", async () => {
      const user = userEvent.setup();

      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="attempts"
        />,
      );

      const input = screen.getByPlaceholderText("Filter simulations...");
      await user.clear(input);
      await user.type(input, "simulation search");

      expect(mockTable.getColumn).toHaveBeenCalledWith("simulationTitle");
      // Check that the final value was set correctly
      const calls = mockColumn.setFilterValue.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe("simulation search");
    });

    it("should display current filter value", () => {
      const tableWithFilter = {
        ...mockTable,
        getColumn: vi.fn(() => ({
          ...mockColumn,
          getFilterValue: vi.fn(() => "existing filter"),
        })),
      };

      render(
        <DataTableToolbar
          table={tableWithFilter as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      const input = screen.getByDisplayValue("existing filter");
      expect(input).toBeInTheDocument();
    });
  });

  describe("Faceted Filters", () => {
    it("should render user filter for chats mode", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      expect(screen.getByTestId("faceted-filter-name")).toBeInTheDocument();
    });

    it("should render user filter for attempts mode", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="attempts"
        />,
      );

      expect(screen.getByTestId("faceted-filter-name")).toBeInTheDocument();
    });

    it("should render class filter with correct column for chats", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      expect(mockTable.getColumn).toHaveBeenCalledWith("classId");
    });

    it("should render class filter with correct column for attempts", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="attempts"
        />,
      );

      expect(mockTable.getColumn).toHaveBeenCalledWith("classCode");
    });

    it("should render score filter for chats mode", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="chats"
        />,
      );

      expect(screen.getByTestId("faceted-filter-score")).toBeInTheDocument();
    });

    it("should not render score filter for attempts mode", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          viewMode="attempts"
        />,
      );

      expect(
        screen.queryByTestId("faceted-filter-score"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Reset Filters", () => {
    it("should show reset button when filters are active", () => {
      const tableWithFilters = {
        ...mockTable,
        getState: vi.fn(() => ({
          columnFilters: [
            { id: "userId", value: "user1" },
            { id: "classId", value: "class1" },
          ],
        })),
      };

      render(
        <DataTableToolbar
          table={tableWithFilters as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      expect(screen.getByText("Reset")).toBeInTheDocument();
    });

    it("should not show reset button when no filters are active", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      expect(screen.queryByText("Reset")).not.toBeInTheDocument();
    });

    it("should ignore date filter when determining if filters are active", () => {
      const tableWithDateFilter = {
        ...mockTable,
        getState: vi.fn(() => ({
          columnFilters: [{ id: "createdAt", value: [new Date(), new Date()] }],
        })),
      };

      render(
        <DataTableToolbar
          table={tableWithDateFilter as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      expect(screen.queryByText("Reset")).not.toBeInTheDocument();
    });

    it("should reset filters when reset button is clicked", async () => {
      const user = userEvent.setup();
      const tableWithFilters = {
        ...mockTable,
        getState: vi.fn(() => ({
          columnFilters: [{ id: "userId", value: "user1" }],
        })),
      };

      render(
        <DataTableToolbar
          table={tableWithFilters as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      const resetButton = screen.getByText("Reset");
      await user.click(resetButton);

      expect(mockTable.resetColumnFilters).toHaveBeenCalled();
    });
  });

  describe("Date Picker", () => {
    it("should render date picker when setDateRange is provided", () => {
      const mockSetDateRange = vi.fn();

      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          setDateRange={mockSetDateRange}
        />,
      );

      expect(screen.getByTestId("date-picker")).toBeInTheDocument();
    });

    it("should not render date picker when setDateRange is not provided", () => {
      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
        />,
      );

      expect(screen.queryByTestId("date-picker")).not.toBeInTheDocument();
    });
  });

  describe("Props Handling", () => {
    it("should pass correct props to child components", () => {
      const mockSetDateRange = vi.fn();
      const mockDateRange = { from: new Date(), to: new Date() };

      render(
        <DataTableToolbar
          table={mockTable as any}
          userOptions={mockUserOptions}
          classOptions={mockClassOptions}
          isAdmin={true}
          dateRange={mockDateRange}
          setDateRange={mockSetDateRange}
          viewMode="attempts"
        />,
      );

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
      expect(screen.getByTestId("view-options")).toBeInTheDocument();
      expect(screen.getByTestId("date-picker")).toBeInTheDocument();
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
 * render(<data-table-toolbar />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<data-table-toolbar {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
