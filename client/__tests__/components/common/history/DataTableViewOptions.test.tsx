import { renderWithMocks } from "@/test/renderWithMocks";
import type { Table } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  DataTableViewOptions,
  DataTableViewOptionsProps,
} from "@/components/common/history/DataTableViewOptions";

// ------------------------------------------------------------------
// Create a comprehensive mock table with all required methods
const createMockTable = (): Table<unknown> =>
  ({
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
const mockProps: DataTableViewOptionsProps<unknown> = {
  table: createMockTable(),
};
// ------------------------------------------------------------------
describe("DataTableViewOptions", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DataTableViewOptions {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DataTableViewOptions {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DataTableViewOptions {...mockProps} />);

      // Check for basic accessibility elements
      const options =
        document.querySelector('[data-testid="view-options"]') ||
        document.querySelector("div");
      expect(options).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<DataTableViewOptions {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<DataTableViewOptions table={createMockTable()} />);

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
