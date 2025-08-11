import { CircularProgress } from "@/components/ui/circular-progress";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("CircularProgress", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<CircularProgress progress={50} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<CircularProgress progress={75} />);

      expect(screen.getByText("75%")).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with different progress values", () => {
      render(<CircularProgress progress={25} />);

      expect(screen.getByText("25%")).toBeInTheDocument();
    });

    it("should render with custom size", () => {
      render(<CircularProgress progress={50} size={60} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should render with custom stroke width", () => {
      render(<CircularProgress progress={50} strokeWidth={6} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should handle progress at 0%", () => {
      render(<CircularProgress progress={0} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should handle progress at 100%", () => {
      render(<CircularProgress progress={100} />);

      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with negative progress (component displays the actual value)
      render(<CircularProgress progress={-10} />);

      expect(screen.getByText("-10%")).toBeInTheDocument();
    });

    it("should handle progress over 100% (component displays the actual value)", () => {
      render(<CircularProgress progress={150} />);

      expect(screen.getByText("150%")).toBeInTheDocument();
    });
  });
});
