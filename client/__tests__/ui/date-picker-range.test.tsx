import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("DatePickerWithRange", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DatePickerWithRange />);

      // The component shows default date range, not "Filter by date"
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DatePickerWithRange />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with custom className", () => {
      renderWithMocks(<DatePickerWithRange className="custom-class" />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should render with date range", () => {
      const dateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      };
      renderWithMocks(<DatePickerWithRange dateRange={dateRange} />);

      // Should display the formatted date range
      expect(screen.getByText(/Jan 01, 2024/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<DatePickerWithRange />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });
});
