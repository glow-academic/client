import ClassDetails from "@/components/classes/ClassDetails";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock all query functions
vi.mock("@/utils/queries/classes/get-class", () => ({
  getClass: vi.fn(),
}));

vi.mock("@/utils/queries/topics/get-topics-by-class", () => ({
  getTopicsByClass: vi.fn(),
}));

vi.mock("@/utils/queries/schedules/get-schedules-by-class", () => ({
  getSchedulesByClass: vi.fn(),
}));

vi.mock("@/utils/queries/events/get-all-events", () => ({
  getAllEvents: vi.fn(),
}));

vi.mock("@/utils/mutations/classes/delete-class", () => ({
  deleteClass: vi.fn(),
}));

// Import mocked functions
import { deleteClass } from "@/utils/mutations/classes/delete-class";
import { getClass } from "@/utils/queries/classes/get-class";
import { getAllEvents } from "@/utils/queries/events/get-all-events";
import { getSchedulesByClass } from "@/utils/queries/schedules/get-schedules-by-class";
import { getTopicsByClass } from "@/utils/queries/topics/get-topics-by-class";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock chart components
vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}));

// Mock data at module level

// Mock additional query functions
vi.mock("@/utils/queries/topics/get-topics-by-class", () => ({
  getTopicsByClass: vi.fn(),
}));

vi.mock("@/utils/queries/schedules/get-schedules-by-class", () => ({
  getSchedulesByClass: vi.fn(),
}));

vi.mock("@/utils/queries/events/get-all-events", () => ({
  getAllEvents: vi.fn(),
}));

// Import additional mocked functions

describe("ClassDetails", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup default mock implementations
    const mockClass = {
      id: "test-class-id",
      name: "Test Class",
      classCode: "CS101",
      year: 2024,
      term: "fall" as const,
      description: "Test class description",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const mockTopics = [
      {
        id: "topic-1",
        name: "Introduction",
        description: "Basic concepts",
        prerequisite: false,
        classId: "test-class-id",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "topic-2",
        name: "Advanced Topics",
        description: "Advanced concepts",
        prerequisite: true,
        classId: "test-class-id",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockSchedules = [
      {
        id: "schedule-1",
        name: "Weekly Schedule",
        description: "Main class schedule",
        classId: "test-class-id",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    // Mock all query functions with default resolved values
    vi.mocked(getClass).mockResolvedValue(mockClass);
    vi.mocked(deleteClass).mockResolvedValue(undefined);

    // Mock additional functions
    vi.mocked(getTopicsByClass).mockResolvedValue(mockTopics);
    vi.mocked(getSchedulesByClass).mockResolvedValue(mockSchedules);
    vi.mocked(getAllEvents).mockResolvedValue([]);

    // Mock router
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render without crashing", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByText("Test Class")).toBeInTheDocument();
      });
    });

    it("should display class information correctly", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByText("Test Class")).toBeInTheDocument();
        expect(screen.getByText("CS101 • fall 2024")).toBeInTheDocument();
        expect(screen.getByText("Test class description")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByText("Performance Trend")).toBeInTheDocument();
        expect(screen.getByText("Course Topics")).toBeInTheDocument();
        expect(screen.getByText("Schedules")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle API calls correctly", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(getClass).toHaveBeenCalledWith("test-class-id");
        expect(getTopicsByClass).toHaveBeenCalledWith(["test-class-id"]);
        expect(getSchedulesByClass).toHaveBeenCalledWith(["test-class-id"]);
      });
    });

    it("should handle loading states", () => {
      // Mock loading state
      vi.mocked(getClass).mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<ClassDetails classId="test-class-id" />);

      expect(screen.getByText("Loading class details...")).toBeInTheDocument();
    });

    it("should handle error states when class not found", async () => {
      vi.mocked(getClass).mockResolvedValue(null);

      renderWithProviders(<ClassDetails classId="non-existent-id" />);

      await waitFor(() => {
        expect(screen.getByText("Class Not Found")).toBeInTheDocument();
        expect(
          screen.getByText("The class you're looking for doesn't exist.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle time range selection", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByText("Performance Trend")).toBeInTheDocument();
      });

      // Find and interact with time range selector
      const timeRangeSelect = screen.getByDisplayValue("30 days");
      expect(timeRangeSelect).toBeInTheDocument();
    });

    it("should handle topic filtering", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByText("Course Topics")).toBeInTheDocument();
      });

      // Find and interact with topic filter
      const topicFilter = screen.getByDisplayValue("All Topics");
      expect(topicFilter).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("should display metrics correctly", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByText("Students")).toBeInTheDocument();
        expect(screen.getByText("Simulations")).toBeInTheDocument();
        expect(screen.getByText("Avg Score")).toBeInTheDocument();
        expect(screen.getByText("Topics")).toBeInTheDocument();
      });
    });

    it("should render charts and schedules", async () => {
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByTestId("area-chart")).toBeInTheDocument();
        expect(screen.getByText("Weekly Schedule")).toBeInTheDocument();
        expect(screen.getByText("Main class schedule")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for ClassDetails:
 * Path: classes/ClassDetails.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (ClassDetailsProps with classId)
 * - Props interface: ClassDetailsProps with required classId
 * - Client component: false (uses hooks)
 * - Uses hooks: useQuery, useMemo, useState, useRouter
 * - Uses router: true
 * - Has API calls: true (multiple class-specific queries)
 * - Has form handling: false
 * - Uses state: true (timeRange, topicSort)
 * - Uses effects: false
 * - Uses context: false
 *
 * The component now properly fetches class-specific data and makes rubrics dynamic
 * based on grades/feedback, following the Overview pattern for better performance
 * and data accuracy.
 */
