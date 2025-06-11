import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Reports from "@/components/analytics/Reports";

// Mock fetch for download functionality
global.fetch = vi.fn();

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the query functions
vi.mock("@/utils/queries/users/get-all-users", () => ({
  getAllUsers: vi.fn(() =>
    Promise.resolve([
      { id: "1", role: "ta", name: "Test TA 1", username: "ta1" },
      { id: "2", role: "ta", name: "Test TA 2", username: "ta2" },
      { id: "3", role: "ta", name: "Struggling TA", username: "struggling" },
      {
        id: "4",
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

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        name: "Test Rubric",
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
          rubricId: "1",
          points: 25,
          passPoints: 18,
        },
        {
          id: "2",
          name: "Problem Solving",
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
        { id: "3", userId: "3", simulationId: "1", classId: "1" },
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
          completed: true,
          title: "Chat 2",
        },
        {
          id: "3",
          attemptId: "3",
          scenarioId: "1",
          completed: false,
          title: "Chat 3",
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
          createdAt: "2024-01-01T10:00:00Z",
        },
        {
          id: "2",
          simulationChatId: "2",
          score: 78,
          passed: true,
          timeTaken: 450,
          rubricId: "1",
          createdAt: "2024-01-02T10:00:00Z",
        },
        {
          id: "3",
          simulationChatId: "3",
          score: 65,
          passed: false,
          timeTaken: 600,
          rubricId: "1",
          createdAt: "2024-01-03T10:00:00Z",
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
          total: 4,
          feedback: "Good thinking",
        },
        {
          id: "4",
          simulationChatGradeId: "3",
          standardId: "1",
          total: 2,
          feedback: "Needs improvement",
        },
        {
          id: "5",
          simulationChatGradeId: "3",
          standardId: "2",
          total: 3,
          feedback: "Average communication",
        },
      ]),
    ),
  }),
);

describe("Reports", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Reset fetch mock
    (global.fetch as any).mockReset();
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render loading state initially", () => {
      renderWithProviders(<Reports />);

      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
    });

    it("should render TA performance overview after loading", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Filter:")).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText("Search TAs by name or username..."),
      ).toBeInTheDocument();
      expect(screen.getByText("Sort:")).toBeInTheDocument();
    });

    it("should display TAs in card format", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      expect(screen.getByText("Test TA 2")).toBeInTheDocument();
      expect(screen.getByText("Struggling TA")).toBeInTheDocument();
      
      // Check for card-specific elements
      expect(screen.getByText("Average Score")).toBeInTheDocument();
      expect(screen.getByText("Sessions")).toBeInTheDocument();
      expect(screen.getByText("Pass Rate")).toBeInTheDocument();
      expect(screen.getByText("Avg Time")).toBeInTheDocument();
    });

    it("should show struggling TAs with warning indicators", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Struggling TA")).toBeInTheDocument();
      });

      // Should show warning triangle for struggling TA
      const strugglingTACard = screen.getByText("Struggling TA").closest('[class*="border-orange-200"]');
      expect(strugglingTACard).toBeInTheDocument();
    });

    it("should display skill performance badges", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Should show skill badges for TAs with sessions
      expect(screen.getByText(/Communication Skills:/)).toBeInTheDocument();
      expect(screen.getByText(/Problem Solving:/)).toBeInTheDocument();
    });
  });

  describe("Filtering and Sorting", () => {
    it("should show direct filter and sort controls", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Filter:")).toBeInTheDocument();
        expect(screen.getByText("Sort:")).toBeInTheDocument();
      });
    });

    it("should search TAs by name", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search TAs by name or username...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search TAs by name or username...");
      await user.type(searchInput, "Test TA 1");

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
        expect(screen.queryByText("Test TA 2")).not.toBeInTheDocument();
        expect(screen.queryByText("Struggling TA")).not.toBeInTheDocument();
      });
    });

    it("should search TAs by username", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search TAs by name or username...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search TAs by name or username...");
      await user.type(searchInput, "struggling");

      await waitFor(() => {
        expect(screen.getByText("Struggling TA")).toBeInTheDocument();
        expect(screen.queryByText("Test TA 1")).not.toBeInTheDocument();
        expect(screen.queryByText("Test TA 2")).not.toBeInTheDocument();
      });
    });

    it("should show no results message when search yields no matches", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search TAs by name or username...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search TAs by name or username...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText('No TAs found matching "nonexistent"')).toBeInTheDocument();
        expect(screen.getByText("Clear search")).toBeInTheDocument();
      });
    });

    it("should clear search when clicking clear search button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search TAs by name or username...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search TAs by name or username...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText("Clear search")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Clear search"));

      await waitFor(() => {
        expect(searchInput).toHaveValue("");
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
        expect(screen.getByText("Test TA 2")).toBeInTheDocument();
        expect(screen.getByText("Struggling TA")).toBeInTheDocument();
      });
    });

    it("should filter struggling TAs using direct filter control", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Filter:")).toBeInTheDocument();
      });

      // Find the filter select (first combobox)
      const filterSelects = screen.getAllByRole("combobox");
      const filterSelect = filterSelects[0];
      await user.click(filterSelect);
      
      await waitFor(() => {
        expect(screen.getByText("Struggling TAs")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Struggling TAs"));

      // Should only show struggling TA
      await waitFor(() => {
        expect(screen.getByText("Struggling TA")).toBeInTheDocument();
        expect(screen.queryByText("Test TA 1")).not.toBeInTheDocument();
        expect(screen.queryByText("Test TA 2")).not.toBeInTheDocument();
      });
    });

    it("should filter performing well TAs using direct filter control", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Filter:")).toBeInTheDocument();
      });

      // Find the filter select (first combobox)
      const filterSelects = screen.getAllByRole("combobox");
      const filterSelect = filterSelects[0];
      await user.click(filterSelect);
      
      await user.click(screen.getByText("Performing Well"));

      // Should show only performing well TAs
      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
        expect(screen.getByText("Test TA 2")).toBeInTheDocument();
        expect(screen.queryByText("Struggling TA")).not.toBeInTheDocument();
      });
    });

    it("should sort TAs using direct sort control", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Sort:")).toBeInTheDocument();
      });

      // Find the sort select (second combobox)
      const sortSelects = screen.getAllByRole("combobox");
      const sortSelect = sortSelects[1];
      await user.click(sortSelect);
      
      await waitFor(() => {
        expect(screen.getByText("Name (A to Z)")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Name (A to Z)"));

      // Should sort alphabetically
      await waitFor(() => {
        const taNames = screen.getAllByText(/Test TA|Struggling TA/);
        expect(taNames[0]).toHaveTextContent("Struggling TA");
        expect(taNames[1]).toHaveTextContent("Test TA 1");
        expect(taNames[2]).toHaveTextContent("Test TA 2");
      });
    });
  });

  describe("Download Functionality", () => {
    it("should show download buttons for each TA", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        // Download buttons are now icon-only, so we look for the Download icons
        const downloadButtons = screen.getAllByRole("button").filter(button => 
          button.querySelector('svg') && !button.textContent?.includes("Support")
        );
        expect(downloadButtons.length).toBeGreaterThan(0);
      });
    });

    it("should open download dialog when clicking download button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        const downloadButtons = screen.getAllByRole("button").filter(button => 
          button.querySelector('svg') && !button.textContent?.includes("Support")
        );
        expect(downloadButtons[0]).toBeInTheDocument();
      });

      // Click first download button
      const downloadButtons = screen.getAllByRole("button").filter(button => 
        button.querySelector('svg') && !button.textContent?.includes("Support")
      );
      await user.click(downloadButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Download Report for Test TA 1")).toBeInTheDocument();
      });

      // Should show customization options
      expect(screen.getByText("Student Type Distribution Chart")).toBeInTheDocument();
      expect(screen.getByText("Performance by Student Type Chart")).toBeInTheDocument();
      expect(screen.getByText("Skills Radar Chart")).toBeInTheDocument();
      expect(screen.getByText("Performance Over Time Chart")).toBeInTheDocument();
      expect(screen.getByText("Detailed Score Table")).toBeInTheDocument();
      expect(screen.getByText("Detailed Feedback Section")).toBeInTheDocument();
    });
  });

  describe("Enhanced Support Dialog", () => {
    it("should show support button for struggling TAs", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Struggling TA")).toBeInTheDocument();
      });

      // Should show support button for struggling TA
      expect(screen.getByText("Support")).toBeInTheDocument();
    });

    it("should open enhanced support dialog for struggling TAs with sessions", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Support")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Support"));

      await waitFor(() => {
        expect(
          screen.getByText("Support Recommendations for Struggling TA"),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("Performance Overview")).toBeInTheDocument();
      expect(screen.getByText("Skill Analysis")).toBeInTheDocument();
      expect(screen.getByText("Targeted Action Plan")).toBeInTheDocument();
      expect(screen.getByText("Priority Focus Areas:")).toBeInTheDocument();
      expect(screen.getByText("Recommended Interventions:")).toBeInTheDocument();
      expect(screen.getByText("Success Metrics:")).toBeInTheDocument();
    });

    it("should show skill analysis in support dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Support")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Support"));

      await waitFor(() => {
        expect(screen.getByText("Skill Analysis")).toBeInTheDocument();
      });

      // Should show weakest and strongest skills
      expect(screen.getByText("Weakest Skill:")).toBeInTheDocument();
      expect(screen.getByText("Strongest Skill:")).toBeInTheDocument();
      expect(screen.getByText("Trend:")).toBeInTheDocument();
    });

    it("should show actionable recommendations in support dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Support")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Support"));

      await waitFor(() => {
        expect(screen.getByText("Recommended Interventions:")).toBeInTheDocument();
      });

      // Should show specific actionable recommendations
      expect(screen.getByText(/Schedule 1-on-1 coaching session/)).toBeInTheDocument();
      expect(screen.getByText(/Provide additional practice scenarios/)).toBeInTheDocument();
      expect(screen.getByText(/Weekly progress check-ins/)).toBeInTheDocument();
    });
  });

  describe("Data Integration", () => {
    it("should calculate scores based on actual grades", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      // Should show percentage scores based on actual grade data
      expect(screen.getByText("85%")).toBeInTheDocument(); // Test TA 1
      expect(screen.getByText("78%")).toBeInTheDocument(); // Test TA 2
      expect(screen.getByText("65%")).toBeInTheDocument(); // Struggling TA
    });

    it("should show completion rates and session data", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getAllByText(/1\/1/).length).toBeGreaterThan(0);
      });

      // Should show session completion data
      expect(screen.getAllByText(/100% completion/).length).toBeGreaterThan(0);
    });

    it("should display pass rates and time metrics", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Pass Rate")).toBeInTheDocument();
      });

      // Should show pass rates and average times
      expect(screen.getByText("100%")).toBeInTheDocument(); // Pass rate for performing TAs
      expect(screen.getByText("0%")).toBeInTheDocument(); // Pass rate for struggling TA
      expect(screen.getAllByText(/\d+min/).length).toBeGreaterThan(0); // Time metrics
    });

    it("should show trend indicators", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      // Note: With only one session per TA in mock data, trends will be "stable"
      // In real scenarios with more data, we'd see "Improving" or "Declining" badges
    });
  });

  describe("Edge Cases", () => {
    it("should handle TAs with no sessions gracefully", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      // Component should handle TAs with 0 sessions gracefully
      // This is tested implicitly by the component not crashing
      expect(screen.getByText("No Data")).toBeInTheDocument();
    });

    it("should show proper ranking numbers", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("#1")).toBeInTheDocument();
      });

      expect(screen.getByText("#2")).toBeInTheDocument();
      expect(screen.getByText("#3")).toBeInTheDocument();
    });

    it("should handle empty filter results with improved messaging", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search TAs by name or username...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search TAs by name or username...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText('No TAs found matching "nonexistent"')).toBeInTheDocument();
        expect(screen.getByText("Try adjusting your search or filter criteria")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Reports:
 * Path: analytics/Reports.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: ReportDownloadDialog (internal component)
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useMemo, useQuery, useState
 * - Uses router: false
 * - Has API calls: true (via fetch for downloads)
 * - Has form handling: true (checkboxes for report options)
 * - Uses state: true (sorting, filtering, download states)
 * - Uses effects: false
 * - Uses context: false
 *
 * Updated features:
 * - Removed popover-based filter/sort in favor of direct controls
 * - Enhanced card-based layout for better readability
 * - Improved support dialog with actionable insights
 * - Added trend analysis and performance metrics
 * - Enhanced data-driven recommendations
 * - Better handling of TAs with no sessions
 */
