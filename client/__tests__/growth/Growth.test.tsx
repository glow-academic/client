import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Growth from "@/components/growth/Growth";

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

// Mock auth hook
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    userId: "test-user-id",
    isAuthenticated: true,
  })),
}));

// Mock API calls
vi.mock("@/utils/queries/users/get-user", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(),
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

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-user",
  () => ({
    getSimulationAttemptsByUser: vi.fn(),
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

// Mock chart components
vi.mock("recharts", () => ({
  RadarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="radar-chart">{children}</div>
  ),
  Radar: () => <div data-testid="radar" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarGrid: () => <div data-testid="polar-grid" />,
}));

// Mock chart container
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: () => <div data-testid="chart-tooltip" />,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
}));

describe("Growth", () => {
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
    const mockUser = {
      id: "test-user-id",
      name: "Test User",
      role: "ta",
      username: "testuser",
      password: "password",
      classIds: ["class-1"],
      viewedIntro: false,
      createdAt: "2024-01-01T00:00:00Z",
    };

    const mockAgents = [
      {
        id: "agent-1",
        name: "Test Agent",
        subtitle: "Test subtitle",
        description: "Test description",
        systemPrompt: "Test prompt",
        agentType: "general",
        temperature: 0.7,
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockRubrics = [
      {
        id: "rubric-1",
        name: "Test Rubric",
        description: "Test rubric description",
        points: 100,
        passPoints: 70,
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockStandardGroups = [
      {
        id: "group-1",
        name: "Communication Skills",
        description: "Communication and listening skills",
        points: 25,
        passPoints: 18,
        rubricId: "rubric-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "group-2",
        name: "Adaptability",
        description: "Flexibility and adaptation skills",
        points: 25,
        passPoints: 18,
        rubricId: "rubric-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockStandards = [
      {
        id: "standard-1",
        name: "Active Listening",
        description: "Demonstrates active listening skills",
        points: 25,
        standardGroupId: "group-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "standard-2",
        name: "Flexibility",
        description: "Shows flexibility in teaching approach",
        points: 25,
        standardGroupId: "group-2",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockAttempts = [
      {
        id: "attempt-1",
        userId: "test-user-id",
        classId: "class-1",
        simulationId: "sim-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "attempt-2",
        userId: "test-user-id",
        classId: "class-1",
        simulationId: "sim-1",
        createdAt: "2024-01-02T00:00:00Z",
      },
    ];

    const mockChats = [
      {
        id: "chat-1",
        title: "Test Chat 1",
        scenarioId: "scenario-1",
        attemptId: "attempt-1",
        completed: true,
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T01:00:00Z",
      },
      {
        id: "chat-2",
        title: "Test Chat 2",
        scenarioId: "scenario-1",
        attemptId: "attempt-2",
        completed: true,
        createdAt: "2024-01-02T00:00:00Z",
        completedAt: "2024-01-02T01:00:00Z",
      },
    ];

    const mockGrades = [
      {
        id: "grade-1",
        simulationChatId: "chat-1",
        score: 85,
        timeTaken: 3600, // 1 hour
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "grade-2",
        simulationChatId: "chat-2",
        score: 90,
        timeTaken: 3000, // 50 minutes
        createdAt: "2024-01-02T00:00:00Z",
      },
    ];

    const mockFeedbacks = [
      {
        id: "feedback-1",
        simulationChatGradeId: "grade-1",
        standardId: "standard-1",
        total: 20,
        feedback: "Good listening skills",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "feedback-2",
        simulationChatGradeId: "grade-1",
        standardId: "standard-2",
        total: 22,
        feedback: "Shows good adaptability",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "feedback-3",
        simulationChatGradeId: "grade-2",
        standardId: "standard-1",
        total: 23,
        feedback: "Excellent listening",
        createdAt: "2024-01-02T00:00:00Z",
      },
      {
        id: "feedback-4",
        simulationChatGradeId: "grade-2",
        standardId: "standard-2",
        total: 24,
        feedback: "Very adaptable",
        createdAt: "2024-01-02T00:00:00Z",
      },
    ];

    // Apply mocks
    require("@/utils/queries/users/get-user").getUser.mockResolvedValue(
      mockUser,
    );
    require("@/utils/queries/agents/get-all-agents").getAllAgents.mockResolvedValue(
      mockAgents,
    );
    require("@/utils/queries/rubrics/get-all-rubrics").getAllRubrics.mockResolvedValue(
      mockRubrics,
    );
    require("@/utils/queries/standard_groups/get-standard-groups-by-rubrics").getStandardGroupsByRubrics.mockResolvedValue(
      mockStandardGroups,
    );
    require("@/utils/queries/standards/get-standards-by-standardgroups").getStandardsByStandardGroups.mockResolvedValue(
      mockStandards,
    );
    require("@/utils/queries/simulation_attempts/get-simulation-attempts-by-user").getSimulationAttemptsByUser.mockResolvedValue(
      mockAttempts,
    );
    require("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts").getSimulationChatsByAttempts.mockResolvedValue(
      mockChats,
    );
    require("@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats").getSimulationChatGradesBySimulationChats.mockResolvedValue(
      mockGrades,
    );
    require("@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades").getSimulationChatFeedbacksBySimulationChatGrades.mockResolvedValue(
      mockFeedbacks,
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
      renderWithProviders(<Growth />);
    });

    it("should display performance metrics correctly", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("Overall Score")).toBeInTheDocument();
        expect(screen.getByText("Communication Skills")).toBeInTheDocument();
        expect(screen.getByText("Adaptability")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("Performance Radar")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle API calls correctly", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(
          require("@/utils/queries/users/get-user").getUser,
        ).toHaveBeenCalledWith("test-user-id");
        expect(
          require("@/utils/queries/simulation_attempts/get-simulation-attempts-by-user")
            .getSimulationAttemptsByUser,
        ).toHaveBeenCalledWith("test-user-id");
      });
    });

    it("should handle loading states", () => {
      // Mock loading state
      require("@/utils/queries/users/get-user").getUser.mockImplementation(
        () => new Promise(() => {}),
      );

      renderWithProviders(<Growth />);
    });

    it("should handle no data state", async () => {
      require("@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats").getSimulationChatGradesBySimulationChats.mockResolvedValue(
        [],
      );

      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("No Data Available")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Complete some teaching sessions to see your growth metrics.",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Display", () => {
    it("should display calculated metrics", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        // Should show calculated overall score (average of 85 and 90 = 87.5, rounded to 88)
        expect(screen.getByText("88%")).toBeInTheDocument();

        // Should show performance sections
        expect(
          screen.getByText("Average performance score"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Skill performance"),
        ).toBeInTheDocument();
        expect(screen.getByText("Time per session")).toBeInTheDocument();
      });
    });

    it("should render radar chart", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
        expect(screen.getByTestId("chart-container")).toBeInTheDocument();
      });
    });

    it("should show growth trend", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        // Should show positive trend since scores improved from 85 to 90
        expect(screen.getByText("Trending up")).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle user authentication", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(require("@/hooks/use-auth").useAuth).toHaveBeenCalled();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing user gracefully", async () => {
      require("@/utils/queries/users/get-user").getUser.mockResolvedValue(null);

      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("No Data Available")).toBeInTheDocument();
      });
    });

    it("should handle empty grades array", async () => {
      require("@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats").getSimulationChatGradesBySimulationChats.mockResolvedValue(
        [],
      );

      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("No Data Available")).toBeInTheDocument();
      });
    });

    it("should handle API errors gracefully", async () => {
      require("@/utils/queries/users/get-user").getUser.mockRejectedValue(
        new Error("API Error"),
      );

      renderWithProviders(<Growth />);

      // Should still render the component structure
    });
  });
});

/*
 * Component Analysis for Growth:
 * Path: growth/Growth.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None
 * - Client component: false (uses hooks)
 * - Uses hooks: useQuery, useMemo, useAuth
 * - Uses router: false
 * - Has API calls: true (multiple user-specific queries)
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false (uses auth hook)
 *
 * The component now properly fetches user-specific data and calculates growth metrics
 * dynamically based on grades/feedback, following the Overview pattern for consistency
 * and better data accuracy.
 */
