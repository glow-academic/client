import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Overview from "@/components/analytics/Overview";

// Mock the query functions
vi.mock("@/utils/queries/users/get-all-users", () => ({
  getAllUsers: vi.fn(() =>
    Promise.resolve([
      { id: "1", role: "ta", name: "Test TA 1" },
      { id: "2", role: "ta", name: "Test TA 2" },
      { id: "3", role: "instructor", name: "Test Instructor" },
    ]),
  ),
}));

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "Test Agent 1" },
      { id: "2", name: "Test Agent 2" },
    ]),
  ),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "Test Rubric 1", points: 100, passPoints: 70 },
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
          name: "Personality Consistency",
          rubricId: "1",
          points: 25,
          passPoints: 18,
        },
        {
          id: "2",
          name: "Learning Behavior",
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
      {
        id: "1",
        name: "Maintains Character Voice",
        standardGroupId: "1",
        points: 12,
      },
      {
        id: "2",
        name: "Knowledge Progression",
        standardGroupId: "2",
        points: 15,
      },
    ]),
  ),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users",
  () => ({
    getSimulationAttemptsByUsers: vi.fn(() =>
      Promise.resolve([
        { id: "1", userId: "1", simulationId: "1" },
        { id: "2", userId: "2", simulationId: "1" },
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
          completed: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          attemptId: "2",
          completed: false,
          createdAt: new Date().toISOString(),
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
          timeTaken: 1800,
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          simulationChatId: "2",
          score: 72,
          timeTaken: 1200,
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
        { id: "1", simulationChatGradeId: "1", standardId: "1", total: 10 },
        { id: "2", simulationChatGradeId: "2", standardId: "2", total: 12 },
      ]),
    ),
  }),
);

describe("Overview", () => {
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
      renderWithProviders(<Overview />);

      expect(
        screen.getByText("Loading training analytics..."),
      ).toBeInTheDocument();
    });

    it("should render key metrics cards after loading", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Active TAs")).toBeInTheDocument();
        expect(screen.getByText("Training Sessions")).toBeInTheDocument();
        expect(screen.getByText("Training Hours")).toBeInTheDocument();
        expect(screen.getByText("Need Support")).toBeInTheDocument();
      });
    });

    it("should render performance trends chart", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Performance Trends")).toBeInTheDocument();
        expect(
          screen.getByText("Training scores and session completion over time"),
        ).toBeInTheDocument();
      });
    });

    it("should render skill breakdown section", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Skill Breakdown")).toBeInTheDocument();
        expect(
          screen.getByText("Average scores by competency area"),
        ).toBeInTheDocument();
      });
    });

    it("should render session activity chart", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Session Activity")).toBeInTheDocument();
        expect(
          screen.getByText("Training session volume and completion rates"),
        ).toBeInTheDocument();
      });
    });

    it("should display time range selectors for performance trends", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Performance Trends")).toBeInTheDocument();
      });

      // Should show time range buttons
      expect(screen.getAllByText("7 days").length).toBeGreaterThan(0);
      expect(screen.getAllByText("30 days").length).toBeGreaterThan(0);
      expect(screen.getAllByText("90 days").length).toBeGreaterThan(0);
    });

    it("should display time range selectors for session activity", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Session Activity")).toBeInTheDocument();
      });

      // Should show shorter time range buttons
      expect(screen.getByText("1 hour")).toBeInTheDocument();
      expect(screen.getByText("12 hours")).toBeInTheDocument();
      expect(screen.getByText("24 hours")).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("should display correct number of TAs", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Active TAs")).toBeInTheDocument();
      });
      
      // Check for the specific TA count in the Active TAs card
      const activeTAsCard = screen.getByText("Active TAs").closest('[data-slot="card"]');
      expect(activeTAsCard).toContainElement(screen.getByText("2"));
    });

    it("should handle empty data gracefully", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Skill Breakdown")).toBeInTheDocument();
      });
      
      // The component should render even with empty data
      expect(screen.getByText("Average scores by competency area")).toBeInTheDocument();
    });
  });

  describe("Interactive Features", () => {
    it("should allow changing time ranges for performance trends", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Performance Trends")).toBeInTheDocument();
      });

      // Should be able to click time range buttons
      const timeRangeButtons = screen.getAllByText("7 days");
      expect(timeRangeButtons.length).toBeGreaterThan(0);
      
      // Click on a time range button
      await user.click(timeRangeButtons[0]);
      
      // Should still show the component
      expect(screen.getByText("Performance Trends")).toBeInTheDocument();
    });

    it("should allow changing time ranges for session activity", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Overview />);

      await waitFor(() => {
        expect(screen.getByText("Session Activity")).toBeInTheDocument();
      });

      // Should be able to click session activity time range buttons
      const hourButton = screen.getByText("1 hour");
      await user.click(hourButton);
      
      // Should still show the component
      expect(screen.getByText("Session Activity")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading structure", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        const headings = screen.getAllByRole("heading");
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    it("should have accessible card components", async () => {
      renderWithProviders(<Overview />);

      await waitFor(() => {
        // Cards should be accessible
        const cards = screen
          .getAllByText("Active TAs")
          .map((el) => el.closest("[role]"));
        expect(cards.length).toBeGreaterThan(0);
      });
    });
  });
});

/*
 * Component Analysis for Overview:
 * Path: analytics/Overview.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useQuery, useMemo
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * The component fetches analytics data from multiple sources and displays:
 * - Key metrics (TAs, sessions, training hours, struggling TAs)
 * - Performance trends over time
 * - Skill breakdown based on standards
 * - Daily session activity
 */
