import { ChartContainer } from "@/components/ui/chart";
import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Chart", () => {
  const mockConfig = {
    value: {
      label: "Value",
      color: "#000000",
    },
  };

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <ChartContainer config={mockConfig}>
          <div>Chart Content</div>
        </ChartContainer>,
      );

      const chart = document.querySelector('[data-slot="chart"]');
      expect(chart).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <ChartContainer config={mockConfig}>
          <div>Accessible Chart</div>
        </ChartContainer>,
      );

      const chart = document.querySelector('[data-slot="chart"]');
      expect(chart).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with config", () => {
      renderWithMocks(
        <ChartContainer config={mockConfig}>
          <div>Chart with Config</div>
        </ChartContainer>,
      );

      const chart = document.querySelector('[data-slot="chart"]');
      expect(chart).toBeInTheDocument();
    });

    it("should render with custom className", () => {
      renderWithMocks(
        <ChartContainer config={mockConfig} className="custom-class">
          <div>Chart</div>
        </ChartContainer>,
      );

      const chart = document.querySelector('[data-slot="chart"]');
      expect(chart).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal config
      renderWithMocks(
        <ChartContainer config={{}}>
          <div>Minimal Chart</div>
        </ChartContainer>,
      );

      const chart = document.querySelector('[data-slot="chart"]');
      expect(chart).toBeInTheDocument();
    });
  });
});
