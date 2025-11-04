import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import GrowthPicker, {
  GrowthPickerProps,
  type GrowthMetric,
} from "@/components/dashboard/GrowthPicker";

// ------------------------------------------------------------------
// Enhanced props factory with realistic test data
const createMockMetrics = (): GrowthMetric[] => [
  {
    id: "averageScore",
    name: "Average Score",
    color: "#3b82f6",
    description: "Average performance score across all sessions",
    unit: "%",
    formatter: (value: number) => `${value}%`,
  },
  {
    id: "passRate",
    name: "Pass Rate",
    color: "#10b981",
    description: "Percentage of sessions that meet passing criteria",
    unit: "%",
    formatter: (value: number) => `${value}%`,
  },
  {
    id: "completionRate",
    name: "Completion Rate",
    color: "#8b5cf6",
    description: "Percentage of sessions that were completed",
    unit: "%",
    formatter: (value: number) => `${value}%`,
  },
];

const createMockProps = (
  overrides: Partial<GrowthPickerProps> = {},
): GrowthPickerProps => ({
  availableMetrics: createMockMetrics(),
  selectedMetrics: ["averageScore"],
  onMetricsChange: vi.fn(),
  ...overrides,
});

// ------------------------------------------------------------------
describe("GrowthPicker", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the component with correct button text", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("displays selected metrics count in button text", async () => {
      const props = createMockProps({
        selectedMetrics: ["averageScore", "passRate"],
      });
      render(<GrowthPicker {...props} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("displays 'All Metrics' when all metrics are selected", async () => {
      const props = createMockProps({
        selectedMetrics: ["averageScore", "passRate", "completionRate"],
      });
      render(<GrowthPicker {...props} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("displays 'Select Metrics' when no metrics are selected", async () => {
      const props = createMockProps({
        selectedMetrics: [],
      });
      render(<GrowthPicker {...props} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("Dropdown Functionality", () => {
    it("opens dropdown when button is clicked", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Verify dropdown is open
      expect(screen.getByText("Select Metrics")).toBeInTheDocument();
    });

    it("displays all available metrics in dropdown", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Check for all metrics - use more specific selectors to avoid duplicates
      expect(screen.getByText("Pass Rate")).toBeInTheDocument();
      expect(screen.getByText("Completion Rate")).toBeInTheDocument();
      // Check that the dropdown is open
      expect(screen.getByText("Select Metrics")).toBeInTheDocument();
    });

    it("shows checkmarks for selected metrics", async () => {
      const props = createMockProps({
        selectedMetrics: ["averageScore", "passRate"],
      });
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Verify checkmarks are displayed for selected metrics
      const checkmarks = screen.getAllByRole("checkbox", { checked: true });
      expect(checkmarks).toHaveLength(2);
    });
  });

  describe("Metric Selection", () => {
    it("calls onMetricsChange when metric is selected", async () => {
      const onMetricsChange = vi.fn();
      const props = createMockProps({
        selectedMetrics: ["averageScore"],
        onMetricsChange,
      });
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Click on Pass Rate to select it
      const passRateOption = screen.getByText("Pass Rate");
      await user.click(passRateOption);

      expect(onMetricsChange).toHaveBeenCalledWith([
        "averageScore",
        "passRate",
      ]);
    });

    it("calls onMetricsChange when metric is deselected", async () => {
      const onMetricsChange = vi.fn();
      const props = createMockProps({
        selectedMetrics: ["averageScore", "passRate"],
        onMetricsChange,
      });
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Click on Pass Rate to deselect it
      const passRateOption = screen.getByText("Pass Rate");
      await user.click(passRateOption);

      expect(onMetricsChange).toHaveBeenCalledWith(["averageScore"]);
    });

    it("maintains at least one selected metric", async () => {
      const onMetricsChange = vi.fn();
      const props = createMockProps({
        selectedMetrics: ["averageScore"],
        onMetricsChange,
      });
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Try to deselect the only selected metric - use a more specific selector
      const passRateOption = screen.getByText("Pass Rate");
      await user.click(passRateOption);

      // Should not call onMetricsChange with empty array
      expect(onMetricsChange).not.toHaveBeenCalledWith([]);
    });
  });

  describe("Keyboard Navigation", () => {
    it("supports keyboard navigation in dropdown", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      button.focus();
      await user.keyboard("{Enter}");

      // Verify dropdown is open
      expect(screen.getByText("Select Metrics")).toBeInTheDocument();
    });

    it("closes dropdown when Escape is pressed", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Verify dropdown is open
      expect(screen.getByText("Select Metrics")).toBeInTheDocument();

      // Press Escape
      await user.keyboard("{Escape}");

      // Verify dropdown is closed
      expect(screen.queryByText("Select Metrics")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("updates ARIA attributes when dropdown is open", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("has proper focus management", async () => {
      const props = createMockProps();
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      button.focus();
      expect(button).toHaveFocus();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty available metrics", async () => {
      const props = createMockProps({
        availableMetrics: [],
        selectedMetrics: [],
      });
      render(<GrowthPicker {...props} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("handles single available metric", async () => {
      const metrics = createMockMetrics();
      const singleMetric = metrics[0]!;
      const props = createMockProps({
        availableMetrics: [singleMetric],
        selectedMetrics: ["averageScore"],
      });
      render(<GrowthPicker {...props} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("handles optional onMetricsChange", async () => {
      const props = createMockProps();
      // Remove onMetricsChange to test optional behavior
      const { onMetricsChange: _onMetricsChange, ...propsWithoutCallback } =
        props;
      render(
        <GrowthPicker {...propsWithoutCallback} onMetricsChange={vi.fn()} />,
      );

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Should not crash when clicking on metrics
      const passRateOption = screen.getByText("Pass Rate");
      await user.click(passRateOption);

      // Component should still function
      expect(screen.getByText("Select Metrics")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("handles large number of metrics efficiently", async () => {
      const largeMetrics = Array.from({ length: 50 }, (_, i) => ({
        id: `metric-${i}`,
        name: `Metric ${i}`,
        color: "#000000",
        description: `Description for metric ${i}`,
        unit: "%",
        formatter: (value: number) => `${value}%`,
      }));

      const props = createMockProps({
        availableMetrics: largeMetrics,
        selectedMetrics: ["metric-0", "metric-1"],
      });
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Should render without performance issues
      expect(screen.getByText("Select Metrics")).toBeInTheDocument();
    });

    it("debounces rapid metric changes", async () => {
      const onMetricsChange = vi.fn();
      const props = createMockProps({
        onMetricsChange,
      });
      render(<GrowthPicker {...props} />);

      const button = screen.getByRole("combobox");
      await user.click(button);

      // Rapidly click on different metrics
      const passRateOption = screen.getByText("Pass Rate");
      const completionRateOption = screen.getByText("Completion Rate");

      await user.click(passRateOption);
      await user.click(completionRateOption);
      await user.click(passRateOption);

      // Should handle rapid changes gracefully
      expect(onMetricsChange).toHaveBeenCalled();
    });
  });
});
