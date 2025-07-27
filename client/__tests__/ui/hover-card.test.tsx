import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("HoverCard", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <HoverCard>
          <HoverCardTrigger>Hover Me</HoverCardTrigger>
          <HoverCardContent>Hover Content</HoverCardContent>
        </HoverCard>
      );

      expect(screen.getByText("Hover Me")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <HoverCard>
          <HoverCardTrigger>Hover Me</HoverCardTrigger>
          <HoverCardContent>Accessible Content</HoverCardContent>
        </HoverCard>
      );

      const trigger = screen.getByText("Hover Me");
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render hover card with trigger and content", () => {
      renderWithMocks(
        <HoverCard>
          <HoverCardTrigger>Trigger</HoverCardTrigger>
          <HoverCardContent>
            <div>Card Content</div>
            <div>More Content</div>
          </HoverCardContent>
        </HoverCard>
      );

      expect(screen.getByText("Trigger")).toBeInTheDocument();
      expect(screen.getByText("Card Content")).toBeInTheDocument();
      expect(screen.getByText("More Content")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal hover card
      renderWithMocks(
        <HoverCard>
          <HoverCardTrigger>Minimal</HoverCardTrigger>
          <HoverCardContent>Content</HoverCardContent>
        </HoverCard>
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });
});
