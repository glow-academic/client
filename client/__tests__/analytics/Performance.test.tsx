/**
 * Performance.test.tsx
 * Test suite for the Performance analytics component
 */

import Performance from "@/components/analytics/Performance";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock all the query functions
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";

vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/agents/get-all-agents");
vi.mock("@/utils/queries/scenarios/get-all-scenarios");
vi.mock("@/utils/queries/simulations/get-all-simulations");
vi.mock("@/utils/queries/rubrics/get-all-rubrics");
vi.mock("@/utils/queries/standard_groups/get-standard-groups-by-rubrics");
vi.mock("@/utils/queries/standards/get-standards-by-standardgroups");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades"
);

// Mock agent config utility
vi.mock("@/utils/agents", () => ({
  getAgentConfig: vi.fn((name) => ({
    colors: {
      bgColor: name === "Confused Student" ? "bg-blue-100" : "bg-green-100",
    },
  })),
}));

// Mock recharts components
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// Mock data
const mockProfiles = [
  {
    id: "profile1",
    userId: 1,
    lastLogin: new Date().toISOString(),
    firstName: "John",
    lastName: "Doe",
    alias: "jdoe",
    viewedIntro: true,
    createdAt: new Date().toISOString(),
    role: "ta" as const,
    classIds: ["class1"],
  },
  {
    id: "profile2",
    userId: 2,
    lastLogin: new Date().toISOString(),
    firstName: "Jane",
    lastName: "Smith",
    alias: "jsmith",
    viewedIntro: true,
    createdAt: new Date().toISOString(),
    role: "ta" as const,
    classIds: ["class1"],
  },
];

const mockAgents = [
  {
    id: "agent1",
    name: "Confused Student",
    agentType: "student" as const,
    subtitle: "Needs help with basics",
    createdAt: new Date().toISOString(),
    description: "Test description",
    systemPrompt: "Test prompt",
    temperature: 0.7,
  },
  {
    id: "agent2",
    name: "Advanced Student",
    agentType: "student" as const,
    subtitle: "Asks complex questions",
    createdAt: new Date().toISOString(),
    description: "Test description",
    systemPrompt: "Test prompt",
    temperature: 0.7,
  },
];

const mockScenarios = [
  {
    id: "scenario1",
    name: "Basic Help",
    agentId: "agent1",
    description: "Student needs basic help",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    classId: "class1",
    crowdedness: null,
    intensity: null,
    seniority: null,
    documents: null,
  },
  {
    id: "scenario2",
    name: "Advanced Questions",
    agentId: "agent2",
    description: "Student asks complex questions",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    classId: "class1",
    crowdedness: null,
    intensity: null,
    seniority: null,
    documents: null,
  },
];

const mockSimulations = [
  {
    id: "simulation1",
    title: "TA Training Simulation",
    rubricId: "rubric1",
    scenarioIds: ["scenario1", "scenario2"],
    createdAt: new Date().toISOString(),
    timeLimit: null,
    active: true,
  },
];

const mockRubrics = [
  {
    id: "rubric1",
    name: "TA Performance Rubric",
    points: 100,
    passPoints: 70,
    createdAt: new Date().toISOString(),
    description: "Test rubric",
    rubricType: "simulation" as const,
  },
];

const mockStandardGroups = [
  {
    id: "group1",
    name: "Communication",
    shortName: "Comm",
    rubricId: "rubric1",
    points: 25,
    createdAt: new Date().toISOString(),
    description: "Communication skills",
    passPoints: 18,
  },
  {
    id: "group2",
    name: "Problem Solving",
    shortName: "Problem",
    rubricId: "rubric1",
    points: 25,
    createdAt: new Date().toISOString(),
    description: "Problem solving skills",
    passPoints: 18,
  },
];

const mockStandards = [
  {
    id: "standard1",
    name: "Clear Communication",
    standardGroupId: "group1",
    points: 5,
    createdAt: new Date().toISOString(),
    description: "Clear communication standard",
  },
  {
    id: "standard2",
    name: "Effective Problem Solving",
    standardGroupId: "group2",
    points: 5,
    createdAt: new Date().toISOString(),
    description: "Problem solving standard",
  },
];

const mockAttempts = [
  {
    id: "attempt1",
    profileId: "profile1",
    simulationId: "simulation1",
    createdAt: new Date().toISOString(),
  },
  {
    id: "attempt2",
    profileId: "profile2",
    simulationId: "simulation1",
    createdAt: new Date().toISOString(),
  },
];

const mockChats = [
  {
    id: "chat1",
    attemptId: "attempt1",
    scenarioId: "scenario1",
    completed: true,
    title: "Chat with Confused Student",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: "chat2",
    attemptId: "attempt2",
    scenarioId: "scenario2",
    completed: true,
    title: "Chat with Advanced Student",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
];

const mockGrades = [
  {
    id: "grade1",
    simulationChatId: "chat1",
    rubricId: "rubric1",
    score: 85,
    passed: true,
    timeTaken: 300,
    createdAt: new Date().toISOString(),
  },
  {
    id: "grade2",
    simulationChatId: "chat2",
    rubricId: "rubric1",
    score: 92,
    passed: true,
    timeTaken: 420,
    createdAt: new Date().toISOString(),
  },
];

const mockFeedbacks = [
  {
    id: "feedback1",
    simulationChatGradeId: "grade1",
    standardId: "standard1",
    total: 4,
    feedback: "Good communication skills",
    createdAt: new Date().toISOString(),
  },
  {
    id: "feedback2",
    simulationChatGradeId: "grade2",
    standardId: "standard2",
    total: 5,
    feedback: "Excellent problem solving",
    createdAt: new Date().toISOString(),
  },
];

describe("Performance Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock all query functions using vi.mocked
    vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);
    vi.mocked(getAllAgents).mockResolvedValue(mockAgents);
    vi.mocked(getAllScenarios).mockResolvedValue(mockScenarios);
    vi.mocked(getAllSimulations).mockResolvedValue(mockSimulations);
    vi.mocked(getAllRubrics).mockResolvedValue(mockRubrics);
    vi.mocked(getStandardGroupsByRubrics).mockResolvedValue(mockStandardGroups);
    vi.mocked(getStandardsByStandardGroups).mockResolvedValue(mockStandards);
    vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue(mockAttempts);
    vi.mocked(getSimulationChatsByAttempts).mockResolvedValue(mockChats);
    vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue(
      mockGrades
    );
    vi.mocked(
      getSimulationChatFeedbacksBySimulationChatGrades
    ).mockResolvedValue(mockFeedbacks);
  });

  const renderPerformance = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Performance />
      </QueryClientProvider>
    );
  };

  it("renders loading state initially", () => {
    renderPerformance();
    expect(
      screen.getByText("Loading performance analytics...")
    ).toBeInTheDocument();
  });

  it("displays performance analytics when loaded", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Performance by Student Personality")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Skill Development Over Time")).toBeInTheDocument();
    expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
    expect(screen.getByText("Training Insights")).toBeInTheDocument();
  });

  it("displays student personality performance chart", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Performance by Student Personality")
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByText("Confused Student Student")).toBeInTheDocument();
    expect(screen.getByText("Advanced Student Student")).toBeInTheDocument();
  });

  it("displays skill development chart", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Skill Development Over Time")
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("handles time range filtering for personality data", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Performance by Student Personality")
      ).toBeInTheDocument();
    });

    // Find and click 7 days filter
    const timeRangeButtons = screen.getAllByText("7 days");
    if (timeRangeButtons[0]) {
      fireEvent.click(timeRangeButtons[0]);
    }

    // Should update the chart data
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("handles time range filtering for skill data", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Skill Development Over Time")
      ).toBeInTheDocument();
    });

    // Find and click 90 days filter for skill development
    const skillTimeButtons = screen.getAllByText("90 days");
    if (skillTimeButtons[1]) {
      fireEvent.click(skillTimeButtons[1]); // Second one should be for skills
    }

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("handles rubric filtering", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Skill Development Over Time")
      ).toBeInTheDocument();
    });

    // Find and click rubric selector
    const rubricSelect = screen.getByRole("combobox");
    fireEvent.click(rubricSelect);
    fireEvent.click(screen.getByText("TA Performance Rubric"));

    // Should update the data based on selected rubric
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("displays performance distribution tiers", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
    });

    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("Average")).toBeInTheDocument();
    expect(screen.getByText("Needs Support")).toBeInTheDocument();
  });

  it("displays dynamic performance metrics", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
    });

    // Should display calculated metrics
    expect(screen.getByText("89%")).toBeInTheDocument(); // Average score
    expect(screen.getByText("100%")).toBeInTheDocument(); // Completion rate
    expect(screen.getByText("6m")).toBeInTheDocument(); // Avg session time
    expect(screen.getByText("100%")).toBeInTheDocument(); // Pass rate
  });

  it("displays training insights", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Training Insights")).toBeInTheDocument();
    });

    expect(screen.getByText("Weekly Trend")).toBeInTheDocument();
    expect(screen.getByText("Active TAs")).toBeInTheDocument();
    expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("Best Performing Agent")).toBeInTheDocument();
  });

  it("opens TA performance tier dialog", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Excellent")).toBeInTheDocument();
    });

    // Click on excellent tier
    const excellentTier = screen.getByText("Excellent");
    fireEvent.click(excellentTier);

    await waitFor(() => {
      expect(screen.getByText("Excellent TAs")).toBeInTheDocument();
    });
  });

  it("calculates skill categories correctly", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Skill Development Over Time")
      ).toBeInTheDocument();
    });

    // Should display skill categories from standard groups
    expect(screen.getByText("Comm")).toBeInTheDocument();
    expect(screen.getByText("Problem")).toBeInTheDocument();
  });

  it("handles empty data gracefully", async () => {
    // Mock empty data
    vi.mocked(getAllProfiles).mockResolvedValue([]);

    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Performance by Student Personality")
      ).toBeInTheDocument();
    });

    // Should still render charts even with no data
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("displays weekly trend correctly", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Weekly Trend")).toBeInTheDocument();
    });

    // Should show trend information
    expect(screen.getByText(/Scores.*this week/)).toBeInTheDocument();
  });

  it("shows best performing agent", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Best Performing Agent")).toBeInTheDocument();
    });

    // Should display the agent with highest score
    expect(screen.getByText(/Advanced Student.*students/)).toBeInTheDocument();
  });

  it("handles error states gracefully", async () => {
    vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

    renderPerformance();

    // Should show loading state and not crash
    expect(
      screen.getByText("Loading performance analytics...")
    ).toBeInTheDocument();
  });

  it("displays correct time formatting", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Session Efficiency")).toBeInTheDocument();
    });

    // Should display time in minutes format
    expect(screen.getByText("6 minutes")).toBeInTheDocument();
  });

  it("calculates performance tiers correctly", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
    });

    // With mock data (scores 85 and 92), both should be in "Good" tier (80-89) and "Excellent" tier (90-100)
    const excellentSection = screen.getByText("Excellent").closest("div");
    const goodSection = screen.getByText("Good").closest("div");

    if (excellentSection) {
      expect(excellentSection).toContainElement(screen.getByText("1")); // One TA with 92%
    }
    if (goodSection) {
      expect(goodSection).toContainElement(screen.getByText("1")); // One TA with 85%
    }
  });

  it("updates charts when filters change", async () => {
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByText("Performance by Student Personality")
      ).toBeInTheDocument();
    });

    const initialChart = screen.getByTestId("bar-chart");
    expect(initialChart).toBeInTheDocument();

    // Change time range
    const timeRangeButton = screen.getAllByText("7 days")[0];
    if (timeRangeButton) {
      fireEvent.click(timeRangeButton);
    }

    // Chart should still be present (data might change but chart remains)
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});

/*
 * Component Analysis for Performance:
 * Path: analytics/Performance.tsx
 *
 * Updated features:
 * - Moved rubric filter to be inline with "Skill Development Over Time" title
 * - Made performance tier cards clickable with dialogs showing TAs in each category
 * - Replaced static metrics with dynamic ones:
 *   - Weekly trend (improvement/decline)
 *   - Active TAs count
 *   - Session efficiency (avg time)
 *   - Success rate (pass percentage)
 *   - Best performing agent
 *   - Average session time
 *   - Pass rate
 * - Added dialog functionality for viewing TAs by performance tier
 * - Improved layout and user interaction
 *
 * New interactive features:
 * - Clickable performance tier cards
 * - Modal dialogs showing TA details
 * - Inline rubric filtering
 * - Dynamic metric calculations
 */
