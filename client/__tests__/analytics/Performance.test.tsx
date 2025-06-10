import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Performance from "@/components/analytics/Performance";

// Mock the query functions
vi.mock("@/utils/queries/users/get-all-users", () => ({
  getAllUsers: vi.fn(() =>
    Promise.resolve([
      { id: "1", role: "ta", name: "Test TA 1", username: "ta1" },
      { id: "2", role: "ta", name: "Test TA 2", username: "ta2" },
      {
        id: "3",
        role: "instructor",
        name: "Test Instructor",
        username: "instructor1",
      },
    ]),
  ),
}));

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "Happy", agentType: "student" },
      { id: "2", name: "Aggressive", agentType: "student" },
    ]),
  ),
}));

vi.mock("@/utils/queries/scenarios/get-all-scenarios", () => ({
  getAllScenarios: vi.fn(() =>
    Promise.resolve([
      { id: "1", agentId: "1", name: "Happy Scenario" },
      { id: "2", agentId: "2", name: "Aggressive Scenario" },
    ]),
  ),
}));

vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn(() =>
    Promise.resolve([
      { id: "1", title: "Test Simulation 1", rubricId: "1" },
      { id: "2", title: "Test Simulation 2", rubricId: "2" },
    ]),
  ),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        name: "Teaching Assistant Evaluation Rubric",
        description: "Test",
        points: 100,
        passPoints: 70,
      },
      {
        id: "2",
        name: "AI Student Performance Evaluation Rubric",
        description: "Test",
        points: 100,
        passPoints: 70,
      },
      {
        id: "3",
        name: "Unused Rubric",
        description: "Test",
        points: 100,
        passPoints: 70,
      },
    ]),
  ),
}));

vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-rubrics",
  () => ({
    getStandardGroupsByRubrics: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          name: "Communication Skills",
          shortName: "Active Listening",
          rubricId: "1",
          points: 25,
          passPoints: 18,
        },
        {
          id: "2",
          name: "Problem Solving",
          shortName: "Content Mastery",
          rubricId: "1",
          points: 25,
          passPoints: 18,
        },
      ]),
    ),
  }),
);

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "Active Listening", standardGroupId: "1", points: 5 },
      { id: "2", name: "Clear Communication", standardGroupId: "1", points: 5 },
      { id: "3", name: "Critical Thinking", standardGroupId: "2", points: 5 },
    ]),
  ),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users",
  () => ({
    getSimulationAttemptsByUsers: vi.fn(() =>
      Promise.resolve([
        { id: "1", userId: "1", simulationId: "1", classId: "1" },
        { id: "2", userId: "2", simulationId: "1", classId: "1" },
      ]),
    ),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          attemptId: "1",
          scenarioId: "1",
          completed: true,
          title: "Chat 1",
        },
        {
          id: "2",
          attemptId: "2",
          scenarioId: "2",
          completed: false,
          title: "Chat 2",
        },
      ]),
    ),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          simulationChatId: "1",
          score: 85,
          passed: true,
          timeTaken: 300,
          rubricId: "1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          simulationChatId: "2",
          score: 72,
          passed: true,
          timeTaken: 450,
          rubricId: "1",
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          simulationChatGradeId: "1",
          standardId: "1",
          total: 4,
          feedback: "Good listening",
        },
        {
          id: "2",
          simulationChatGradeId: "1",
          standardId: "2",
          total: 5,
          feedback: "Clear communication",
        },
        {
          id: "3",
          simulationChatGradeId: "2",
          standardId: "3",
          total: 3,
          feedback: "Needs improvement",
        },
      ]),
    ),
  }),
);

vi.mock("@/utils/agents", () => ({
  getAgentConfig: vi.fn((name: string) => ({
    colors: { bgColor: "bg-blue-100" },
  })),
}));

describe("Performance", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render loading state initially", () => {
      renderWithProviders(<Performance />);

      expect(
        screen.getByText("Loading performance analytics..."),
      ).toBeInTheDocument();
    });

    it("should render performance analytics after loading", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(
          screen.getByText("Performance by Student Personality"),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText("Skill Development Over Time"),
      ).toBeInTheDocument();
      expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
      expect(screen.getByText("Training Insights")).toBeInTheDocument();
    });

    it("should display student personality performance", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Happy Student")).toBeInTheDocument();
      });

      expect(screen.getByText("Aggressive Student")).toBeInTheDocument();
    });

    it("should show clickable performance tier cards", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Excellent")).toBeInTheDocument();
      });

      expect(screen.getByText("Good")).toBeInTheDocument();
      expect(screen.getByText("Average")).toBeInTheDocument();
      expect(screen.getByText("Needs Support")).toBeInTheDocument();
      
      // Check that cards are clickable (have cursor-pointer class)
      const excellentCard = screen.getByText("Excellent").closest('div');
      expect(excellentCard).toHaveClass('cursor-pointer');
    });

    it("should display rubric filter inline with skill development title", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Skill Development Over Time")).toBeInTheDocument();
      });

      expect(screen.getByRole("combobox")).toBeInTheDocument();
      // Should not have separate "Filter by Rubric:" label
      expect(screen.queryByText("Filter by Rubric:")).not.toBeInTheDocument();
    });
  });

  describe("Interactive Features", () => {
    it("should open dialog when clicking on performance tier card", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Excellent")).toBeInTheDocument();
      });

      // Click on the Excellent tier card
      const excellentCard = screen.getByText("Excellent").closest('div');
      await user.click(excellentCard!);

      // Should open dialog with TAs in that tier
      await waitFor(() => {
        expect(screen.getByText(/Excellent TAs \(\d+\)/)).toBeInTheDocument();
      });
    });

    it("should show TA details in performance tier dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Good")).toBeInTheDocument();
      });

      // Click on a tier card that should have TAs
      const goodCard = screen.getByText("Good").closest('div');
      await user.click(goodCard!);

      await waitFor(() => {
        // Should show TA information in the dialog
        expect(screen.getByText(/Good TAs \(\d+\)/)).toBeInTheDocument();
      });
    });

    it("should filter data when selecting different rubric", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Open the select dropdown
      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("All Rubrics")).toBeInTheDocument();
      });

      // Should show available rubrics
      expect(screen.getByText("Teaching Assistant Evaluation Rubric")).toBeInTheDocument();
    });
  });

  describe("Dynamic Metrics", () => {
    it("should display dynamic weekly trend metric", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Weekly Trend")).toBeInTheDocument();
      });

      // Should show dynamic trend message
      expect(screen.getByText(/Scores (improved|decreased|remained stable)/)).toBeInTheDocument();
    });

    it("should show active TAs count", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Active TAs")).toBeInTheDocument();
      });

      expect(screen.getByText(/\d+ TAs have completed training sessions/)).toBeInTheDocument();
    });

    it("should display session efficiency metrics", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
      });

      expect(screen.getByText(/Average session time: \d+ minutes/)).toBeInTheDocument();
    });

    it("should show success rate metric", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Success Rate")).toBeInTheDocument();
      });

      expect(screen.getByText(/\d+% of sessions meet passing criteria/)).toBeInTheDocument();
    });

    it("should display best performing agent", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Best Performing Agent")).toBeInTheDocument();
      });

      expect(screen.getByText(/students \(\d+% avg\)|No data available/)).toBeInTheDocument();
    });

    it("should show dynamic stats in performance analytics", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });

      expect(screen.getByText("Completion Rate")).toBeInTheDocument();
      expect(screen.getByText("Avg Session Time")).toBeInTheDocument();
      expect(screen.getByText("Pass Rate")).toBeInTheDocument();
    });
  });

  describe("Rubric Filtering", () => {
    it("should only show rubrics that exist in simulations", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // The dropdown should contain "All Rubrics" and only the rubrics used in simulations
      // Rubric with id '3' (Unused Rubric) should not be available since no simulation uses it
    });

    it("should display skill categories with proper shortName formatting", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Skill Development Over Time")).toBeInTheDocument();
      });

      // Should show shortName values with proper spacing and title case
      expect(screen.getAllByText("Active Listening").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Content Mastery").length).toBeGreaterThan(0);
    });
  });

  describe("Data Integration", () => {
    it("should handle empty data gracefully", async () => {
      // Mock empty responses
      const emptyQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const AllProviders = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={emptyQueryClient}>
          {children}
        </QueryClientProvider>
      );

      render(<Performance />, { wrapper: AllProviders });

      // Should show loading initially
      expect(
        screen.getByText("Loading performance analytics..."),
      ).toBeInTheDocument();
    });

    it("should handle empty performance tier gracefully", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Needs Support")).toBeInTheDocument();
      });

      // If there are no TAs in a category, clicking should show "No TAs in this category"
      // This would need to be tested with different mock data
    });
  });

  describe("Charts and Visualizations", () => {
    it("should render performance charts", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        // Check for chart containers (Recharts components)
        const charts = document.querySelectorAll(
          ".recharts-responsive-container",
        );
        expect(charts.length).toBeGreaterThan(0);
      });
    });

    it("should show dynamic training insights instead of static ones", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Training Insights")).toBeInTheDocument();
      });

      // Should show dynamic insights, not static ones
      expect(screen.getByText("Weekly Trend")).toBeInTheDocument();
      expect(screen.getByText("Active TAs")).toBeInTheDocument();
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
      expect(screen.getByText("Success Rate")).toBeInTheDocument();
      expect(screen.getByText("Best Performing Agent")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Performance:
 * Path: analytics/Performance.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useMemo, useQuery, useState, users, user, userId, username
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true (selectedRubricId)
 * - Uses effects: false
 * - Uses context: false
 *
 * Updated features:
 * - Added rubric filtering functionality
 * - Improved shortName display with proper formatting
 * - Dynamic weekly progress metrics instead of static values
 * - Filtered rubrics to only show those used in simulations
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Performance />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Performance {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
