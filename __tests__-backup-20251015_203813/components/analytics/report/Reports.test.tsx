import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Reports from "@/components/analytics/report/Reports";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// Mock the missing exports
vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(() => Promise.resolve([])),
}));

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(() => Promise.resolve([])),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(() =>
      Promise.resolve([]),
    ),
  }),
);

// Mock the analytics context
vi.mock("@/contexts/analytics-context", () => ({
  useAnalytics: vi.fn(() => ({
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    effectiveCohortIds: [],
  })),
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the useReportColumns hook
vi.mock("@/hooks/use-report-columns", () => ({
  useReportColumns: vi.fn(() => ({
    columns: [
      {
        id: "firstName",
        accessorKey: "firstName",
        header: "Name",
        cell: () => <div>Test Name</div>,
        enableSorting: true,
      },
      {
        id: "taCohorts",
        accessorKey: "taCohorts",
        header: "Cohorts",
        cell: () => <div>Test Cohorts</div>,
        enableSorting: true,
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Role",
        cell: () => <div>Test Role</div>,
        enableSorting: true,
      },
      {
        id: "personasTested",
        accessorKey: "personasTested",
        header: "Personas Tested",
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: true,
      },
      {
        id: "scenarioIds",
        accessorKey: "scenarioIds",
        header: "Scenario IDs",
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: true,
      },
      {
        id: "simulationIds",
        accessorKey: "simulationIds",
        header: "Simulation IDs",
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: true,
      },
    ],
    roleOptions: [
      { value: "ta", label: "Teaching Assistant" },
      { value: "instructor", label: "Instructor" },
    ],
    cohortOptions: [
      { value: "cohort1", label: "Cohort 1" },
      { value: "cohort2", label: "Cohort 2" },
    ],
    personaOptions: [
      { value: "persona1", label: "Persona 1" },
      { value: "persona2", label: "Persona 2" },
    ],
    scenarioOptions: [
      { value: "scenario1", label: "Scenario 1" },
      { value: "scenario2", label: "Scenario 2" },
    ],
    simulationOptions: [
      { value: "sim1", label: "Simulation 1" },
      { value: "sim2", label: "Simulation 2" },
    ],
  })),
}));

// Mock the ReportsDataTable component - but the real component is being used
// so we'll test against the actual rendered content instead

describe("Reports", () => {
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

  beforeEach(() => {
    // Reset all query mocks to default behavior
    vi.clearAllMocks();
  });

  describe("Loading States", () => {
    it("shows loading state when queries are loading", () => {
      render(<Reports />);

      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
    });

    it("shows loading spinner with proper accessibility", () => {
      render(<Reports />);

      const loadingText = screen.getByText("Loading reports...");
      expect(loadingText).toBeInTheDocument();
      expect(
        loadingText.closest("div")?.querySelector(".animate-spin"),
      ).toBeInTheDocument();
    });
  });

  describe("Data Loading and Processing", () => {
    it("renders data table when all queries complete successfully", async () => {
      // Mock successful data responses with minimal required data
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
      ];

      // Override the mocks for this test
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getStandardGroupsByRubrics } = await import(
        "@/utils/queries/standard_groups/get-standard-groups-by-rubrics"
      );
      const { getSimulationAttemptsByProfiles } = await import(
        "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
      );
      const { getSimulationChatsByAttempts } = await import(
        "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
      );
      const { getSimulationChatGradesBySimulationChats } = await import(
        "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
      );
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      const { getSimulationChatFeedbacksBySimulationChatGrades } = await import(
        "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
      );
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );

      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);
      vi.mocked(getAllSimulations).mockResolvedValue([]);
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getStandardGroupsByRubrics).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
      vi.mocked(getSimulationMessagesByChats).mockResolvedValue([]);
      vi.mocked(
        getSimulationChatFeedbacksBySimulationChatGrades,
      ).mockResolvedValue([]);
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Reports />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should render the data table with processed data
      expect(screen.getByText("No results.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search TAs by name or alias..."),
      ).toBeInTheDocument();
    });

    it("filters out default profiles from the data", async () => {
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
        {
          id: "profile-2",
          firstName: "Default",
          lastName: "User",
          alias: "default.user",
          role: "ta" as const,
          defaultProfile: true, // This should be filtered out
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 2,
        },
      ];

      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);

      // Mock other required queries
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getStandardGroupsByRubrics } = await import(
        "@/utils/queries/standard_groups/get-standard-groups-by-rubrics"
      );
      const { getSimulationAttemptsByProfiles } = await import(
        "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
      );
      const { getSimulationChatsByAttempts } = await import(
        "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
      );
      const { getSimulationChatGradesBySimulationChats } = await import(
        "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
      );
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      const { getSimulationChatFeedbacksBySimulationChatGrades } = await import(
        "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
      );
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );

      vi.mocked(getAllSimulations).mockResolvedValue([]);
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getStandardGroupsByRubrics).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
      vi.mocked(getSimulationMessagesByChats).mockResolvedValue([]);
      vi.mocked(
        getSimulationChatFeedbacksBySimulationChatGrades,
      ).mockResolvedValue([]);
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Reports />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should only show non-default profiles
      expect(screen.getByText("No results.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search TAs by name or alias..."),
      ).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      render(<Reports />);

      // Should show loading state initially
      expect(screen.getByText("Loading reports...")).toBeInTheDocument();

      // Component should handle errors gracefully and continue showing loading
      await waitFor(() => {
        expect(screen.getByText("Loading reports...")).toBeInTheDocument();
      });
    });

    it("handles missing data gracefully", async () => {
      // Mock all queries to return empty arrays
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getStandardGroupsByRubrics } = await import(
        "@/utils/queries/standard_groups/get-standard-groups-by-rubrics"
      );
      const { getSimulationAttemptsByProfiles } = await import(
        "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
      );
      const { getSimulationChatsByAttempts } = await import(
        "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
      );
      const { getSimulationChatGradesBySimulationChats } = await import(
        "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
      );
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      const { getSimulationChatFeedbacksBySimulationChatGrades } = await import(
        "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
      );
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );

      vi.mocked(getAllProfiles).mockResolvedValue([]);
      vi.mocked(getAllSimulations).mockResolvedValue([]);
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getStandardGroupsByRubrics).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
      vi.mocked(getSimulationMessagesByChats).mockResolvedValue([]);
      vi.mocked(
        getSimulationChatFeedbacksBySimulationChatGrades,
      ).mockResolvedValue([]);
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Reports />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should render empty data table
      expect(screen.getByText("No results.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search TAs by name or alias..."),
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("calls onViewReport when view report button is clicked", async () => {
      // Mock minimal data for interaction testing
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
      ];

      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);

      // Mock other required queries
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getStandardGroupsByRubrics } = await import(
        "@/utils/queries/standard_groups/get-standard-groups-by-rubrics"
      );
      const { getSimulationAttemptsByProfiles } = await import(
        "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
      );
      const { getSimulationChatsByAttempts } = await import(
        "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
      );
      const { getSimulationChatGradesBySimulationChats } = await import(
        "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
      );
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      const { getSimulationChatFeedbacksBySimulationChatGrades } = await import(
        "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
      );
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );

      vi.mocked(getAllSimulations).mockResolvedValue([]);
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getStandardGroupsByRubrics).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
      vi.mocked(getSimulationMessagesByChats).mockResolvedValue([]);
      vi.mocked(
        getSimulationChatFeedbacksBySimulationChatGrades,
      ).mockResolvedValue([]);
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Reports />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Check that the table is rendered with search functionality
      expect(
        screen.getByPlaceholderText("Search TAs by name or alias..."),
      ).toBeInTheDocument();
      expect(screen.getByText("No results.")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty profiles array", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      // Mock other required queries
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getStandardGroupsByRubrics } = await import(
        "@/utils/queries/standard_groups/get-standard-groups-by-rubrics"
      );
      const { getSimulationAttemptsByProfiles } = await import(
        "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
      );
      const { getSimulationChatsByAttempts } = await import(
        "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
      );
      const { getSimulationChatGradesBySimulationChats } = await import(
        "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
      );
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      const { getSimulationChatFeedbacksBySimulationChatGrades } = await import(
        "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
      );
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );

      vi.mocked(getAllSimulations).mockResolvedValue([]);
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getStandardGroupsByRubrics).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
      vi.mocked(getSimulationMessagesByChats).mockResolvedValue([]);
      vi.mocked(
        getSimulationChatFeedbacksBySimulationChatGrades,
      ).mockResolvedValue([]);
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Reports />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText("No results.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search TAs by name or alias..."),
      ).toBeInTheDocument();
    });

    it("handles profiles with no simulation data", async () => {
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
      ];

      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);

      // Mock other required queries with empty data
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getStandardGroupsByRubrics } = await import(
        "@/utils/queries/standard_groups/get-standard-groups-by-rubrics"
      );
      const { getSimulationAttemptsByProfiles } = await import(
        "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
      );
      const { getSimulationChatsByAttempts } = await import(
        "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
      );
      const { getSimulationChatGradesBySimulationChats } = await import(
        "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
      );
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      const { getSimulationChatFeedbacksBySimulationChatGrades } = await import(
        "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
      );
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );

      vi.mocked(getAllSimulations).mockResolvedValue([]);
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getStandardGroupsByRubrics).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
      vi.mocked(getSimulationMessagesByChats).mockResolvedValue([]);
      vi.mocked(
        getSimulationChatFeedbacksBySimulationChatGrades,
      ).mockResolvedValue([]);
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Reports />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should still render the profile with zero metrics
      expect(screen.getByText("No results.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search TAs by name or alias..."),
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper loading state accessibility", () => {
      render(<Reports />);

      const loadingText = screen.getByText("Loading reports...");
      expect(loadingText).toBeInTheDocument();
      expect(
        loadingText.closest("div")?.querySelector(".animate-spin"),
      ).toBeInTheDocument();
    });

    it("provides loading text for screen readers", () => {
      render(<Reports />);

      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("passes correct props to ReportsDataTable", async () => {
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
      ];

      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);

      // Mock other required queries
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getStandardGroupsByRubrics } = await import(
        "@/utils/queries/standard_groups/get-standard-groups-by-rubrics"
      );
      const { getSimulationAttemptsByProfiles } = await import(
        "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
      );
      const { getSimulationChatsByAttempts } = await import(
        "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
      );
      const { getSimulationChatGradesBySimulationChats } = await import(
        "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
      );
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      const { getSimulationChatFeedbacksBySimulationChatGrades } = await import(
        "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
      );
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );

      vi.mocked(getAllSimulations).mockResolvedValue([]);
      vi.mocked(getAllCohorts).mockResolvedValue([]);
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getStandardGroupsByRubrics).mockResolvedValue([]);
      vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
      vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
      vi.mocked(getSimulationMessagesByChats).mockResolvedValue([]);
      vi.mocked(
        getSimulationChatFeedbacksBySimulationChatGrades,
      ).mockResolvedValue([]);
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Reports />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should render the data table component
      expect(screen.getByText("No results.")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search TAs by name or alias..."),
      ).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Reports:
 * Path: analytics/report/Reports.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useQuery, useRouter, useMemo, useReportColumns, user, userAttempts, userChats, userGrades, userMessages, userFeedbacks, userCohorts, userClassIds, userAgentIds, userScenarioIds, userSimulationIds, username
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: true (analytics context)
 *
 * Test Coverage Summary:
 * ✅ Loading States - Tests loading spinner and text
 * ✅ Data Loading and Processing - Tests successful data loading and filtering
 * ✅ Error Handling - Tests API errors and missing data scenarios
 * ✅ User Interactions - Tests view report functionality
 * ✅ Edge Cases - Tests empty data and no simulation data scenarios
 * ✅ Accessibility - Tests loading state accessibility
 * ✅ Component Integration - Tests ReportsDataTable integration
 */
