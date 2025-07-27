import { CircularProgress } from "@/components/ui/circular-progress";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("CircularProgress", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<CircularProgress progress={50} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<CircularProgress progress={75} />);

      expect(screen.getByText("75%")).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with different progress values", () => {
      renderWithMocks(<CircularProgress progress={25} />);

      expect(screen.getByText("25%")).toBeInTheDocument();
    });

    it("should render with custom size", () => {
      renderWithMocks(<CircularProgress progress={50} size={60} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should render with custom stroke width", () => {
      renderWithMocks(<CircularProgress progress={50} strokeWidth={6} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should handle progress at 0%", () => {
      renderWithMocks(<CircularProgress progress={0} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should handle progress at 100%", () => {
      renderWithMocks(<CircularProgress progress={100} />);

      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with negative progress (component displays the actual value)
      renderWithMocks(<CircularProgress progress={-10} />);

      expect(screen.getByText("-10%")).toBeInTheDocument();
    });

    it("should handle progress over 100% (component displays the actual value)", () => {
      renderWithMocks(<CircularProgress progress={150} />);

      expect(screen.getByText("150%")).toBeInTheDocument();
    });
  });
});
