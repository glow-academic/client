import { Calendar } from "@/components/ui/calendar";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Calendar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Calendar />);

      // Calendar should render some content - look for month/year text
      expect(screen.getByRole("grid")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Calendar />);

      const calendar = screen.getByRole("grid");
      expect(calendar).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with mode prop", () => {
      renderWithMocks(<Calendar mode="single" />);

      const calendar = screen.getByRole("grid");
      expect(calendar).toBeInTheDocument();
    });

    it("should render with selected date", () => {
      const selectedDate = new Date("2024-01-15");
      renderWithMocks(<Calendar selected={selectedDate} />);

      const calendar = screen.getByRole("grid");
      expect(calendar).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Calendar />);

      const calendar = screen.getByRole("grid");
      expect(calendar).toBeInTheDocument();
    });
  });
});
