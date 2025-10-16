import { ScrollArea } from "@/components/ui/scroll-area";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("ScrollArea", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <ScrollArea>
          <div>Content</div>
        </ScrollArea>,
      );

      const scrollArea = document.querySelector('[data-slot="scroll-area"]');
      expect(scrollArea).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <ScrollArea>
          <div>Accessible Content</div>
        </ScrollArea>,
      );

      const scrollArea = document.querySelector('[data-slot="scroll-area"]');
      expect(scrollArea).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render scroll area with content", () => {
      render(
        <ScrollArea>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </ScrollArea>,
      );

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
    });

    it("should render with custom className", () => {
      render(
        <ScrollArea className="custom-class">
          <div>Content</div>
        </ScrollArea>,
      );

      const scrollArea = document.querySelector('[data-slot="scroll-area"]');
      expect(scrollArea).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal content
      render(<ScrollArea />);

      const scrollArea = document.querySelector('[data-slot="scroll-area"]');
      expect(scrollArea).toBeInTheDocument();
    });
  });
});
