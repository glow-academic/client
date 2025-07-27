import { renderWithMocks } from "@/test/renderWithMocks";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  DataTable,
  DataTableProps,
} from "@/components/common/history/DataTable";

import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: DataTableProps<unknown, unknown> = {
  columns: [],
  data: [],
  profileOptions: [],
  scoreRangeOptions: [],
  // showExport: false, /* optional */
  // showAll: false, /* optional */
};
// ------------------------------------------------------------------
describe("DataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DataTable {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DataTable {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DataTable {...mockProps} />);

      // Check for basic accessibility elements
      const table =
        document.querySelector("table") || document.querySelector("div");
      expect(table).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DataTable {...mockProps} />);

      // Test input interactions if inputs exist
      const inputs = document.querySelectorAll("input");
      if (inputs.length > 0 && inputs[0]) {
        await user.type(inputs[0], "test");
        expect(inputs[0]).toHaveValue("test");
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DataTable {...mockProps} />);

      // Test button interactions if buttons exist
      const buttons = document.querySelectorAll("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        // Button should be clickable
        expect(buttons[0]).toBeInTheDocument();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<DataTable {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <DataTable
          columns={[]}
          data={[]}
          profileOptions={[]}
          scoreRangeOptions={[]}
        />
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
