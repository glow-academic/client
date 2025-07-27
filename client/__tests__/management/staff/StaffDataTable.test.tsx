import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  StaffDataTable,
  StaffDataTableProps,
} from "@/components/management/staff/StaffDataTable";
import { useStaffColumns } from "@/hooks/use-staff-columns";

// Import mocks
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the useStaffColumns hook
vi.mock("@/hooks/use-staff-columns", () => ({
  useStaffColumns: vi.fn(),
}));

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
// Remove unused mockTable

const mockColumns = [
  {
    accessorKey: "firstName",
    header: "Staff Member",
    cell: ({ row }: any) => (
      <div>
        {row.original.firstName} {row.original.lastName}
      </div>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }: any) => <div>{row.original.roleDisplayName}</div>,
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }: any) => <div>{row.original.email}</div>,
    enableSorting: true,
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }: any) => (
      <div>{row.original.active ? "Active" : "Inactive"}</div>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "lastActive",
    header: "Last Active",
    cell: ({ row }: any) => <div>{row.original.lastActiveFormatted}</div>,
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "cohortNames",
    header: "Cohorts",
    cell: ({ row }: any) => (
      <div>{row.original.cohortNames.join(", ") || "None"}</div>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "actions",
    header: "Actions",
    cell: () => <div>Edit</div>,
    enableSorting: false,
    enableColumnFilter: false,
  },
];

const mockProps: StaffDataTableProps = {
  columns: mockColumns,
  data: [
    {
      id: "staff-1",
      firstName: "John",
      lastName: "Doe",
      alias: "john-doe",
      role: "admin",
      active: true,
      lastActive: new Date().toISOString(),
      email: "john@example.com",
      cohortIds: [],
      cohortNames: [],
      lastActiveFormatted: "2 hours ago",
      roleDisplayName: "Administrator",
    },
  ],
  roleOptions: [
    { value: "admin", label: "Admin" },
    { value: "ta", label: "TA" },
    { value: "instructional", label: "Instructional" },
  ],
  cohortOptions: [
    { value: "cohort1", label: "Cohort 1" },
    { value: "cohort2", label: "Cohort 2" },
  ],
  activityOptions: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  lastActiveOptions: [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
  ],
  isRefreshing: false,
  onRefresh: vi.fn(),
};

// Mock the useStaffColumns hook implementation
const mockUseStaffColumns = useStaffColumns as any;
mockUseStaffColumns.mockReturnValue({
  columns: mockColumns,
  roleOptions: mockProps.roleOptions,
  cohortOptions: mockProps.cohortOptions,
  activityOptions: mockProps.activityOptions,
  lastActiveOptions: mockProps.lastActiveOptions,
});

// ------------------------------------------------------------------
describe("StaffDataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Should render the staff data table
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Should render with the provided options - check for role display names instead of option labels
      expect(screen.getByText("Administrator")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Table should be accessible
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Should have proper table structure with headers
      const headers = screen.getAllByRole("columnheader");
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle search input changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Look for search input
      const searchInput = screen.getByPlaceholderText(
        /search staff by name or alias/i
      );
      expect(searchInput).toBeInTheDocument();

      await user.type(searchInput, "test staff");
      expect(searchInput).toHaveValue("test staff");
    });

    it("should handle filter interactions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Click on one of the filter buttons (Role, Status, etc.)
      const roleButton = screen.getByRole("button", { name: "Role" });
      expect(roleButton).toBeInTheDocument();
      await user.click(roleButton);
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty options
      const emptyProps: StaffDataTableProps = {
        columns: [],
        data: [],
        roleOptions: [],
        cohortOptions: [],
        activityOptions: [],
        lastActiveOptions: [],
        isRefreshing: false,
        onRefresh: vi.fn(),
      };

      renderWithMocks(<StaffDataTable {...emptyProps} />);

      // Should still render the table
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps = {
        columns: [],
        data: [],
        roleOptions: [],
        cohortOptions: [],
        activityOptions: [],
        lastActiveOptions: [],
        isRefreshing: false,
        onRefresh: vi.fn(),
      };

      renderWithMocks(<StaffDataTable {...minimalProps} />);

      // Should still render without crashing
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});
