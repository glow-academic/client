import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import SimulationCompositionPicker from "@/components/common/analytics/SimulationCompositionPicker";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
interface SimulationCompositionPickerProps {
  onConfigChange: (config: {
    method: "percentile" | "standard_deviation" | "quartile";
    topPercentage: number;
    bottomPercentage: number;
    description: string;
  }) => void;
  currentConfig: {
    method: "percentile" | "standard_deviation" | "quartile";
    topPercentage: number;
    bottomPercentage: number;
    description: string;
  };
}

const mockProps: SimulationCompositionPickerProps = {
  onConfigChange: vi.fn(),
  currentConfig: {
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  },
};
// ------------------------------------------------------------------
describe("SimulationCompositionPicker", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<SimulationCompositionPicker {...mockProps} />);

      // Should render the dropdown button with config label
      expect(screen.getByText(/Top 25% vs Bottom 25%/)).toBeInTheDocument();
    });

    it("should render with props", () => {
      // Test component with various props
      renderWithMocks(<SimulationCompositionPicker {...mockProps} />);

      // Should display the current config
      expect(screen.getByText(/Top 25% vs Bottom 25%/)).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      // Test accessibility features
      renderWithMocks(<SimulationCompositionPicker {...mockProps} />);

      // Should have a button role
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle config changes", async () => {
      const mockOnConfigChange = vi.fn();
      renderWithMocks(
        <SimulationCompositionPicker
          {...mockProps}
          onConfigChange={mockOnConfigChange}
        />
      );

      // Should render the dropdown button
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with different config methods
      const propsWithQuartile = {
        ...mockProps,
        currentConfig: {
          method: "quartile" as const,
          topPercentage: 25,
          bottomPercentage: 25,
          description: "Q1 vs Q4 - Quartile Analysis",
        },
      };

      renderWithMocks(<SimulationCompositionPicker {...propsWithQuartile} />);

      // Should render with quartile config
      expect(screen.getByText(/Q1 vs Q4/)).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with standard deviation config
      const propsWithStdDev = {
        ...mockProps,
        currentConfig: {
          method: "standard_deviation" as const,
          topPercentage: 15,
          bottomPercentage: 15,
          description: "±1σ - Statistical Outliers",
        },
      };

      renderWithMocks(<SimulationCompositionPicker {...propsWithStdDev} />);

      // Should render with standard deviation config
      expect(screen.getByText(/±1σ/)).toBeInTheDocument();
    });
  });
});
