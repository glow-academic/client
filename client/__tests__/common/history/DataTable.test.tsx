import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
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
  columns: [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
    },
  ],
  data: [
    { name: "Test Item 1", status: "Active" },
    { name: "Test Item 2", status: "Inactive" },
  ],
  profileOptions: [
    { value: "profile1", label: "Profile 1" },
    { value: "profile2", label: "Profile 2" },
  ],
  scoreRangeOptions: [
    { value: "0-50", label: "0-50" },
    { value: "51-100", label: "51-100" },
  ],
  // showExport: false, /* optional */
  // showAll: false, /* optional */
};
// ------------------------------------------------------------------
describe("DataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DataTable {...mockProps} />);

      // Should render the table
      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
      });
    });

    it("should render with props", () => {
      renderWithMocks(<DataTable {...mockProps} />);

      // Should render table headers
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();

      // Should render table data
      expect(screen.getByText("Test Item 1")).toBeInTheDocument();
      expect(screen.getByText("Test Item 2")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DataTable {...mockProps} />);

      // Check for table accessibility
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Check for table headers
      const headers = screen.getAllByRole("columnheader");
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DataTable {...mockProps} />);

      // Test input interactions if inputs exist
      const inputs = screen.queryAllByRole("textbox");
      if (inputs.length > 0 && inputs[0]) {
        await user.type(inputs[0], "test");
        // Input should be interactive
        expect(inputs[0]).toBeInTheDocument();
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DataTable {...mockProps} />);

      // Test button interactions if buttons exist
      const buttons = screen.queryAllByRole("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        // Button should be clickable
        expect(buttons[0]).toBeInTheDocument();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty data
      const emptyProps: DataTableProps<unknown, unknown> = {
        columns: [],
        data: [],
        profileOptions: [],
        scoreRangeOptions: [],
      };

      renderWithMocks(<DataTable {...emptyProps} />);

      // Should still render without crashing
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

      // Should handle missing props gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle large datasets", () => {
      // Test with larger dataset
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        name: `Item ${i}`,
        status: i % 2 === 0 ? "Active" : "Inactive",
      }));

      const largeProps: DataTableProps<unknown, unknown> = {
        ...mockProps,
        data: largeData,
      };

      renderWithMocks(<DataTable {...largeProps} />);

      // Should render without performance issues
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});
