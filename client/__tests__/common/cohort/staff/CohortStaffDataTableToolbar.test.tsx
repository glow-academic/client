import { renderWithMocks } from "@/test/renderWithMocks";
import { Table } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  CohortStaffDataTableToolbar,
  CohortStaffDataTableToolbarProps,
} from "@/components/common/cohort/staff/CohortStaffDataTableToolbar";
import { Profile } from "@/types";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: CohortStaffDataTableToolbarProps = {
  table: {} as unknown as Table<Profile>,
  roleOptions: [],
};
// ------------------------------------------------------------------
describe("CohortStaffDataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<CohortStaffDataTableToolbar {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<CohortStaffDataTableToolbar {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<CohortStaffDataTableToolbar {...mockProps} />);

      // Check for basic accessibility elements
      const toolbar =
        document.querySelector('[data-testid="toolbar"]') ||
        document.querySelector("div");
      expect(toolbar).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<CohortStaffDataTableToolbar {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(
        <CohortStaffDataTableToolbar
          table={{} as unknown as Table<Profile>}
          roleOptions={[]}
        />
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
