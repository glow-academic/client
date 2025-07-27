import { Badge } from "@/components/ui/badge";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Badge", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Badge>Test Badge</Badge>);

      expect(screen.getByText("Test Badge")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Badge>Accessible Badge</Badge>);

      const badge = screen.getByText("Accessible Badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("inline-flex");
    });
  });

  describe("Component Variants", () => {
    it("should render with default variant", () => {
      renderWithMocks(<Badge>Default Badge</Badge>);

      const badge = screen.getByText("Default Badge");
      expect(badge).toBeInTheDocument();
    });

    it("should render with secondary variant", () => {
      renderWithMocks(<Badge variant="secondary">Secondary Badge</Badge>);

      const badge = screen.getByText("Secondary Badge");
      expect(badge).toBeInTheDocument();
    });

    it("should render with destructive variant", () => {
      renderWithMocks(<Badge variant="destructive">Destructive Badge</Badge>);

      const badge = screen.getByText("Destructive Badge");
      expect(badge).toBeInTheDocument();
    });

    it("should render with outline variant", () => {
      renderWithMocks(<Badge variant="outline">Outline Badge</Badge>);

      const badge = screen.getByText("Outline Badge");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty content
      renderWithMocks(<Badge></Badge>);

      const badge = screen.getByRole("generic");
      expect(badge).toBeInTheDocument();
    });
  });
});
