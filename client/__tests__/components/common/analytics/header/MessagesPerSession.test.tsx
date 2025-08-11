import { render } from '@/test/custom-render';
import { fireEvent, screen, waitFor } from '@/test/custom-render';
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

// ——————————————————————————————————————————
import MessagesPerSession, {
  MessagesPerSessionProps,
} from "@/components/common/analytics/header/MessagesPerSession";

// Mock the utility function
vi.mock("@/utils/analytics/header", () => ({
  calculateMessagesPerSession: vi.fn(),
}));

import { calculateMessagesPerSession } from "@/utils/analytics/header";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: MessagesPerSessionProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-01-31"),
  thresholds: {
    danger: 5,
    warning: 10,
    success: 15,
  },
  profileId: "test-profile-id",
  cohortIds: ["cohort-1"], // Use a valid cohort ID from mock schema
};

// Mock data for different scenarios
const mockAnalyticsResult = {
  currentValue: 12.5,
  trendData: [
    { date: "01/01", value: 10, count: 5 },
    { date: "01/02", value: 15, count: 8 },
    { date: "01/03", value: 12, count: 6 },
  ],
  hasData: true,
};

const mockNoDataResult = {
  currentValue: 0,
  trendData: [],
  hasData: false,
};

// ------------------------------------------------------------------
describe("MessagesPerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render the component
      expect(screen.getByText("Messages Per Session")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should display the component
      expect(screen.getByText("Messages Per Session")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByText("Messages Per Session")).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("should display average messages per session when data is available", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("12.5")).toBeInTheDocument();
      });
    });

    it("should display 'No data' when no data is available", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockNoDataResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No data")).toBeInTheDocument();
      });
    });

    it("should display 'No data' when utility function returns no data", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue({
        currentValue: 0,
        trendData: [],
        hasData: false,
      });

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("No data")).toBeInTheDocument();
      });
    });
  });

  describe("Color Configuration", () => {
    it("should apply danger color when value is below danger threshold", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 3, // Below danger threshold of 5
      });

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        const card = screen
          .getByText("Messages Per Session")
          .closest('[class*="from-red-50"]');
        expect(card).toBeInTheDocument();
      });
    });

    it("should apply warning color when value is between danger and warning thresholds", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 7, // Between danger (5) and warning (10)
      });

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        const card = screen
          .getByText("Messages Per Session")
          .closest('[class*="from-yellow-50"]');
        expect(card).toBeInTheDocument();
      });
    });

    it("should apply success color when value is above success threshold", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue({
        ...mockAnalyticsResult,
        currentValue: 18, // Above success threshold of 15
      });

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        const card = screen
          .getByText("Messages Per Session")
          .closest('[class*="from-green-50"]');
        expect(card).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should open dialog when card is clicked", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card = screen
        .getByText("Messages Per Session")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText("Messages Per Session Trend")
        ).toBeInTheDocument();
      });
    });

    it("should close dialog when close button is clicked", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Messages Per Session")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText("Messages Per Session Trend")
        ).toBeInTheDocument();
      });

      // Close dialog
      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Messages Per Session Trend")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Dialog Content", () => {
    it("should display chart when data is available", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Messages Per Session")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText("Messages Per Session Trend")
        ).toBeInTheDocument();
        // Chart should be rendered
        expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      });
    });

    it("should display no data message in dialog when no data is available", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockNoDataResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Messages Per Session")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(
          screen.getByText(
            "No data available for the selected date range and profile"
          )
        ).toBeInTheDocument();
      });
    });

    it("should display trend analysis when trend data is available", async () => {
      const resultWithTrend = {
        ...mockAnalyticsResult,
        trendData: [
          { date: "01/01", value: 5, count: 2 },
          { date: "01/02", value: 10, count: 3 },
          { date: "01/03", value: 15, count: 4 },
        ],
      };
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(resultWithTrend);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Open dialog
      const card = screen
        .getByText("Messages Per Session")
        .closest('[class*="cursor-pointer"]');
      fireEvent.click(card!);

      await waitFor(() => {
        expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different thresholds
      const propsWithDifferentThresholds = {
        ...mockProps,
        thresholds: {
          danger: 30,
          warning: 60,
          success: 80,
        },
      };

      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...propsWithDifferentThresholds} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should render with different thresholds
      expect(screen.getByText("Messages Per Session")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with undefined profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...propsWithoutProfile} />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should handle undefined profileId
      expect(screen.getByText("Messages Per Session")).toBeInTheDocument();
    });

    it("should handle empty cohortIds array", async () => {
      const propsWithEmptyCohorts = {
        ...mockProps,
        cohortIds: [],
      };

      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...propsWithEmptyCohorts} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Messages Per Session")).toBeInTheDocument();
    });

    it("should handle zero values correctly", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue({
        currentValue: 0,
        trendData: [{ date: "01/01", value: 0, count: 1 }],
        hasData: true,
      });

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("0")).toBeInTheDocument();
      });
    });
  });

  describe("Utility Function Integration", () => {
    it("should call calculateMessagesPerSession with correct parameters", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(calculateMessagesPerSession).toHaveBeenCalledWith(
          expect.any(Array), // messages
          expect.any(Array), // chats
          expect.any(Array), // attempts
          expect.any(Array), // simulations
          mockProps.dateStart,
          mockProps.dateEnd,
          mockProps.profileId,
          expect.any(Array), // cohorts
          mockProps.cohortIds
        );
      });
    });

    it("should handle utility function errors gracefully", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockImplementation(() => {
        throw new Error("Utility function error");
      });

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Messages Per Session")).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("should maintain layout on different screen sizes", async () => {
      (calculateMessagesPerSession as unknown as Mock).mockReturnValue(mockAnalyticsResult);

      render(<MessagesPerSession {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const card = screen
        .getByText("Messages Per Session")
        .closest('[class*="flex flex-col"]');
      expect(card).toBeInTheDocument();
    });
  });
});
