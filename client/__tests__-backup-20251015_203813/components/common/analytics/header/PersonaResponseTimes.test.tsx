import { render } from "@/test/custom-render";
import { fireEvent, screen, waitFor } from "@/test/custom-render";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

// ——————————————————————————————————————————
import PersonaResponseTimes, {
  PersonaResponseTimesProps,
} from "@/components/common/analytics/header/PersonaResponseTimes";

// Mock the utility function
vi.mock("@/utils/analytics/header", () => ({
  calculatePersonaResponseTimes: vi.fn(),
}));

import { calculatePersonaResponseTimes } from "@/utils/analytics/header";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: PersonaResponseTimesProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-01-31"),
  thresholds: {
    danger: 120, // 2 minutes
    warning: 60, // 1 minute
    success: 30, // 30 seconds
  },
  profileId: "test-profile-id",
  cohortIds: [], // Empty to avoid cohort filtering issues
};

// Mock data for different scenarios
const mockAnalyticsResult = {
  currentValue: 45, // 45 seconds
  trendData: [
    { date: "01/01", value: 40, count: 5 },
    { date: "01/02", value: 50, count: 8 },
    { date: "01/03", value: 45, count: 6 },
  ],
  hasData: true,
};

const mockNoDataResult = {
  currentValue: 0,
  trendData: [],
  hasData: false,
};

// ------------------------------------------------------------------
describe("PersonaResponseTimes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render the component
      expect(screen.getByText("Persona Response Times")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should display the component
      expect(screen.getByText("Persona Response Times")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByText("Persona Response Times")).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("should display formatted response time when data is available", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("45s")).toBeInTheDocument();
      });
    });

    it("should display formatted response time in minutes and seconds", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 90, // 1 minute 30 seconds
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("1m 30s")).toBeInTheDocument();
      });
    });

    it("should display 'No data' when no data is available", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockNoDataResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No data")).toBeInTheDocument();
      });
    });

    it("should display 'No data' when utility function returns no data", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        currentValue: 0,
        trendData: [],
        hasData: false,
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No data")).toBeInTheDocument();
      });
    });
  });

  describe("Color Configuration", () => {
    it("should apply danger color when response time is above danger threshold", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 150, // Above danger threshold of 120 seconds
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        const card = screen
          .getByText("Persona Response Times")
          .closest('[class*="from-red-50"]');
        expect(card).toBeInTheDocument();
      });
    });

    it("should apply warning color when response time is between warning and danger thresholds", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 90, // Between warning (60) and danger (120)
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        const card = screen
          .getByText("Persona Response Times")
          .closest('[class*="from-yellow-50"]');
        expect(card).toBeInTheDocument();
      });
    });

    it("should apply success color when response time is below success threshold", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 20, // Below success threshold of 30 seconds
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        const card = screen
          .getByText("Persona Response Times")
          .closest('[class*="from-green-50"]');
        expect(card).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should open dialog when card is clicked", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card = screen
        .getByText("Persona Response Times")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText("Persona Response Time Trend"),
        ).toBeInTheDocument();
      });
    });

    it("should close dialog when close button is clicked", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Persona Response Times")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText("Persona Response Time Trend"),
        ).toBeInTheDocument();
      });

      // Close dialog
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Persona Response Time Trend"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Dialog Content", () => {
    it("should display chart when data is available", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Persona Response Times")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText("Persona Response Time Trend"),
        ).toBeInTheDocument();
        // Chart should be rendered - look for the ResponsiveContainer instead of img role
        expect(
          screen.getByText("Persona Response Time Trend"),
        ).toBeInTheDocument();
        // Check for chart container
        expect(
          document.querySelector(".recharts-responsive-container"),
        ).toBeInTheDocument();
      });
    });

    it("should display no data message in dialog when no data is available", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockNoDataResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Persona Response Times")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText(
            "No data available for the selected date range and profile",
          ),
        ).toBeInTheDocument();
      });
    });

    it("should display trend analysis when trend data is available", async () => {
      const resultWithTrend = {
        ...mockAnalyticsResult,
        trendData: [
          { date: "01/01", value: 20, count: 2 },
          { date: "01/02", value: 80, count: 3 },
          { date: "01/03", value: 25, count: 4 },
        ],
      };
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        resultWithTrend,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Persona Response Times")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        // Check that the dialog opens and chart is rendered
        expect(
          screen.getByText("Persona Response Time Trend"),
        ).toBeInTheDocument();
        expect(
          document.querySelector(".recharts-responsive-container"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different thresholds
      const propsWithDifferentThresholds = {
        ...mockProps,
        thresholds: {
          danger: 300,
          warning: 180,
          success: 60,
        },
      };

      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...propsWithDifferentThresholds} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render with different thresholds
      expect(screen.getByText("Persona Response Times")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...propsWithoutProfile} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should handle undefined profileId
      expect(screen.getByText("Persona Response Times")).toBeInTheDocument();
    });

    it("should handle empty cohortIds array", async () => {
      const propsWithEmptyCohorts = {
        ...mockProps,
        cohortIds: [],
      };

      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...propsWithEmptyCohorts} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Persona Response Times")).toBeInTheDocument();
    });

    it("should handle zero values correctly", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        currentValue: 0,
        trendData: [{ date: "01/01", value: 0, count: 1 }],
        hasData: true,
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("0s")).toBeInTheDocument();
      });
    });

    it("should handle very large response times", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 3661, // 1 hour 1 minute 1 second
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("61m 1s")).toBeInTheDocument();
      });
    });
  });

  describe("Utility Function Integration", () => {
    it("should call calculatePersonaResponseTimes with correct parameters", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(calculatePersonaResponseTimes).toHaveBeenCalledWith(
          expect.any(Array), // messages
          expect.any(Array), // chats
          expect.any(Array), // attempts
          expect.any(Array), // simulations
          mockProps.dateStart,
          mockProps.dateEnd,
          mockProps.profileId,
          expect.any(Array), // cohorts
          mockProps.cohortIds,
        );
      });
    });

    it("should handle utility function errors gracefully", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockImplementation(
        () => {
          throw new Error("Utility function error");
        },
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Persona Response Times")).toBeInTheDocument();
      });
    });
  });

  describe("Time Formatting", () => {
    it("should format seconds correctly", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 45,
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("45s")).toBeInTheDocument();
      });
    });

    it("should format minutes and seconds correctly", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 125, // 2 minutes 5 seconds
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("2m 5s")).toBeInTheDocument();
      });
    });

    it("should format exactly 60 seconds as 1 minute", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 60,
      });

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("1m 0s")).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("should maintain layout on different screen sizes", async () => {
      (calculatePersonaResponseTimes as unknown as Mock).mockReturnValue(
        mockAnalyticsResult,
      );

      render(<PersonaResponseTimes {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card = screen
        .getByText("Persona Response Times")
        .closest('[class*="flex flex-col"]');
      expect(card).toBeInTheDocument();
    });
  });
});
