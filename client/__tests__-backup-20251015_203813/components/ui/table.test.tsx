import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Table", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <Table>
          <TableCaption>Test Table</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Header 1</TableHead>
              <TableHead>Header 2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell 1</TableCell>
              <TableCell>Cell 2</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Test Table")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Accessible Header</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Accessible Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render table with headers and cells", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Item 1</TableCell>
              <TableCell>Value 1</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Item 2</TableCell>
              <TableCell>Value 2</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Value")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Value 1")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal table
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Minimal</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
    });
  });
});
