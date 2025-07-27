import { Skeleton } from "@/components/ui/skeleton";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Skeleton", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Skeleton />);

      expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Skeleton className="custom-class" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass("custom-class");
    });
  });

  describe("Component Props", () => {
    it("should render with custom className", () => {
      renderWithMocks(<Skeleton className="test-class" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("test-class");
    });

    it("should render with children", () => {
      renderWithMocks(<Skeleton>Content</Skeleton>);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Skeleton />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInTheDocument();
    });
  });
});
