import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import SimulationCard, {
  SimulationCardProps,
} from "@/components/common/simulation/SimulationCard";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SimulationCardProps = {
  simulation: {
    id: "1",
    createdAt: "2021-01-01",
    updatedAt: "2021-01-01",
    title: "Test Simulation",
    timeLimit: 10,
    active: true,
    scenarioIds: ["scenario-1"],
    rubricId: "rubric-1",
    defaultSimulation: false,
    practiceSimulation: false,
  },
  type: "default",
  onStartSimulation: vi.fn(),
  loadingSimulation: null,
  effectiveProfile: {
    id: "1",
    createdAt: "2021-01-01",
    updatedAt: "2021-01-01",
    active: true,
    userId: 1,
    lastLogin: "2021-01-01",
    firstName: "Test",
    lastName: "User",
    alias: "test-user",
    viewedIntro: true,
    viewedChat: true,
    role: "superadmin",
    defaultProfile: true,
    lastActive: "2021-01-01",
  },
  // scenarios: [], /* optional */
  // personas: [], /* optional */
};
// ------------------------------------------------------------------
describe("SimulationCard", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<SimulationCard {...mockProps} />);

      // Verify the component renders with the simulation title
      expect(screen.getByTestId("simulation-title")).toBeInTheDocument();
      expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    });

    it("should render with props", () => {
      // Test component with various props
      // Props interface: SimulationCardProps

      render(<SimulationCard {...mockProps} />);

      // Verify simulation title is displayed
      expect(screen.getByText("Test Simulation")).toBeInTheDocument();

      // Verify time limit is displayed
      expect(screen.getByTestId("simulation-duration")).toBeInTheDocument();
      expect(screen.getByText("10 min")).toBeInTheDocument();

      // Verify start button is present
      expect(screen.getByTestId("start-simulation-1")).toBeInTheDocument();
      expect(screen.getByText("Start Simulation")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<SimulationCard {...mockProps} />);

      // Verify the card has proper test IDs for accessibility
      expect(
        screen.getByTestId("permanent-simulation-card"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("simulation-title")).toBeInTheDocument();
      expect(screen.getByTestId("simulation-duration")).toBeInTheDocument();

      // Verify button has proper accessibility attributes
      const startButton = screen.getByTestId("start-simulation-1");
      expect(startButton).toBeInTheDocument();
      expect(startButton).not.toBeDisabled();
    });
  });

  describe("User Interactions", () => {
    it("should handle start simulation click", async () => {
      const user = userEvent.setup();
      const mockOnStartSimulation = vi.fn();

      render(
        <SimulationCard
          {...mockProps}
          onStartSimulation={mockOnStartSimulation}
        />,
      );

      const startButton = screen.getByTestId("start-simulation-1");
      await user.click(startButton);

      expect(mockOnStartSimulation).toHaveBeenCalledWith("1");
    });

    it("should show loading state when simulation is starting", () => {
      render(<SimulationCard {...mockProps} loadingSimulation="1" />);

      const startButton = screen.getByTestId("start-simulation-1");
      expect(startButton).toBeDisabled();
      expect(screen.getByText("Starting...")).toBeInTheDocument();
    });
  });

  describe("Different Card Types", () => {
    it("should render default simulation type correctly", () => {
      render(<SimulationCard {...mockProps} type="default" />);

      expect(
        screen.getByTestId("permanent-simulation-card"),
      ).toBeInTheDocument();
      expect(screen.getByText("Start Simulation")).toBeInTheDocument();
    });

    it("should render cohort simulation type correctly", () => {
      const cohortProps = {
        ...mockProps,
        type: "cohort" as const,
        simulation: {
          ...mockProps.simulation,
          hasPassed: false,
        },
      };

      render(<SimulationCard {...cohortProps} />);

      expect(screen.getByTestId("simulation-card")).toBeInTheDocument();
      expect(screen.getByText("Start Simulations")).toBeInTheDocument();
    });

    it("should show completed state for passed simulations", () => {
      const passedProps = {
        ...mockProps,
        type: "cohort" as const,
        simulation: {
          ...mockProps.simulation,
          hasPassed: true,
        },
      };

      render(<SimulationCard {...passedProps} />);

      expect(screen.getByText("Completed Simulations")).toBeInTheDocument();
    });
  });

  describe("Profile Role Handling", () => {
    it("should show rubric dialog for non-guest users", async () => {
      render(<SimulationCard {...mockProps} />);

      // Look for the rubric button by finding the button with aria-haspopup="dialog"
      const buttons = screen.getAllByRole("button");
      const rubricButton = buttons.find(
        (button) => button.getAttribute("aria-haspopup") === "dialog",
      );
      expect(rubricButton).toBeInTheDocument();
    });

    it("should show simulation type for guest users", () => {
      const guestProps = {
        ...mockProps,
        effectiveProfile: {
          ...mockProps.effectiveProfile,
          role: "guest" as const,
        },
      };

      render(<SimulationCard {...guestProps} />);

      expect(screen.getByTestId("simulation-type")).toBeInTheDocument();
      expect(screen.getByText("Default")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const edgeCaseProps = {
        ...mockProps,
        simulation: {
          ...mockProps.simulation,
          timeLimit: null, // No time limit
          scenarioIds: [], // No scenarios
        },
      };

      render(<SimulationCard {...edgeCaseProps} />);

      // Should still render without crashing
      expect(screen.getByTestId("simulation-title")).toBeInTheDocument();
      expect(screen.getByText("∞ min")).toBeInTheDocument(); // No time limit
    });

    it("should handle missing or invalid props", () => {
      const minimalProps = {
        simulation: {
          id: "1",
          createdAt: "2021-01-01",
          updatedAt: "2021-01-01",
          title: "Test Simulation",
          timeLimit: 10,
          active: true,
          scenarioIds: ["scenario-1"],
          rubricId: "rubric-1",
          defaultSimulation: false,
          practiceSimulation: false,
        },
        type: "default" as const,
        onStartSimulation: vi.fn(),
        loadingSimulation: null,
        effectiveProfile: {
          id: "1",
          createdAt: "2021-01-01",
          updatedAt: "2021-01-01",
          active: true,
          userId: 1,
          lastLogin: "2021-01-01",
          firstName: "Test",
          lastName: "User",
          alias: "test-user",
          viewedIntro: true,
          viewedChat: true,
          role: "superadmin" as const,
          defaultProfile: true,
          lastActive: "2021-01-01",
        },
        rubricData: { attempts: [], highestScore: 0 },
      };

      render(<SimulationCard {...minimalProps} />);

      // Should render with minimal props
      expect(screen.getByTestId("simulation-title")).toBeInTheDocument();
      expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for SimulationCard:
 * Path: common/simulation/SimulationCard.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: SimulationCardProps
 * - Has props: true
 * - Props interface: SimulationCardProps
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
 * render(<SimulationCard {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<SimulationCard {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
