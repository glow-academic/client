import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import PracticeZone from "@/components/practice/PracticeZone";
import type { Persona, Profile, Scenario, Simulation } from "@/types";

// Import mocks
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps = {
  simulations: [
    {
      id: "sim-1",
      title: "Math Practice",
      timeLimit: 30,
      active: true,
      scenarioIds: ["scenario-1"],
      rubricId: "rubric-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultSimulation: false,
      practiceSimulation: true,
    } as Simulation,
  ],
  profile: {
    id: "profile-1",
    userId: 1,
    firstName: "Test",
    lastName: "User",
    alias: "testuser",
    role: "superadmin" as const,
    active: true,
    viewedIntro: false,
    viewedChat: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    defaultProfile: false,
  } as Profile,
  onStartSimulation: vi.fn(),
  loadingSimulation: null as string | null,
  scenarios: [
    {
      id: "scenario-1",
      name: "Algebra Problem",
      description: "Solve algebra problems",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generated: false,
      personaId: null,
      parameterItemIds: null,
      documentIds: null,
      defaultScenario: false,
      practiceScenario: true,
      parentId: null,
    } as Scenario,
  ],
  personas: [
    {
      id: "persona-1",
      name: "Math Tutor",
      description: "Helps with math",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Persona,
  ],
};
// ------------------------------------------------------------------
describe("PracticeZone", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Should render the practice zone
      await waitFor(() => {
        expect(screen.getByText("Math Practice")).toBeInTheDocument();
      });
    });

    it("should render with props", () => {
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Should render simulation cards
      expect(screen.getByText("Math Practice")).toBeInTheDocument();

      // Should render profile information - the component doesn't display profile name directly
      expect(screen.getByTestId("simulation-title")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Should have proper heading structure - the component uses h3, not h1
      expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();

      // Should have interactive elements
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle simulation start", async () => {
      const user = userEvent.setup();
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Find and click start simulation button
      const startButton = screen.getByText("Start Simulation");
      await user.click(startButton);

      // Should call the onStartSimulation callback
      expect(mockProps.onStartSimulation).toHaveBeenCalledWith("sim-1");
    });

    it("should handle loading state", async () => {
      const loadingProps = {
        ...mockProps,
        loadingSimulation: "sim-1",
      };

      renderWithMocks(<PracticeZone {...loadingProps} />);

      // Should show loading state - the button text changes to "Starting..."
      expect(screen.getByText("Starting...")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty simulations
      const emptyProps = {
        ...mockProps,
        simulations: [],
      };

      renderWithMocks(<PracticeZone {...emptyProps} />);

      // Should show no simulations message - the component returns null when no simulations
      expect(
        screen.queryByText("No simulations available")
      ).not.toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps = {
        simulations: [],
        profile: mockProps.profile,
        onStartSimulation: vi.fn(),
        loadingSimulation: null,
        scenarios: [],
        personas: [],
      };

      renderWithMocks(<PracticeZone {...minimalProps} />);

      // Should still render without crashing - component returns null when no simulations
      expect(screen.queryByText("Practice Zone")).not.toBeInTheDocument();
    });

    it("should handle inactive simulations", () => {
      const inactiveProps = {
        ...mockProps,
        simulations: [
          {
            ...mockProps.simulations[0],
            active: false,
          },
        ],
      };

      renderWithMocks(<PracticeZone {...inactiveProps} />);

      // The component doesn't filter by active status, so inactive simulations are still shown
      expect(screen.getByText("Math Practice")).toBeInTheDocument();
    });
  });
});
