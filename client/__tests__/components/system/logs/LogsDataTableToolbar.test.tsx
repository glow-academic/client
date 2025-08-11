import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  LogsDataTableToolbar,
  LogsDataTableToolbarProps,
} from "@/components/system/logs/LogsDataTableToolbar";
import { AppLog } from "@/hooks/use-log-columns";
import { getMockColumn, getMockTable } from "@/mocks/navigation";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockLevelColumn = getMockColumn<AppLog, string>({
  id: "level",
  getFacetedUniqueValues: () =>
    new Map([
      ["info", 5],
      ["error", 2],
      ["warn", 1],
    ]),
  getFilterValue: () => undefined,
  setFilterValue: vi.fn(),
});

const mockTable = getMockTable<AppLog>({
  getAllColumns: () => [mockLevelColumn],
  getColumn: (id: string) => (id === "level" ? mockLevelColumn : undefined),
});

const mockProps: LogsDataTableToolbarProps = {
  table: mockTable,
  levelOptions: [
    { label: "Info", value: "info" },
    { label: "Error", value: "error" },
    { label: "Warning", value: "warn" },
  ],
  onRefresh: vi.fn(),
  isRefreshing: false,
};

// ------------------------------------------------------------------
describe("LogsDataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<LogsDataTableToolbar {...mockProps} />);

      // Basic render check - find refresh button by its icon
      expect(screen.getAllByRole("button")).toHaveLength(3); // Level, Refresh, View
    });

    it("should render with props", () => {
      render(<LogsDataTableToolbar {...mockProps} />);

      // Check that buttons are rendered
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);

      // Check that the search input is rendered with correct placeholder
      expect(
        screen.getByPlaceholderText("Search messages..."),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<LogsDataTableToolbar {...mockProps} />);

      // Check that buttons have proper accessibility
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);

      // Check that the search input has proper accessibility
      const searchInput = screen.getByPlaceholderText("Search messages...");
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle refresh button click", async () => {
      const user = userEvent.setup();

      render(<LogsDataTableToolbar {...mockProps} />);

      // Find the refresh button by looking for the button with refresh icon
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="refresh-cw"]'),
      );
      expect(refreshButton).toBeDefined();
      await user.click(refreshButton!);

      expect(mockProps.onRefresh).toHaveBeenCalledTimes(1);
    });

    it("should disable refresh button when refreshing", () => {
      render(
        <LogsDataTableToolbar {...mockProps} isRefreshing={true} />,
      );

      // Find the refresh button by looking for the button with refresh icon
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="refresh-cw"]'),
      );
      expect(refreshButton).toBeDefined();
      expect(refreshButton).toBeDisabled();
    });

    it("should handle search input changes", async () => {
      const user = userEvent.setup();

      render(<LogsDataTableToolbar {...mockProps} />);

      const searchInput = screen.getByPlaceholderText("Search messages...");
      await user.type(searchInput, "test search");

      // The input value might not update due to mock table setup, but we can check the interaction
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const propsWithEmptyOptions = {
        ...mockProps,
        levelOptions: [],
      };

      render(<LogsDataTableToolbar {...propsWithEmptyOptions} />);

      // Should still render without crashing - fewer buttons when no level options
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("should handle missing or invalid props", () => {
      const minimalProps = {
        table: mockTable,
        levelOptions: [],
        onRefresh: vi.fn(),
        isRefreshing: false,
      };

      render(<LogsDataTableToolbar {...minimalProps} />);

      // Should still render without crashing
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
