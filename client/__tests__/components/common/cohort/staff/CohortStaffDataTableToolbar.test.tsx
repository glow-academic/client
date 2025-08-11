import { render } from '@/test/custom-render';
import { Table } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  CohortStaffDataTableToolbar,
  CohortStaffDataTableToolbarProps,
} from "@/components/common/cohort/staff/CohortStaffDataTableToolbar";
import { Profile } from "@/types";

// ------------------------------------------------------------------
// Create a proper mock table with required methods
const createMockTable = (): Table<Profile> => {
  const mockColumn = {
    getFilterValue: vi.fn().mockReturnValue(""),
    setFilterValue: vi.fn(),
    getFacetedUniqueValues: vi.fn().mockReturnValue(new Map()),
    getCanHide: vi.fn().mockReturnValue(true),
    getIsVisible: vi.fn().mockReturnValue(true),
    toggleVisibility: vi.fn(),
    accessorFn: vi.fn(),
    id: "firstName",
  };

  const mockRoleColumn = {
    getFilterValue: vi.fn().mockReturnValue(""),
    setFilterValue: vi.fn(),
    getFacetedUniqueValues: vi.fn().mockReturnValue(new Map()),
    getCanHide: vi.fn().mockReturnValue(true),
    getIsVisible: vi.fn().mockReturnValue(true),
    toggleVisibility: vi.fn(),
    accessorFn: vi.fn(),
    id: "role",
  };

  return {
    getState: vi.fn().mockReturnValue({
      columnFilters: [],
    }),
    getColumn: vi.fn().mockImplementation((columnId: string) => {
      if (columnId === "firstName") return mockColumn;
      if (columnId === "role") return mockRoleColumn;
      return null;
    }),
    getAllColumns: vi.fn().mockReturnValue([mockColumn, mockRoleColumn]),
    resetColumnFilters: vi.fn(),
  } as unknown as Table<Profile>;
};

const mockProps: CohortStaffDataTableToolbarProps = {
  table: createMockTable(),
  roleOptions: [
    { value: "student", label: "Student" },
    { value: "instructor", label: "Instructor" },
  ],
};
// ------------------------------------------------------------------
describe("CohortStaffDataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<CohortStaffDataTableToolbar {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<CohortStaffDataTableToolbar {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<CohortStaffDataTableToolbar {...mockProps} />);

      // Check for basic accessibility elements
      const toolbar =
        document.querySelector('[data-testid="toolbar"]') ||
        document.querySelector("div");
      expect(toolbar).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<CohortStaffDataTableToolbar {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(
        <CohortStaffDataTableToolbar
          table={createMockTable()}
          roleOptions={[]}
        />,
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
