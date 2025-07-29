import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Select", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      expect(screen.getByText("Select an option")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <Select>
          <SelectTrigger aria-label="Test Select">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Accessible Option</SelectItem>
          </SelectContent>
        </Select>,
      );

      const trigger = screen.getByRole("combobox", { name: "Test Select" });
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render select with trigger and options", () => {
      renderWithMocks(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="item1">Item 1</SelectItem>
            <SelectItem value="item2">Item 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      expect(screen.getByText("Choose...")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal select
      renderWithMocks(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent />
        </Select>,
      );

      const trigger = document.querySelector('[data-slot="select-trigger"]');
      expect(trigger).toBeInTheDocument();
    });
  });
});
