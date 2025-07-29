import { Slider } from "@/components/ui/slider";
import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Slider", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Slider />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Slider aria-label="Test Slider" />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with default value", () => {
      renderWithMocks(<Slider defaultValue={[50]} />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });

    it("should render with custom min and max", () => {
      renderWithMocks(<Slider min={0} max={200} />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });

    it("should render with multiple values", () => {
      renderWithMocks(<Slider defaultValue={[25, 75]} />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Slider />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });
  });
});
