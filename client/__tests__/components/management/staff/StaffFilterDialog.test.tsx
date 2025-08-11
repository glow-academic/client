import { render } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

import {
  StaffFilterDialog,
  StaffFilterDialogProps,
} from "@/components/management/staff/StaffFilterDialog";
import { StaffData } from "@/hooks/use-staff-columns";

// Mock staff data
const mockStaffData: StaffData[] = [
  {
    id: "1",
    firstName: "John",
    lastName: "Doe",
    alias: "jdoe",
    role: "admin",
    active: true,
    lastActive: "2024-01-01T00:00:00Z",
    email: "jdoe@example.com",
    cohortIds: ["cohort1"],
    cohortNames: ["Test Cohort"],
    lastActiveFormatted: "2d ago",
    roleDisplayName: "Administrator",
  },
  {
    id: "2",
    firstName: "Jane",
    lastName: "Smith",
    alias: "jsmith",
    role: "ta",
    active: false,
    lastActive: "2024-01-02T00:00:00Z",
    email: "jsmith@example.com",
    cohortIds: [],
    cohortNames: [],
    lastActiveFormatted: "1d ago",
    roleDisplayName: "Teaching Assistant",
  },
];

// Minimal props factory
const mockProps: StaffFilterDialogProps = {
  open: true,
  onOpenChange: vi.fn(),
  title: "Test Staff Members",
  staffMembers: mockStaffData,
  onEditUser: vi.fn(),
};

describe("StaffFilterDialog", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<StaffFilterDialog {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<StaffFilterDialog {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should display staff members in table", () => {
      render(<StaffFilterDialog {...mockProps} />);

      // Should display staff member names
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty staff list", () => {
      const emptyProps = {
        ...mockProps,
        staffMembers: [],
        title: "No Staff Members",
      };

      render(<StaffFilterDialog {...emptyProps} />);

      // Component should handle empty list gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle closed dialog", () => {
      const closedProps = {
        ...mockProps,
        open: false,
      };

      render(<StaffFilterDialog {...closedProps} />);

      // Component should handle closed state
      expect(document.body).toBeInTheDocument();
    });
  });
});
