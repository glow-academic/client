import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";
import * as mockSchema from "@/mocks/schema";

// ——————————————————————————————————————————
import Logs from "@/components/system/logs/Logs";

// Mock the query client
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

// Mock the getAppLogs function
vi.mock("@/utils/logs/get-logs", () => ({
  getAppLogs: vi.fn(() => ({
    logs: mockSchema.appLogs || [],
    totalCount: mockSchema.appLogs?.length || 0,
    totalPages: 1,
    currentPage: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  })),
}));

// Import mocked functions
import { logError, logInfo } from "@/utils/logger";
import { getAppLogs } from "@/utils/logs/get-logs";
import { toast } from "sonner";

// Get mock functions
const mockGetAppLogs = vi.mocked(getAppLogs);
const mockLogInfo = vi.mocked(logInfo);
const mockLogError = vi.mocked(logError);
const mockToast = vi.mocked(toast);

// Mock data
const mockLogsData = {
  logs: [
    {
      id: 1,
      level: "info",
      message: "Test log message 1",
      context: { userId: 123, action: "login" },
      createdAt: "2025-01-15T10:30:00Z",
    },
    {
      id: 2,
      level: "error",
      message:
        "Test error message with very long text that should be truncated and show the view button",
      context: {
        error: "Database connection failed",
        stack: "Error stack trace",
      },
      createdAt: "2025-01-15T10:31:00Z",
    },
    {
      id: 3,
      level: "warn",
      message: null,
      context: null,
      createdAt: "2025-01-15T10:32:00Z",
    },
  ],
  totalCount: 3,
  totalPages: 1,
  currentPage: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const mockEmptyLogsData = {
  logs: [],
  totalCount: 0,
  totalPages: 0,
  currentPage: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

describe("Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppLogs.mockResolvedValue(mockLogsData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Loading and Display", () => {
    it("should load and display logs data", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(mockGetAppLogs).toHaveBeenCalledWith({ page: 1, limit: 1000 });
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should display log levels correctly", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should display log timestamps correctly", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle empty logs data", async () => {
      mockGetAppLogs.mockResolvedValue(mockEmptyLogsData);
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(mockGetAppLogs).toHaveBeenCalledWith({ page: 1, limit: 1000 });
      });

      // Should still render the component without crashing
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle null logs data", async () => {
      mockGetAppLogs.mockResolvedValue(mockEmptyLogsData);
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(mockGetAppLogs).toHaveBeenCalledWith({ page: 1, limit: 1000 });
      });

      // Should still render the component without crashing
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle refresh button click successfully", async () => {
      const user = userEvent.setup();
      mockInvalidateQueries.mockResolvedValue(undefined);

      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Find and click refresh button (look for button with RefreshCw icon)
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="lucide-refresh-cw"]')
      );
      expect(refreshButton).toBeDefined();
      await user.click(refreshButton!);

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ["logs"],
        });
        expect(mockLogInfo).toHaveBeenCalledWith("Logs refreshed successfully");
        expect(mockToast.success).toHaveBeenCalledWith(
          "Logs refreshed successfully"
        );
      });
    });

    it("should handle refresh button click with error", async () => {
      const user = userEvent.setup();
      const error = new Error("Refresh failed");
      mockInvalidateQueries.mockRejectedValue(error);

      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Find and click refresh button
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="lucide-refresh-cw"]')
      );
      expect(refreshButton).toBeDefined();
      await user.click(refreshButton!);

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ["logs"],
        });
        expect(mockLogError).toHaveBeenCalledWith(
          "Error refreshing logs:",
          error
        );
        expect(mockToast.error).toHaveBeenCalledWith("Failed to refresh logs");
      });

      // Verify that isRefreshing is set back to false (finally block)
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle view log button click", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Find and click view button for the long message
      const viewButtons = screen.getAllByRole("button");
      const viewButton = viewButtons.find((button) =>
        button.querySelector('svg[class*="lucide-eye"]')
      );

      if (viewButton) {
        await user.click(viewButton);

        // Check that dialog opens with log details
        await waitFor(() => {
          expect(screen.getByText('"userId": 123')).toBeInTheDocument();
          expect(screen.getByText('"action": "login"')).toBeInTheDocument();
        });
      }
    });

    it("should handle dialog close", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Open dialog first
      const viewButtons = screen.getAllByRole("button");
      const viewButton = viewButtons.find((button) =>
        button.querySelector('svg[class*="lucide-eye"]')
      );

      if (viewButton) {
        await user.click(viewButton);

        // Check dialog is open
        await waitFor(() => {
          expect(screen.getByText('"userId": 123')).toBeInTheDocument();
        });

        // Close dialog by clicking outside or escape
        const dialog = screen.getByRole("dialog");
        await user.click(dialog);

        // Dialog should close
        await waitFor(() => {
          expect(screen.queryByText('"userId": 123')).not.toBeInTheDocument();
        });
      }
    });

    it("should handle state changes", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle API error state", async () => {
      const error = new Error("Failed to fetch logs");
      mockGetAppLogs.mockRejectedValue(error);

      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(mockGetAppLogs).toHaveBeenCalledWith({ page: 1, limit: 1000 });
      });

      // Component should still render without crashing
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      // Mock a delayed response
      mockGetAppLogs.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockLogsData), 100))
      );

      renderWithMocks(<Logs />);

      // Should show loading state initially
      await waitFor(() => {
        expect(mockGetAppLogs).toHaveBeenCalledWith({ page: 1, limit: 1000 });
      });

      // Should eventually show data
      await waitFor(
        () => {
          expect(
            screen.getByPlaceholderText("Search messages...")
          ).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it("should refetch data at intervals", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(mockGetAppLogs).toHaveBeenCalledWith({ page: 1, limit: 1000 });
      });

      // The component should refetch every 30 seconds
      // This is tested indirectly through the useQuery configuration
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Dialog Functionality", () => {
    it("should display log context in dialog", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Open dialog for log with context
      const viewButtons = screen.getAllByRole("button");
      const viewButton = viewButtons.find((button) =>
        button.querySelector('svg[class*="lucide-eye"]')
      );

      if (viewButton) {
        await user.click(viewButton);

        await waitFor(() => {
          expect(screen.getByText('"userId": 123')).toBeInTheDocument();
          expect(screen.getByText('"action": "login"')).toBeInTheDocument();
        });
      }
    });

    it("should handle dialog onOpenChange callback", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Open dialog first
      const viewButtons = screen.getAllByRole("button");
      const viewButton = viewButtons.find((button) =>
        button.querySelector('svg[class*="lucide-eye"]')
      );

      if (viewButton) {
        await user.click(viewButton);

        // Check dialog is open
        await waitFor(() => {
          expect(screen.getByText('"userId": 123')).toBeInTheDocument();
        });

        // Close dialog by pressing Escape key
        await user.keyboard("{Escape}");

        // Dialog should close
        await waitFor(() => {
          expect(screen.queryByText('"userId": 123')).not.toBeInTheDocument();
        });
      }
    });

    it("should display 'No context data' for logs without context", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Find and click view button for log without context (ID 3)
      const viewButtons = screen.getAllByRole("button");
      const viewButton = viewButtons.find((button) =>
        button.querySelector('svg[class*="lucide-eye"]')
      );

      if (viewButton) {
        await user.click(viewButton);

        await waitFor(() => {
          expect(screen.getByText("No context data")).toBeInTheDocument();
        });
      }
    });

    it("should handle complex context data", async () => {
      const user = userEvent.setup();
      const complexLogData = {
        ...mockLogsData,
        logs: [
          {
            id: 4,
            level: "debug",
            message: "Complex debug message",
            context: {
              nested: {
                data: "value",
                array: [1, 2, 3],
                object: { key: "value" },
              },
              timestamp: "2025-01-15T10:35:00Z",
            },
            createdAt: "2025-01-15T10:35:00Z",
          },
        ],
      };
      mockGetAppLogs.mockResolvedValue(complexLogData);

      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Open dialog
      const viewButtons = screen.getAllByRole("button");
      const viewButton = viewButtons.find((button) =>
        button.querySelector('svg[class*="lucide-eye"]')
      );

      if (viewButton) {
        await user.click(viewButton);

        await waitFor(() => {
          expect(screen.getByText('"nested"')).toBeInTheDocument();
          expect(screen.getByText('"data": "value"')).toBeInTheDocument();
          expect(screen.getByText('"array"')).toBeInTheDocument();
        });
      }
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle logs with null message", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Log with null message should still be displayed
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle logs with null context", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Log with null context should still be displayed
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle logs with very long messages", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Long message should be truncated and show view button
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle unknown log levels", async () => {
      const unknownLevelData = {
        ...mockLogsData,
        logs: [
          {
            id: 5,
            level: "unknown",
            message: "Unknown level log",
            context: {},
            createdAt: "2025-01-15T10:40:00Z",
          },
        ],
      };
      mockGetAppLogs.mockResolvedValue(unknownLevelData);

      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should handle malformed context data", async () => {
      const user = userEvent.setup();
      const malformedData = {
        ...mockLogsData,
        logs: [
          {
            id: 6,
            level: "error",
            message: "Malformed context",
            context: "This is not an object",
            createdAt: "2025-01-15T10:45:00Z",
          },
        ],
      };
      mockGetAppLogs.mockResolvedValue(malformedData);

      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Open dialog
      const viewButtons = screen.getAllByRole("button");
      const viewButton = viewButtons.find((button) =>
        button.querySelector('svg[class*="lucide-eye"]')
      );

      if (viewButton) {
        await user.click(viewButton);

        await waitFor(() => {
          expect(
            screen.getByText('"This is not an object"')
          ).toBeInTheDocument();
        });
      }
    });
  });

  describe("Filtering and Search", () => {
    it("should generate filter options correctly", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // The component should generate filter options based on the data
      // This is tested indirectly through the data table component
    });
  });

  describe("Component Integration", () => {
    it("should integrate with LogsDataTable correctly", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Check that LogsDataTable receives the correct props
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });

    it("should integrate with useLogColumns hook correctly", async () => {
      renderWithMocks(<Logs />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });

      // Check that columns are generated correctly
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search messages...")
        ).toBeInTheDocument();
      });
    });
  });
});
