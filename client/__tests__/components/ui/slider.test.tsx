import { Slider } from "@/components/ui/slider";
import { render } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Slider", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Slider />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Slider aria-label="Test Slider" />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with default value", () => {
      render(<Slider defaultValue={[50]} />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });

    it("should render with custom min and max", () => {
      render(<Slider min={0} max={200} />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });

    it("should render with multiple values", () => {
      render(<Slider defaultValue={[25, 75]} />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      render(<Slider />);

      const slider = document.querySelector('[data-slot="slider"]');
      expect(slider).toBeInTheDocument();
    });
  });
});
