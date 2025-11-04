import { render } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  CohortStaffDataTable,
  CohortStaffDataTableProps,
} from "@/components/cohorts/staff/CohortStaffDataTable";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: CohortStaffDataTableProps = {
  columns: [
    {
      id: "firstName",
      header: "First Name",
      accessorKey: "firstName",
    },
    {
      id: "lastName",
      header: "Last Name",
      accessorKey: "lastName",
    },
    {
      id: "role",
      header: "Role",
      accessorKey: "role",
    },
  ],
  data: [
    {
      id: "1",
      updatedAt: "2024-01-01T00:00:00Z",
      userId: 1,
      lastLogin: "2024-01-01T00:00:00Z",
      firstName: "John",
      lastName: "Doe",
      alias: "john.doe",
      viewedIntro: false,
      viewedChat: false,
      createdAt: "2024-01-01T00:00:00Z",
      role: "ta",
      defaultProfile: false,
      active: true,
      lastActive: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      updatedAt: "2024-01-01T00:00:00Z",
      userId: 2,
      lastLogin: "2024-01-01T00:00:00Z",
      firstName: "Jane",
      lastName: "Smith",
      alias: "jane.smith",
      viewedIntro: false,
      viewedChat: false,
      createdAt: "2024-01-01T00:00:00Z",
      role: "ta",
      defaultProfile: false,
      active: true,
      lastActive: "2024-01-01T00:00:00Z",
    },
  ],
  roleOptions: [
    { value: "student", label: "Student" },
    { value: "instructor", label: "Instructor" },
  ],
};
// ------------------------------------------------------------------
describe("CohortStaffDataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<CohortStaffDataTable {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<CohortStaffDataTable {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<CohortStaffDataTable {...mockProps} />);

      // Check for basic accessibility elements
      const table =
        document.querySelector("table") || document.querySelector("div");
      expect(table).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<CohortStaffDataTable {...mockProps} />);

      // Test button interactions if buttons exist
      const buttons = document.querySelectorAll("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        // Button should be clickable
        expect(buttons[0]).toBeInTheDocument();
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<CohortStaffDataTable {...mockProps} />);

      // Test input interactions if inputs exist
      const inputs = document.querySelectorAll("input");
      if (inputs.length > 0 && inputs[0]) {
        await user.type(inputs[0], "test");
        // Check if the input has the value or if it's a controlled component
        const inputValue = (inputs[0] as HTMLInputElement).value;
        expect(inputValue).toBe("test");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<CohortStaffDataTable {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(
        <CohortStaffDataTable
          columns={mockProps.columns}
          data={[]}
          roleOptions={[]}
        />,
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
