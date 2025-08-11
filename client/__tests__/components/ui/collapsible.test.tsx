import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Collapsible", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>,
      );

      expect(screen.getByText("Toggle")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Accessible Trigger</CollapsibleTrigger>
          <CollapsibleContent>Accessible Content</CollapsibleContent>
        </Collapsible>,
      );

      const trigger = screen.getByText("Accessible Trigger");
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render collapsible with trigger and content", () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Trigger</CollapsibleTrigger>
          <CollapsibleContent>
            <div>Content</div>
            <div>More Content</div>
          </CollapsibleContent>
        </Collapsible>,
      );

      expect(screen.getByText("Trigger")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal collapsible
      render(
        <Collapsible>
          <CollapsibleTrigger>Minimal</CollapsibleTrigger>
          <CollapsibleContent>Content</CollapsibleContent>
        </Collapsible>,
      );

      expect(screen.getByText("Minimal")).toBeInTheDocument();
    });
  });
});
