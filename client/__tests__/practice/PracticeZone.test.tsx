import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import PracticeZone from "@/components/practice/PracticeZone";

// Define the interface locally since it's not exported
interface PracticeZoneProps {
  simulations: Array<{
    id: string;
    active: boolean;
    title: string;
    createdAt: string;
    updatedAt: string;
    timeLimit: string | null;
    scenarioIds: string[];
    rubricId: string;
  }>;
  profile: {
    id: string;
    userId: number | null;
    firstName: string;
    lastName: string;
    alias: string;
    role: "ta" | "superadmin" | "admin" | "instructional" | "guest";
    active: boolean;
    viewedIntro: boolean;
    viewedChat: boolean;
    createdAt: string;
    updatedAt: string;
    lastLogin: string;
    lastActive: string;
    defaultProfile: boolean;
  } | null;
  onStartSimulation: (simulationId: string) => void;
  loadingSimulation: string | null;
  scenarios: Array<{
    id: string;
    active: boolean;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  }>;
  personas: Array<{
    id: string;
    active: boolean;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

// Import mocks
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: PracticeZoneProps = {
  simulations: [
    {
      id: "sim-1",
      title: "Math Practice",
      timeLimit: "30 minutes",
      active: true,
      scenarioIds: ["scenario-1"],
      rubricId: "rubric-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  profile: {
    id: "profile-1",
    userId: 1,
    firstName: "Test",
    lastName: "User",
    alias: "testuser",
    role: "superadmin",
    active: true,
    viewedIntro: false,
    viewedChat: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    defaultProfile: false,
  },
  onStartSimulation: vi.fn(),
  loadingSimulation: null,
  scenarios: [
    {
      id: "scenario-1",
      name: "Algebra Problem",
      description: "Solve algebra problems",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  personas: [
    {
      id: "persona-1",
      name: "Math Tutor",
      description: "Helps with math",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
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

      // Should render profile information
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Should have proper heading structure
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

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

      // Should show loading state
      expect(screen.getByText("Loading...")).toBeInTheDocument();
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

      // Should show no simulations message
      expect(screen.getByText("No simulations available")).toBeInTheDocument();
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

      // Should still render without crashing
      expect(screen.getByText("Practice Zone")).toBeInTheDocument();
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

      // Should not show inactive simulations
      expect(screen.queryByText("Math Practice")).not.toBeInTheDocument();
    });
  });
});
