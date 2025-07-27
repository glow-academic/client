import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import PracticeZone from "@/components/practice/PracticeZone";

// ------------------------------------------------------------------
// Define the interface locally since it's not exported
interface PracticeZoneProps {
  simulations: Array<{
    id: string;
    active: boolean;
    title: string;
    createdAt: string;
    updatedAt: string;
    timeLimit: number | null;
    scenarioIds: string[];
    rubricId: string;
    defaultSimulation: boolean;
    practiceSimulation: boolean;
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
  getRealRubricData: (simulationId: string) => {
    attempts: Array<{
      attempt: number;
      overallScore: number;
      skillScores: Record<string, number>;
      createdAt: string;
    }>;
    highestScore: number;
  };
  scenarios: unknown[];
  personas: unknown[];
}

const mockProps: PracticeZoneProps = {
  simulations: [
    {
      id: "sim-1",
      title: "Test Simulation 1",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeLimit: 30,
      scenarioIds: ["scenario-1"],
      rubricId: "rubric-1",
      defaultSimulation: false,
      practiceSimulation: true,
    },
    {
      id: "sim-2",
      title: "Test Simulation 2",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeLimit: 45,
      scenarioIds: ["scenario-2"],
      rubricId: "rubric-2",
      defaultSimulation: false,
      practiceSimulation: true,
    },
  ],
  profile: {
    id: "profile-1",
    userId: 1,
    firstName: "Test",
    lastName: "User",
    alias: "testuser",
    role: "ta",
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
  getRealRubricData: vi.fn(() => ({
    attempts: [],
    highestScore: 0,
  })),
  scenarios: [],
  personas: [],
};
// ------------------------------------------------------------------
describe("PracticeZone", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Check that the component renders with simulations
      expect(screen.getByText("Test Simulation 1")).toBeInTheDocument();
      expect(screen.getByText("Test Simulation 2")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Check that all simulations are rendered
      expect(screen.getByText("Test Simulation 1")).toBeInTheDocument();
      expect(screen.getByText("Test Simulation 2")).toBeInTheDocument();

      // Check that simulation cards are rendered
      const simulationCards = screen.getAllByTestId(
        "permanent-simulation-card"
      );
      expect(simulationCards).toHaveLength(2);
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<PracticeZone {...mockProps} />);

      // Check that the component has proper structure
      expect(screen.getByText("Test Simulation 1")).toBeInTheDocument();

      // Check for proper heading structure
      const headings = screen.getAllByRole("heading");
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty simulations array
      const emptyProps = { ...mockProps, simulations: [] };
      renderWithMocks(<PracticeZone {...emptyProps} />);

      // Should render nothing when no simulations
      expect(screen.queryByText("Test Simulation 1")).not.toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with null profile
      const nullProfileProps = { ...mockProps, profile: null };
      renderWithMocks(<PracticeZone {...nullProfileProps} />);

      // Should not render when profile is null
      expect(screen.queryByText("Test Simulation 1")).not.toBeInTheDocument();
    });

    it("should handle loading simulation state", () => {
      const loadingProps = { ...mockProps, loadingSimulation: "sim-1" };
      renderWithMocks(<PracticeZone {...loadingProps} />);

      // Should still render the component
      expect(screen.getByText("Test Simulation 1")).toBeInTheDocument();
      expect(screen.getByText("Test Simulation 2")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for PracticeZone:
 * Path: practice/PracticeZone.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: PracticeZoneProps
 * - Client component: false
 * - Uses hooks: None
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<PracticeZone {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<PracticeZone {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
