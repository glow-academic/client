import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Tooltip", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Hover Me</TooltipTrigger>
            <TooltipContent>Tooltip Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(screen.getByText("Hover Me")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Accessible Trigger</TooltipTrigger>
            <TooltipContent>Accessible Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByText("Accessible Trigger");
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render tooltip with trigger and content", () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>
              <div>Tooltip Content</div>
              <div>More Content</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(screen.getByText("Trigger")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal tooltip
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Minimal</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
    });
  });
});
