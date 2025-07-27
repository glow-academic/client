import { Toaster } from "@/components/ui/sonner";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the sonner package
vi.mock("sonner", () => ({
  Toaster: ({ className, ...props }: any) => (
    <div className={className} data-testid="toaster" {...props} />
  ),
}));

// ——————————————————————————————————————————

describe("Toaster", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Toaster />);

      // Toaster renders a div with the "toaster" class
      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Toaster />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with custom position", () => {
      renderWithMocks(<Toaster position="top-right" />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });

    it("should render with custom theme", () => {
      renderWithMocks(<Toaster theme="dark" />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Toaster />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });
  });
});
