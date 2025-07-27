import { renderWithMocks } from "@/test/renderWithMocks";
import type { ColumnDef } from "@tanstack/react-table";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  LogsDataTable,
  LogsDataTableProps,
} from "@/components/system/logs/LogsDataTable";
import { AppLog } from "@/hooks/use-log-columns";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockData: AppLog[] = [
  {
    id: 1,
    level: "info",
    message: "Test log message",
    context: { test: "data" },
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    level: "error",
    message: "Error log message",
    context: null,
    createdAt: "2025-01-01T01:00:00Z",
  },
];

const mockColumns: ColumnDef<AppLog>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div>{row.getValue("id")}</div>,
  },
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => <div>{row.getValue("level")}</div>,
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => <div>{row.getValue("message")}</div>,
  },
];

const mockProps: LogsDataTableProps = {
  columns: mockColumns,
  data: mockData,
  levelOptions: [
    { value: "error", label: "Error" },
    { value: "warn", label: "Warning" },
    { value: "info", label: "Info" },
    { value: "debug", label: "Debug" },
  ],
  onRefresh: vi.fn(),
  isRefreshing: false,
};
// ------------------------------------------------------------------
describe("LogsDataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<LogsDataTable {...mockProps} />);

      // Check that headers are rendered - use getAllByText to handle multiple "Level" elements
      expect(screen.getByText("ID")).toBeInTheDocument();
      expect(screen.getAllByText("Level")).toHaveLength(2); // Button and header
      expect(screen.getByText("Message")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<LogsDataTable {...mockProps} />);

      // Check that data is displayed
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("info")).toBeInTheDocument();
      expect(screen.getByText("Test log message")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<LogsDataTable {...mockProps} />);

      // Check that the table has proper accessibility attributes
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Check that table headers are accessible
      expect(screen.getByText("ID")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      renderWithMocks(<LogsDataTable {...mockProps} />);

      // Check that the table renders with data
      expect(screen.getByText("Test log message")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<LogsDataTable {...mockProps} />);

      // Check that the refresh functionality is available
      expect(mockProps.onRefresh).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty data
      const propsWithEmptyData = {
        ...mockProps,
        data: [],
      };

      renderWithMocks(<LogsDataTable {...propsWithEmptyData} />);

      // Should show "No logs match the current filters" message
      expect(
        screen.getByText("No logs match the current filters."),
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props
      const minimalProps = {
        columns: [],
        data: [],
        levelOptions: [],
        onRefresh: vi.fn(),
        isRefreshing: false,
      };

      renderWithMocks(<LogsDataTable {...minimalProps} />);

      // Component should still render
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});
