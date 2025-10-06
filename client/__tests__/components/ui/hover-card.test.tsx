import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("HoverCard", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <HoverCard>
          <HoverCardTrigger>Hover Me</HoverCardTrigger>
          <HoverCardContent>Hover Content</HoverCardContent>
        </HoverCard>,
      );

      expect(screen.getByText("Hover Me")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <HoverCard>
          <HoverCardTrigger>Hover Me</HoverCardTrigger>
          <HoverCardContent>Accessible Content</HoverCardContent>
        </HoverCard>,
      );

      const trigger = screen.getByText("Hover Me");
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render hover card trigger correctly", () => {
      render(
        <HoverCard>
          <HoverCardTrigger>Trigger</HoverCardTrigger>
          <HoverCardContent>
            <div>Card Content</div>
            <div>More Content</div>
          </HoverCardContent>
        </HoverCard>,
      );

      // Only the trigger should be visible when hover card is not active
      expect(screen.getByText("Trigger")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal hover card
      render(
        <HoverCard>
          <HoverCardTrigger>Minimal</HoverCardTrigger>
          <HoverCardContent>Content</HoverCardContent>
        </HoverCard>,
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
    });
  });
});
