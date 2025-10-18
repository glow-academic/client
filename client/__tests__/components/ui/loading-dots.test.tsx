import { LoadingDots } from "@/components/ui/loading-dots";
import { render } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("LoadingDots", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<LoadingDots />);

      // LoadingDots should render three dots
      const dots = document.querySelectorAll(
        ".w-2.h-2.bg-current.rounded-full.animate-pulse",
      );
      expect(dots).toHaveLength(3);
    });

    it("should have correct structure", () => {
      render(<LoadingDots />);

      const container = document.querySelector(".flex.space-x-1");
      expect(container).toBeInTheDocument();

      const dots = document.querySelectorAll(
        ".w-2.h-2.bg-current.rounded-full.animate-pulse",
      );
      expect(dots).toHaveLength(3);
    });
  });

  describe("Component Structure", () => {
    it("should render three animated dots", () => {
      render(<LoadingDots />);

      const dots = document.querySelectorAll(
        ".w-2.h-2.bg-current.rounded-full.animate-pulse",
      );
      expect(dots).toHaveLength(3);

      // Check that each dot has the correct styling
      dots.forEach((dot, index) => {
        expect(dot).toHaveStyle({ animationDelay: `${index * 0.2}s` });
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props (no props)
      render(<LoadingDots />);

      const container = document.querySelector(".flex.space-x-1");
      expect(container).toBeInTheDocument();
    });
  });
});
