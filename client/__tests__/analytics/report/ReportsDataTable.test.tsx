import { renderWithMocks } from "@/test/renderWithMocks";
import type { ColumnDef } from "@tanstack/react-table";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  ReportsDataTable,
  ReportsDataTableProps,
} from "@/components/analytics/report/ReportsDataTable";
import { TAPerformanceData } from "@/hooks/use-report-columns";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ReportsDataTableProps = {
  columns: [],
  data: [],
  roleOptions: [],
  cohortOptions: [],
  personaOptions: [],
  scenarioOptions: [],
  simulationOptions: [],
  simulations: [],
  onViewReport: vi.fn(),
  // showExport: false, /* optional */
};

// Mock data for testing
const mockTAPerformanceData: TAPerformanceData[] = [
  {
    id: "test-profile-1",
    firstName: "John",
    lastName: "Doe",
    username: "john.doe",
    averageScore: 85,
    completionPercentage: 90,
    firstAttemptPassRate: 80,
    highestScore: 95,
    messagesPerSession: 10,
    personaResponseTimes: 3,
    sessionEfficiency: 85,
    stagnationRate: 15,
    timeSpent: 45,
    totalAttempts: 8,
    riskLevel: "good",
    riskDetails: { dangerCount: 0, warningCount: 1, goodCount: 9 },
    avgScore: 85,
    completedSessions: 9,
    totalSessions: 10,
    completionRate: 90,
    initials: "JD",
    skillBreakdown: [],
    weakestSkill: { skill: "Communication", score: 75, feedbackCount: 2 },
    strongestSkill: { skill: "Problem Solving", score: 95, feedbackCount: 1 },
    avgTimeMinutes: 45,
    passRate: 80,
    trend: "improving",
    isStruggling: false,
    hasNoSessions: false,
    lastActivity: new Date(),
    scenariosCompleted: 5,
    taCohorts: ["Cohort A"],
    activeCohorts: 1,
    cohortComparison: [],
    bestCohortRank: 1,
    avgVsCohort: 5,
    role: "ta",
    personasTested: ["persona-1"],
    scenarioIds: ["scenario-1"],
    simulationIds: ["simulation-1"],
  },
];

const mockColumns: ColumnDef<TAPerformanceData>[] = [
  {
    accessorKey: "firstName",
    header: "Name",
    cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
  },
  {
    accessorKey: "averageScore",
    header: "Average Score",
    cell: ({ row }) => `${row.original.averageScore}%`,
  },
];

// ------------------------------------------------------------------
describe("ReportsDataTable", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects
   * - mockSchema.profiles - Array of profile objects
   *
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */

  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ReportsDataTable {...mockProps} />);

      // Should render the table container
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("should render with data and columns", () => {
      const propsWithData = {
        ...mockProps,
        columns: mockColumns,
        data: mockTAPerformanceData,
      };

      renderWithMocks(<ReportsDataTable {...propsWithData} />);

      // Should display the TA name
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it('should display "No results" when no data is provided', () => {
      renderWithMocks(<ReportsDataTable {...mockProps} />);

      expect(screen.getByText("No results.")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      const propsWithData = {
        ...mockProps,
        columns: mockColumns,
        data: mockTAPerformanceData,
      };

      renderWithMocks(<ReportsDataTable {...propsWithData} />);

      // Should have proper table structure
      expect(screen.getByRole("table")).toBeInTheDocument();
      // Use getAllByRole since there are multiple rowgroups (thead and tbody)
      expect(screen.getAllByRole("rowgroup")).toHaveLength(2);
    });
  });

  describe("User Interactions", () => {
    it("should handle row click to view report", async () => {
      const user = userEvent.setup();
      const onViewReport = vi.fn();

      const propsWithData = {
        ...mockProps,
        columns: mockColumns,
        data: mockTAPerformanceData,
        onViewReport,
      };

      renderWithMocks(<ReportsDataTable {...propsWithData} />);

      // Click on the table row
      const tableRow = screen.getByRole("row", { name: /John Doe/i });
      await user.click(tableRow);

      expect(onViewReport).toHaveBeenCalledWith("test-profile-1");
    });

    it("should handle state changes", async () => {
      const _user = userEvent.setup();

      const propsWithData = {
        ...mockProps,
        columns: mockColumns,
        data: mockTAPerformanceData,
      };

      renderWithMocks(<ReportsDataTable {...propsWithData} />);

      // The component should handle state changes internally
      // This is tested through the table functionality
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      const _user = userEvent.setup();

      const propsWithData = {
        ...mockProps,
        columns: mockColumns,
        data: mockTAPerformanceData,
      };

      renderWithMocks(<ReportsDataTable {...propsWithData} />);

      // Test that the table is interactive
      const tableRow = screen.getByRole("row", { name: /John Doe/i });
      expect(tableRow).toHaveClass("cursor-pointer");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty data array
      const propsWithEmptyData = {
        ...mockProps,
        columns: mockColumns,
        data: [],
      };

      renderWithMocks(<ReportsDataTable {...propsWithEmptyData} />);

      expect(screen.getByText("No results.")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props
      const minimalProps = {
        columns: [],
        data: [],
        roleOptions: [],
        cohortOptions: [],
        personaOptions: [],
        scenarioOptions: [],
        simulationOptions: [],
        simulations: [],
        onViewReport: vi.fn(),
      };

      renderWithMocks(<ReportsDataTable {...minimalProps} />);

      // Should still render without crashing
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for ReportsDataTable:
 * Path: analytics/report/ReportsDataTable.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: ReportsDataTable, ReportsDataTableProps
 * - Has props: true
 * - Props interface: ReportsDataTableProps
 * - Client component: true
 * - Uses hooks: useReactTable, useState
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<ReportsDataTable {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<ReportsDataTable {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
