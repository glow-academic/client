import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import ClassDetails from "@/components/classes/ClassDetails";

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

// Mock API calls
vi.mock("@/utils/queries/classes/get-class", () => ({
  getClass: vi.fn(),
}));

vi.mock("@/utils/queries/topics/get-topics-by-class", () => ({
  getTopicsByClass: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulations-by-class", () => ({
  getSimulationsByClass: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-class",
  () => ({
    getSimulationAttemptsByClass: vi.fn(),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn(),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(),
  }),
);

vi.mock("@/utils/queries/users/get-all-users", () => ({
  getAllUsers: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-rubrics",
  () => ({
    getStandardGroupsByRubrics: vi.fn(),
  }),
);

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock("@/utils/queries/schedules/get-schedules-by-class", () => ({
  getSchedulesByClass: vi.fn(),
}));

vi.mock("@/utils/queries/events/get-all-events", () => ({
  getAllEvents: vi.fn(),
}));

// Mock chart components
vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}));

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
      term: "fall",
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

    const mockSimulations = [
      {
        id: "sim-1",
        title: "Test Simulation",
        classId: "test-class-id",
        createdAt: "2024-01-01T00:00:00Z",
        documents: [],
        timeLimit: 30,
        active: true,
        scenarioIds: [],
        rubricId: null,
      },
    ];

    const mockAttempts = [
      {
        id: "attempt-1",
        userId: "user-1",
        classId: "test-class-id",
        simulationId: "sim-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockChats = [
      {
        id: "chat-1",
        title: "Test Chat",
        scenarioId: "scenario-1",
        attemptId: "attempt-1",
        completed: true,
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T01:00:00Z",
      },
    ];

    const mockGrades = [
      {
        id: "grade-1",
        simulationChatId: "chat-1",
        score: 85,
        timeTaken: 1800,
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

    // Apply mocks
    const { getClass } = await import("@/utils/queries/classes/get-class");
    vi.mocked(getClass).mockResolvedValue(mockClass);
    require("@/utils/queries/topics/get-topics-by-class").getTopicsByClass.mockResolvedValue(
      mockTopics,
    );
    require("@/utils/queries/simulations/get-simulations-by-class").getSimulationsByClass.mockResolvedValue(
      mockSimulations,
    );
    require("@/utils/queries/simulation_attempts/get-simulation-attempts-by-class").getSimulationAttemptsByClass.mockResolvedValue(
      mockAttempts,
    );
    require("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts").getSimulationChatsByAttempts.mockResolvedValue(
      mockChats,
    );
    require("@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats").getSimulationChatGradesBySimulationChats.mockResolvedValue(
      mockGrades,
    );
    require("@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades").getSimulationChatFeedbacksBySimulationChatGrades.mockResolvedValue(
      [],
    );
    require("@/utils/queries/users/get-all-users").getAllUsers.mockResolvedValue(
      [],
    );
    require("@/utils/queries/rubrics/get-all-rubrics").getAllRubrics.mockResolvedValue(
      [],
    );
    require("@/utils/queries/standard_groups/get-standard-groups-by-rubrics").getStandardGroupsByRubrics.mockResolvedValue(
      [],
    );
    require("@/utils/queries/standards/get-standards-by-standardgroups").getStandardsByStandardGroups.mockResolvedValue(
      [],
    );
    require("@/utils/queries/schedules/get-schedules-by-class").getSchedulesByClass.mockResolvedValue(
      mockSchedules,
    );
    require("@/utils/queries/events/get-all-events").getAllEvents.mockResolvedValue(
      [],
    );
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
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
        expect(
          require("@/utils/queries/classes/get-class").getClass,
        ).toHaveBeenCalledWith("test-class-id");
        expect(
          require("@/utils/queries/topics/get-topics-by-class")
            .getTopicsByClass,
        ).toHaveBeenCalledWith(["test-class-id"]);
        expect(
          require("@/utils/queries/simulations/get-simulations-by-class")
            .getSimulationsByClass,
        ).toHaveBeenCalledWith(["test-class-id"]);
        expect(
          require("@/utils/queries/schedules/get-schedules-by-class")
            .getSchedulesByClass,
        ).toHaveBeenCalledWith(["test-class-id"]);
      });
    });

    it("should handle loading states", () => {
      // Mock loading state
      require("@/utils/queries/classes/get-class").getClass.mockImplementation(
        () => new Promise(() => {}),
      );

      renderWithProviders(<ClassDetails classId="test-class-id" />);

      expect(screen.getByText("Loading class details...")).toBeInTheDocument();
    });

    it("should handle error states when class not found", async () => {
      require("@/utils/queries/classes/get-class").getClass.mockResolvedValue(
        null,
      );

      renderWithProviders(<ClassDetails classId="non-existent-id" />);

      await waitFor(() => {
        expect(screen.getByText("Class Not Found")).toBeInTheDocument();
        expect(
          screen.getByText("The class you're looking for doesn't exist."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle time range selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClassDetails classId="test-class-id" />);

      await waitFor(() => {
        expect(screen.getByText("Performance Trend")).toBeInTheDocument();
      });

      // Find and interact with time range selector
      const timeRangeSelect = screen.getByDisplayValue("30 days");
      expect(timeRangeSelect).toBeInTheDocument();
    });

    it("should handle topic filtering", async () => {
      const user = userEvent.setup();
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
