import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import SimulationCompositionPicker, {
  SimulationCompositionConfig,
} from "@/components/common/analytics/SimulationCompositionPicker";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps = {
  onConfigChange: vi.fn(),
  currentConfig: {
    method: "percentile" as const,
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  } as SimulationCompositionConfig,
};

// ------------------------------------------------------------------
describe("SimulationCompositionPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<SimulationCompositionPicker {...mockProps} />);

      // Should render the dropdown button with config label
      await waitFor(() => {
        expect(screen.getByText(/Top 25% vs Bottom 25%/)).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test component with various props
      renderWithMocks(<SimulationCompositionPicker {...mockProps} />);

      // Should display the current config
      await waitFor(() => {
        expect(screen.getByText(/Top 25% vs Bottom 25%/)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      renderWithMocks(<SimulationCompositionPicker {...mockProps} />);

      // Should have a button role
      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle config changes", async () => {
      const user = userEvent.setup();
      const mockOnConfigChange = vi.fn();
      renderWithMocks(
        <SimulationCompositionPicker
          {...mockProps}
          onConfigChange={mockOnConfigChange}
        />,
      );

      // Should render the dropdown button
      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      // Click the dropdown to open it
      const button = screen.getByRole("button");
      await user.click(button);

      // Should show dropdown options
      await waitFor(() => {
        expect(screen.getByText("Top 50% vs Bottom 50%")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different config methods
      const propsWithQuartile = {
        ...mockProps,
        currentConfig: {
          method: "quartile" as const,
          topPercentage: 25,
          bottomPercentage: 25,
          description: "Q1 vs Q4 - Quartile Analysis",
        } as SimulationCompositionConfig,
      };

      renderWithMocks(<SimulationCompositionPicker {...propsWithQuartile} />);

      // Should render with quartile config
      await waitFor(() => {
        expect(screen.getByText(/Q1 vs Q4/)).toBeInTheDocument();
      });
    });

    it("should handle standard deviation config", async () => {
      const propsWithStdDev = {
        ...mockProps,
        currentConfig: {
          method: "standard_deviation" as const,
          topPercentage: 15,
          bottomPercentage: 15,
          description: "±1σ - Statistical Outliers",
        } as SimulationCompositionConfig,
      };

      renderWithMocks(<SimulationCompositionPicker {...propsWithStdDev} />);

      // Should render with standard deviation config
      await waitFor(() => {
        expect(screen.getByText(/±1σ/)).toBeInTheDocument();
      });
    });
  });
});
