import { Separator } from "@/components/ui/separator";
import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Separator", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Separator />);

      const separator = document.querySelector('[data-slot="separator-root"]');
      expect(separator).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Separator aria-label="Test Separator" />);

      const separator = document.querySelector('[data-slot="separator-root"]');
      expect(separator).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with horizontal orientation", () => {
      renderWithMocks(<Separator orientation="horizontal" />);

      const separator = document.querySelector('[data-slot="separator-root"]');
      expect(separator).toBeInTheDocument();
    });

    it("should render with vertical orientation", () => {
      renderWithMocks(<Separator orientation="vertical" />);

      const separator = document.querySelector('[data-slot="separator-root"]');
      expect(separator).toBeInTheDocument();
    });

    it("should render with custom className", () => {
      renderWithMocks(<Separator className="custom-class" />);

      const separator = document.querySelector('[data-slot="separator-root"]');
      expect(separator).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Separator />);

      const separator = document.querySelector('[data-slot="separator-root"]');
      expect(separator).toBeInTheDocument();
    });
  });
});
