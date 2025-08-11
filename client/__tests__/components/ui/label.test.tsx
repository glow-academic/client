import { Label } from "@/components/ui/label";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Label", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Label>Test Label</Label>);

      expect(screen.getByText("Test Label")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Label htmlFor="test-input">Accessible Label</Label>);

      const label = screen.getByText("Accessible Label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute("for", "test-input");
    });
  });

  describe("Component Props", () => {
    it("should render with htmlFor attribute", () => {
      render(<Label htmlFor="input-id">Form Label</Label>);

      const label = screen.getByText("Form Label");
      expect(label).toHaveAttribute("for", "input-id");
    });

    it("should render with custom className", () => {
      render(<Label className="custom-class">Custom Label</Label>);

      const label = screen.getByText("Custom Label");
      expect(label).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty content
      render(<Label></Label>);

      const label = document.querySelector('[data-slot="label"]');
      expect(label).toBeInTheDocument();
    });
  });
});
