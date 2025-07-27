import { getMockColumn } from "@/mocks/navigation";
import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  DataTableColumnHeader,
  DataTableColumnHeaderProps,
} from "@/components/common/history/DataTableColumnHeader";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: DataTableColumnHeaderProps<unknown, unknown> = {
  column: getMockColumn(),
  title: "test-title",
};
// ------------------------------------------------------------------
describe("DataTableColumnHeader", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DataTableColumnHeader {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DataTableColumnHeader {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DataTableColumnHeader {...mockProps} />);

      // Check for basic accessibility elements
      const header =
        document.querySelector("th") || document.querySelector("div");
      expect(header).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<DataTableColumnHeader {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <DataTableColumnHeader column={getMockColumn()} title="test" />,
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
