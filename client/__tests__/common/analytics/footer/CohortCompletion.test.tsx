import CohortCompletion from "@/components/common/analytics/footer/CohortCompletion";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
// Mock recharts components to avoid rendering issues in tests
vi.mock("recharts", () => ({
  RadialBarChart: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="radial-bar-chart" {...props}>
      {children}
    </div>
  ),
  RadialBar: (props: Record<string, unknown>) => (
    <div data-testid="radial-bar" {...props} />
  ),
  PolarRadiusAxis: (props: Record<string, unknown>) => (
    <div data-testid="polar-radius-axis" {...props} />
  ),
}));

// Mock chart components
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="chart-container" className={className}>
      {children}
    </div>
  ),
  ChartTooltip: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart-tooltip">{children}</div>
  ),
  ChartTooltipContent: ({
    hideLabel,
    nameKey,
  }: {
    hideLabel?: boolean;
    nameKey?: string;
  }) => (
    <div
      data-testid="chart-tooltip-content"
      data-hidelabel={hideLabel}
      data-namekey={nameKey}
    />
  ),
}));

describe("CohortCompletion", () => {
  const mockProps = {
    cohorts: [
      {
        id: "1",
        title: "Test Cohort",
        description: "Test description",
        profileIds: ["profile1", "profile2"],
      },
    ],
    profiles: [
      { id: "profile1", role: "student" },
      { id: "profile2", role: "student" },
    ],
    attempts: [
      { id: "attempt1", profileId: "profile1", simulationId: "sim1" },
      { id: "attempt2", profileId: "profile2", simulationId: "sim1" },
    ],
    chats: [
      { id: "chat1", attemptId: "attempt1", completed: true },
      { id: "chat2", attemptId: "attempt2", completed: false },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(<CohortCompletion {...mockProps} />);

      expect(screen.getByText("Cohort Progress")).toBeInTheDocument();
      expect(
        screen.getByText("Training completion rates across different cohorts")
      ).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<CohortCompletion {...mockProps} />);

      // Should display the cohort name
      expect(screen.getByText("Test Cohort")).toBeInTheDocument();

      // Should render chart components
      expect(screen.getByTestId("chart-container")).toBeInTheDocument();
      expect(screen.getByTestId("radial-bar-chart")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<CohortCompletion {...mockProps} />);

      // Card should be accessible
      const cardHeader = screen.getByText("Cohort Progress").closest("div");
      expect(cardHeader).toBeInTheDocument();

      // Progress bars should be rendered
      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const emptyProps = {
        cohorts: [],
        profiles: [],
        attempts: [],
        chats: [],
      };

      render(<CohortCompletion {...emptyProps} />);

      // Should render title even with empty data
      expect(screen.getByText("Cohort Progress")).toBeInTheDocument();
      expect(
        screen.getByText("Training completion rates across different cohorts")
      ).toBeInTheDocument();

      // Should not show cohort details when no data
      expect(screen.queryByText("Test Cohort")).not.toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      const incompleteProps = {
        cohorts: [
          { id: "1", title: "Test", description: null, profileIds: [] },
        ],
        profiles: [],
        attempts: [],
        chats: [],
      };

      render(<CohortCompletion {...incompleteProps} />);

      // Should render without crashing
      expect(screen.getByText("Cohort Progress")).toBeInTheDocument();
      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for CohortCompletion:
 * Path: common/analytics/footer/CohortCompletion.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: CohortCompletionProps
 * - Client component: true
 * - Uses hooks: used, useMemo
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * Tests implemented:
 * - Basic rendering with required props
 * - Props validation and display
 * - Accessibility attributes
 * - Edge cases with empty/invalid data
 * - Chart component mocking to avoid rendering issues
 */
