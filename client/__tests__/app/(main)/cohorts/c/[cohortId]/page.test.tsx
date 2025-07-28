import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Leaderboard component
vi.mock("@/components/analytics/Leaderboard", () => ({
  __esModule: true,
  default: ({ cohortId }: { cohortId: string }) => (
    <div data-testid="leaderboard-component" data-cohort-id={cohortId}>
      Leaderboard Component
    </div>
  ),
}));

// Mock getCohort function
vi.mock("@/utils/queries/cohorts/get-cohort", () => ({
  getCohort: vi.fn(),
}));

import CohortDashboardPage, {
  generateMetadata,
} from "@/app/(main)/cohorts/c/[cohortId]/page";
import { getCohort } from "@/utils/queries/cohorts/get-cohort";
import type { ResolvingMetadata } from "next";

describe("CohortDashboardPage", () => {
  const mockParams = Promise.resolve({ cohortId: "test-cohort-id" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    renderWithMocks(<CohortDashboardPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-component")).toBeInTheDocument();
    });
    expect(screen.getByText("Leaderboard Component")).toBeInTheDocument();
  });

  it("passes cohortId to Leaderboard component", async () => {
    renderWithMocks(<CohortDashboardPage params={mockParams} />);

    await waitFor(() => {
      const leaderboard = screen.getByTestId("leaderboard-component");
      expect(leaderboard).toHaveAttribute("data-cohort-id", "test-cohort-id");
    });
  });

  it("renders the Leaderboard component inside a wrapper", async () => {
    renderWithMocks(<CohortDashboardPage params={mockParams} />);

    await waitFor(() => {
      const wrapper = screen.getByTestId("leaderboard-component").parentElement;
      expect(wrapper).toHaveClass("space-y-6");
    });
  });

  describe("generateMetadata", () => {
    it("generates metadata with cohort data", async () => {
      const mockCohort = {
        id: "test-id",
        title: "Test Cohort",
        description: "Test Description",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true,
        profileIds: [],
        defaultCohort: false,
        simulationIds: [],
      };
      vi.mocked(getCohort).mockResolvedValue(mockCohort);

      const metadata = await generateMetadata(
        { params: mockParams },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("Test Cohort");
      expect(metadata.description).toContain("Test Cohort Test Description");
      expect(metadata.description).toContain("in GLOW");
    });

    it("handles missing cohort data gracefully", async () => {
      vi.mocked(getCohort).mockResolvedValue(null);

      const metadata = await generateMetadata(
        { params: mockParams },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("Cohort");
      expect(metadata.description).toContain("Cohort in GLOW");
    });
  });
});
