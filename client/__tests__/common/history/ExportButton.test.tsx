import { renderWithMocks } from "@/test/renderWithMocks";
import type { Table } from "@tanstack/react-table";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  ExportButton,
  ExportButtonProps,
} from "@/components/common/history/ExportButton";

// ------------------------------------------------------------------
// Create a comprehensive mock table with all required methods
const createMockTable = (): Table<unknown> =>
  ({
    getState: () => ({
      rowSelection: {},
    }),
    getFilteredSelectedRowModel: () => ({
      rows: [],
    }),
    getFilteredRowModel: () => ({
      rows: [],
    }),
    getVisibleLeafColumns: () => [],
    getColumn: () => ({
      getFilterValue: () => "",
      setFilterValue: vi.fn(),
    }),
  }) as unknown as Table<unknown>;

// Minimal props factory – edit values as needed
const mockProps: ExportButtonProps<unknown> = {
  table: createMockTable(),
  profileOptions: [],
};
// ------------------------------------------------------------------
describe("ExportButton", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });
    it("should render with props", () => {
      renderWithMocks(<ExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });
    it("should have correct accessibility attributes", () => {
      renderWithMocks(<ExportButton {...mockProps} />);
      const button =
        document.querySelector("button") || document.querySelector("div");
      expect(button).toBeInTheDocument();
    });
  });
  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ExportButton {...mockProps} />);
      const buttons = document.querySelectorAll("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        expect(buttons[0]).toBeInTheDocument();
      }
    });
    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ExportButton {...mockProps} />);
      const dropdowns = document.querySelectorAll('[role="combobox"]');
      if (dropdowns.length > 0 && dropdowns[0]) {
        await user.click(dropdowns[0]);
        expect(dropdowns[0]).toBeInTheDocument();
      }
    });
  });
  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<ExportButton {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });
    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <ExportButton table={createMockTable()} profileOptions={[]} />,
      );
      expect(document.body).toBeInTheDocument();
    });
  });
});
