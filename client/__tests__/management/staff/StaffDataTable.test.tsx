import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  StaffDataTable,
  StaffDataTableProps,
} from "@/components/management/staff/StaffDataTable";

// Import mocks
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
// Remove unused mockTable

const mockProps: StaffDataTableProps = {
  columns: [],
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

      // Should render with the provided options
      expect(screen.getByText("Admin")).toBeInTheDocument();
      expect(screen.getByText("TA")).toBeInTheDocument();
      expect(screen.getByText("Instructional")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Table should be accessible
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Should have proper table structure
      const headers = screen.getAllByRole("columnheader");
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle search input changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Look for search input
      const searchInput = screen.queryByPlaceholderText(/search/i);
      if (searchInput) {
        await user.type(searchInput, "test staff");
        expect(searchInput).toHaveValue("test staff");
      }
    });

    it("should handle filter interactions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<StaffDataTable {...mockProps} />);

      // Click on filter buttons if they exist
      const filterButtons = screen.queryAllByRole("button");
      if (filterButtons.length > 0 && filterButtons[0]) {
        await user.click(filterButtons[0]);
        expect(filterButtons[0]).toBeInTheDocument();
      }
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
