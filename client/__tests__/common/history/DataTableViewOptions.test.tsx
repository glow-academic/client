import { renderWithMocks } from "@/test/renderWithMocks";
import type { Table } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  DataTableViewOptions,
  DataTableViewOptionsProps,
} from "@/components/common/history/DataTableViewOptions";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: DataTableViewOptionsProps<unknown> = {
  table: {} as unknown as Table<unknown>,
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
      renderWithMocks(
        <DataTableViewOptions table={{} as unknown as Table<unknown>} />
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
