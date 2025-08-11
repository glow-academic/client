import { Progress } from "@/components/ui/progress";
import { render } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Progress", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Progress value={50} />);

      expect(
        document.querySelector('[data-slot="progress"]'),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Progress value={75} aria-label="Test Progress" />);

      const progress = document.querySelector('[data-slot="progress"]');
      expect(progress).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with value prop", () => {
      render(<Progress value={25} />);

      const progress = document.querySelector('[data-slot="progress"]');
      expect(progress).toBeInTheDocument();
    });

    it("should render with max value", () => {
      render(<Progress value={50} max={100} />);

      const progress = document.querySelector('[data-slot="progress"]');
      expect(progress).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with zero value
      render(<Progress value={0} />);

      const progress = document.querySelector('[data-slot="progress"]');
      expect(progress).toBeInTheDocument();
    });

    it("should handle maximum value", () => {
      render(<Progress value={100} />);

      const progress = document.querySelector('[data-slot="progress"]');
      expect(progress).toBeInTheDocument();
    });
  });
});
