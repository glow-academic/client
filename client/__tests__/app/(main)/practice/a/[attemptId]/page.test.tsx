import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock AttemptChat component
vi.mock("@/components/common/chat/attempt/AttemptChat", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="attempt-chat-component">Attempt Chat Component</div>
  ),
}));

// Mock query functions
vi.mock("@/utils/queries/simulation_attempts/get-simulation-attempt", () => ({
  getSimulationAttempt: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulation", () => ({
  getSimulation: vi.fn(),
}));

import PracticeAttemptPage, {
  generateMetadata,
} from "@/app/(main)/practice/a/[attemptId]/page";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import type { ResolvingMetadata } from "next";

describe("PracticeAttemptPage", () => {
  const mockParams = Promise.resolve({ attemptId: "test-attempt-id" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    render(<PracticeAttemptPage params={mockParams} />);
    expect(screen.getByTestId("attempt-chat-component")).toBeInTheDocument();
    expect(screen.getByText("Attempt Chat Component")).toBeInTheDocument();
  });

  it("renders the AttemptChat component inside a wrapper", async () => {
    render(<PracticeAttemptPage params={mockParams} />);
    const wrapper = screen.getByTestId("attempt-chat-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });

  describe("generateMetadata", () => {
    it("generates metadata with attempt and simulation data", async () => {
      const mockAttempt = {
        id: "test-attempt-id",
        simulationId: "test-simulation-id",
        createdAt: new Date().toISOString(),
        profileId: "test-profile-id",
      };
      const mockSimulation = {
        id: "test-simulation-id",
        title: "Test Simulation",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeLimit: 30,
        active: true,
        scenarioIds: [],
        rubricId: "test-rubric-id",
        defaultSimulation: false,
        practiceSimulation: true,
      };

      vi.mocked(getSimulationAttempt).mockResolvedValue(mockAttempt);
      vi.mocked(getSimulation).mockResolvedValue(mockSimulation);

      const metadata = await generateMetadata(
        { params: mockParams },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("Practice Test Simulation");
      expect(metadata.description).toContain("Practice Test Simulation");
      expect(metadata.description).toContain("in GLOW");
    });

    it("handles missing attempt data gracefully", async () => {
      vi.mocked(getSimulationAttempt).mockResolvedValue(null);

      const metadata = await generateMetadata(
        { params: mockParams },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("Practice Attempt test-att...");
      expect(metadata.description).toContain("Practice Attempt test-att...");
      expect(metadata.description).toContain("in GLOW");
    });

    it("handles missing simulation data gracefully", async () => {
      const mockAttempt = {
        id: "test-attempt-id",
        simulationId: "test-simulation-id",
        createdAt: new Date().toISOString(),
        profileId: "test-profile-id",
      };

      vi.mocked(getSimulationAttempt).mockResolvedValue(mockAttempt);
      vi.mocked(getSimulation).mockResolvedValue(null);

      const metadata = await generateMetadata(
        { params: mockParams },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("Practice Attempt");
      expect(metadata.description).toContain("Practice Attempt");
      expect(metadata.description).toContain("in GLOW");
    });
  });
});
