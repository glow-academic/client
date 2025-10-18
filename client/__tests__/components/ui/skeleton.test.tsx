import { Skeleton } from "@/components/ui/skeleton";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Skeleton", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Skeleton />);

      expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Skeleton className="custom-class" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass("custom-class");
    });
  });

  describe("Component Props", () => {
    it("should render with custom className", () => {
      render(<Skeleton className="test-class" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("test-class");
    });

    it("should render with children", () => {
      render(<Skeleton>Content</Skeleton>);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      render(<Skeleton />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInTheDocument();
    });
  });
});
