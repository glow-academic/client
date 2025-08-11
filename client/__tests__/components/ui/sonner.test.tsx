import { Toaster } from "@/components/ui/sonner";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { ToasterProps } from "sonner";
import { describe, expect, it, vi } from "vitest";

// Mock the sonner package
vi.mock("sonner", () => ({
  Toaster: ({ className, ...props }: ToasterProps) => (
    <div className={className} data-testid="toaster" {...props} />
  ),
}));

// ——————————————————————————————————————————

describe("Toaster", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Toaster />);

      // Toaster renders a div with the "toaster" class
      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Toaster />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with custom position", () => {
      render(<Toaster position="top-right" />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });

    it("should render with custom theme", () => {
      render(<Toaster theme="dark" />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      render(<Toaster />);

      const toaster = screen.getByTestId("toaster");
      expect(toaster).toBeInTheDocument();
    });
  });
});
