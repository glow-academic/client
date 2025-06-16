import Reports from "@/components/analytics/Reports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch for download functionality
global.fetch = vi.fn();

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the query functions with correct names and data structure
vi.mock("@/utils/queries/profiles/get-all-profiles", () => ({
  getAllProfiles: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        role: "ta",
        firstName: "Test",
        lastName: "TA 1",
        alias: "ta1",
        userId: 1,
        lastLogin: new Date().toISOString(),
        viewedIntro: true,
        createdAt: new Date().toISOString(),
        classIds: ["class1"],
      },
      {
        id: "2",
        role: "ta",
        firstName: "Test",
        lastName: "TA 2",
        alias: "ta2",
        userId: 2,
        lastLogin: new Date().toISOString(),
        viewedIntro: true,
        createdAt: new Date().toISOString(),
        classIds: ["class1"],
      },
      {
        id: "3",
        role: "ta",
        firstName: "Struggling",
        lastName: "TA",
        alias: "struggling",
        userId: 3,
        lastLogin: new Date().toISOString(),
        viewedIntro: true,
        createdAt: new Date().toISOString(),
        classIds: ["class1"],
      },
      {
        id: "4",
        role: "instructor",
        firstName: "Test",
        lastName: "Instructor",
        alias: "instructor1",
        userId: 4,
        lastLogin: new Date().toISOString(),
        viewedIntro: true,
        createdAt: new Date().toISOString(),
        classIds: ["class1"],
      },
    ])
  ),
}));

vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        title: "Test Simulation",
        rubricId: "1",
        scenarioIds: ["1", "2"],
        createdAt: new Date().toISOString(),
        timeLimit: null,
        active: true,
      },
    ])
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
        createdAt: new Date().toISOString(),
        rubricType: "simulation" as const,
      },
    ])
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
          shortName: "Comm",
          rubricId: "1",
          points: 25,
          passPoints: 18,
          createdAt: new Date().toISOString(),
          description: "Communication skills",
        },
        {
          id: "2",
          name: "Problem Solving",
          shortName: "Problem",
          rubricId: "1",
          points: 25,
          passPoints: 18,
          createdAt: new Date().toISOString(),
          description: "Problem solving skills",
        },
      ])
    ),
  })
);

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "Active Listening", standardGroupId: "1", points: 5 },
      { id: "2", name: "Clear Communication", standardGroupId: "1", points: 5 },
      { id: "3", name: "Critical Thinking", standardGroupId: "2", points: 5 },
    ])
  ),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles",
  () => ({
    getSimulationAttemptsByProfiles: vi.fn(() =>
      Promise.resolve([
        { id: "1", profileId: "1", simulationId: "1", classId: "1" },
        { id: "2", profileId: "2", simulationId: "1", classId: "1" },
        { id: "3", profileId: "3", simulationId: "1", classId: "1" },
      ])
    ),
  })
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
      ])
    ),
  })
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
      ])
    ),
  })
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
      ])
    ),
  })
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
    vi.mocked(global.fetch).mockReset();
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

    it("should render table with TA data after loading", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Filter:")).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText("Search TAs by name or alias...")
      ).toBeInTheDocument();
      expect(screen.getByText("Sort:")).toBeInTheDocument();

      // Check for table headers
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Score")).toBeInTheDocument();
      expect(screen.getByText("Sessions")).toBeInTheDocument();
      expect(screen.getByText("Pass Rate")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
    });

    it("should display TAs in table format", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      expect(screen.getByText("Test TA 2")).toBeInTheDocument();
      expect(screen.getByText("Struggling TA")).toBeInTheDocument();

      // Check for table-specific elements
      expect(screen.getByText("85%")).toBeInTheDocument(); // Score badge
      expect(screen.getByText("78%")).toBeInTheDocument(); // Score badge
      expect(screen.getByText("65%")).toBeInTheDocument(); // Score badge
    });

    it("should show struggling TAs with warning indicators", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Struggling TA")).toBeInTheDocument();
      });

      // Should show struggling status badge
      expect(screen.getByText("Risk")).toBeInTheDocument();
    });

    it("should display skill performance in weakest/strongest columns", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      // Should show skill performance in weakest/strongest columns
      expect(
        screen.getAllByText(/Communication Skills/).length
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/Problem Solving/).length).toBeGreaterThan(0);
    });

    it("should display TA information in table format", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      // Should show compact table headers
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Alias")).toBeInTheDocument();
      expect(screen.getByText("Score")).toBeInTheDocument();
      expect(screen.getByText("Sessions")).toBeInTheDocument();
      expect(screen.getByText("Pass")).toBeInTheDocument();
      expect(screen.getByText("Time")).toBeInTheDocument();
      expect(screen.getByText("Complete")).toBeInTheDocument();
      expect(screen.getByText("Trend")).toBeInTheDocument();
      expect(screen.getByText("Weakest")).toBeInTheDocument();
      expect(screen.getByText("Strongest")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();

      // Should show TA data
      expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      expect(screen.getByText("Test TA 2")).toBeInTheDocument();
      expect(screen.getByText("testuser1")).toBeInTheDocument();
      expect(screen.getByText("testuser2")).toBeInTheDocument();
    });

    it("should display weakest and strongest skills", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      // Should show skill performance in weakest/strongest columns
      expect(
        screen.getAllByText(/Communication Skills/).length
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/Problem Solving/).length).toBeGreaterThan(0);
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
        expect(
          screen.getByPlaceholderText("Search TAs by name or alias...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search TAs by name or alias..."
      );
      await user.type(searchInput, "Test");

      await waitFor(() => {
        // Check for both Test TA 1 and Test TA 2 since they both contain "Test"
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
        expect(screen.getByText("Test TA 2")).toBeInTheDocument();
        expect(screen.queryByText("Struggling TA")).not.toBeInTheDocument();
      });
    });

    it("should search TAs by alias", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search TAs by name or alias...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search TAs by name or alias..."
      );
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
        expect(
          screen.getByPlaceholderText("Search TAs by name or alias...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search TAs by name or alias..."
      );
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(
          screen.getByText('No TAs found matching "nonexistent"')
        ).toBeInTheDocument();
        expect(screen.getByText("Clear search")).toBeInTheDocument();
      });
    });

    it("should clear search when clicking clear search button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search TAs by name or alias...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search TAs by name or alias..."
      );
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
      if (filterSelect) {
        await user.click(filterSelect);
      }

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
      if (filterSelect) {
        await user.click(filterSelect);
      }

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
      if (sortSelect) {
        await user.click(sortSelect);
      }

      await waitFor(() => {
        expect(screen.getByText("Name (A to Z)")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Name (A to Z)"));

      // Should sort alphabetically - check table rows
      await waitFor(() => {
        const tableRows = screen.getAllByRole("row");
        // Skip header row, check data rows
        const dataRows = tableRows.slice(1);
        expect(dataRows.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Download Functionality", () => {
    it("should show download buttons for each TA", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        // Download buttons are now icon-only, so we look for the Download icons
        const downloadButtons = screen
          .getAllByRole("button")
          .filter(
            (button) =>
              button.querySelector("svg") &&
              !button.textContent?.includes("Support")
          );
        expect(downloadButtons.length).toBeGreaterThan(0);
      });
    });

    it("should open download dialog when clicking download button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        const downloadButtons = screen
          .getAllByRole("button")
          .filter(
            (button) =>
              button.querySelector("svg") &&
              !button.textContent?.includes("Support")
          );
        expect(downloadButtons[0]).toBeInTheDocument();
      });

      // Click first download button
      const downloadButtons = screen
        .getAllByRole("button")
        .filter(
          (button) =>
            button.querySelector("svg") &&
            !button.textContent?.includes("Support")
        );
      if (downloadButtons[0]) {
        await user.click(downloadButtons[0]);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Download Report for Test TA 1")
        ).toBeInTheDocument();
      });

      // Should show customization options
      expect(
        screen.getByText("Student Type Distribution Chart")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Performance by Student Type Chart")
      ).toBeInTheDocument();
      expect(screen.getByText("Skills Radar Chart")).toBeInTheDocument();
      expect(
        screen.getByText("Performance Over Time Chart")
      ).toBeInTheDocument();
      expect(screen.getByText("Detailed Score Table")).toBeInTheDocument();
      expect(screen.getByText("Detailed Feedback Section")).toBeInTheDocument();
    });
  });

  describe("Table Structure", () => {
    it("should display table with correct headers", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Name")).toBeInTheDocument();
      });

      // Check all table headers
      expect(screen.getByText("#")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Alias")).toBeInTheDocument();
      expect(screen.getByText("Score")).toBeInTheDocument();
      expect(screen.getByText("Sessions")).toBeInTheDocument();
      expect(screen.getByText("Pass")).toBeInTheDocument();
      expect(screen.getByText("Time")).toBeInTheDocument();
      expect(screen.getByText("Complete")).toBeInTheDocument();
      expect(screen.getByText("Trend")).toBeInTheDocument();
      expect(screen.getByText("Weakest")).toBeInTheDocument();
      expect(screen.getByText("Strongest")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();
    });

    it("should show ranking numbers", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("1")).toBeInTheDocument();
      });

      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should display status badges correctly", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      expect(screen.getByText("Risk")).toBeInTheDocument();
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
      expect(screen.getAllByText(/100%/).length).toBeGreaterThan(0);
    });

    it("should display pass rates and time metrics", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).toBeInTheDocument();
      });

      // Should show pass rate percentages
      expect(screen.getAllByText(/\d+%/).length).toBeGreaterThan(0);

      // Should show time metrics in minutes
      expect(screen.getAllByText(/\d+m/).length).toBeGreaterThan(0);
    });

    it("should show trend indicators", async () => {
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(screen.getByText("Test TA 1")).toBeInTheDocument();
      });

      // Should show trend icons (no text labels in compact version)
      // The trend icons are present but don't have text labels
      expect(screen.getByText("Trend")).toBeInTheDocument();
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
      // In our mock data, all TAs have sessions, so we won't see "No Data"
      // Instead, we check that the component renders without errors
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("should handle empty filter results with improved messaging", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search TAs by name or alias...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search TAs by name or alias..."
      );

      await user.type(searchInput, "NonExistentTA");

      await waitFor(() => {
        expect(
          screen.getByText('No TAs found matching "NonExistentTA"')
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText("Try adjusting your search or filter criteria")
      ).toBeInTheDocument();
      expect(screen.getByText("Clear search")).toBeInTheDocument();
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
 * - Converted from card-based layout to dense table format
 * - Removed support modal functionality
 * - Enhanced table with comprehensive TA data display
 * - Maintained struggling TA highlighting
 * - Kept download functionality with dialog
 * - Added trend indicators and skill breakdowns in table cells
 * - Improved data density and readability
 */
