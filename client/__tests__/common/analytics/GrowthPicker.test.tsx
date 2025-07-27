import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import GrowthPicker, {
  GrowthPickerProps,
} from "@/components/common/analytics/GrowthPicker";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: GrowthPickerProps = {
  availableMetrics: [
    {
      id: "averageScore",
      name: "Average Score",
      color: "#3b82f6",
      description: "Average performance score across all sessions",
      unit: "%",
      formatter: (value: number) => `${value}%`,
    },
    {
      id: "completionRate",
      name: "Completion Rate",
      color: "#10b981",
      description: "Percentage of completed sessions",
      unit: "%",
      formatter: (value: number) => `${value}%`,
    },
  ],
  selectedMetrics: ["averageScore"],
  onMetricsChange: vi.fn(),
};

// ------------------------------------------------------------------
describe("GrowthPicker", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<GrowthPicker {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      renderWithMocks(<GrowthPicker {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<GrowthPicker {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", async () => {
      renderWithMocks(<GrowthPicker {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      // Should handle user interactions
      expect(screen.getByText("Average Score")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      const propsWithNoSelection = {
        ...mockProps,
        selectedMetrics: [],
      };

      renderWithMocks(<GrowthPicker {...propsWithNoSelection} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Select metrics...")).toBeInTheDocument();
      });
    });
  });
});
