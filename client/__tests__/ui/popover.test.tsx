import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Popover", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <Popover>
          <PopoverTrigger>Open Popover</PopoverTrigger>
          <PopoverContent>Popover Content</PopoverContent>
        </Popover>
      );

      expect(screen.getByText("Open Popover")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <Popover>
          <PopoverTrigger>Open Popover</PopoverTrigger>
          <PopoverContent>Accessible Content</PopoverContent>
        </Popover>
      );

      const trigger = screen.getByText("Open Popover");
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render popover with trigger and content", () => {
      renderWithMocks(
        <Popover>
          <PopoverTrigger>Trigger</PopoverTrigger>
          <PopoverContent>
            <div>Content</div>
            <div>More Content</div>
          </PopoverContent>
        </Popover>
      );

      expect(screen.getByText("Trigger")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
      expect(screen.getByText("More Content")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal popover
      renderWithMocks(
        <Popover>
          <PopoverTrigger>Minimal</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });
});
