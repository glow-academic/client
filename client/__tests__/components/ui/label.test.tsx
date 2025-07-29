import { Label } from "@/components/ui/label";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Label", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Label>Test Label</Label>);

      expect(screen.getByText("Test Label")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Label htmlFor="test-input">Accessible Label</Label>);

      const label = screen.getByText("Accessible Label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute("for", "test-input");
    });
  });

  describe("Component Props", () => {
    it("should render with htmlFor attribute", () => {
      renderWithMocks(<Label htmlFor="input-id">Form Label</Label>);

      const label = screen.getByText("Form Label");
      expect(label).toHaveAttribute("for", "input-id");
    });

    it("should render with custom className", () => {
      renderWithMocks(<Label className="custom-class">Custom Label</Label>);

      const label = screen.getByText("Custom Label");
      expect(label).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty content
      renderWithMocks(<Label></Label>);

      const label = document.querySelector('[data-slot="label"]');
      expect(label).toBeInTheDocument();
    });
  });
});
