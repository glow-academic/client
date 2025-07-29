import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock React's use hook to avoid suspension
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    use: vi.fn((promise) => {
      if (promise instanceof Promise) {
        return { cohortId: "test-cohort-id" };
      }
      return promise;
    }),
  };
});

// Mock CohortEdit component
vi.mock("@/components/cohorts/CohortEdit", () => ({
  __esModule: true,
  default: ({ cohortId }: { cohortId: string }) => (
    <div data-testid="cohort-edit-component" data-cohort-id={cohortId}>
      Cohort Edit Component
    </div>
  ),
}));

// Mock getCohort function
vi.mock("@/utils/queries/cohorts/get-cohort", () => ({
  getCohort: vi.fn(),
}));

import CohortEditPage, {
  generateMetadata,
} from "@/app/(main)/cohorts/e/[cohortId]/page";
import { getCohort } from "@/utils/queries/cohorts/get-cohort";
import type { ResolvingMetadata } from "next";

describe("CohortEditPage", () => {
  const mockParams = Promise.resolve({ cohortId: "test-cohort-id" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    render(<CohortEditPage params={mockParams} />);

    // The component should render immediately since we mocked the use hook
    expect(screen.getByTestId("cohort-edit-component")).toBeInTheDocument();
    expect(screen.getByText("Cohort Edit Component")).toBeInTheDocument();
  });

  it("passes cohortId to CohortEdit component", async () => {
    render(<CohortEditPage params={mockParams} />);

    await waitFor(() => {
      const cohortEdit = screen.getByTestId("cohort-edit-component");
      expect(cohortEdit).toHaveAttribute("data-cohort-id", "test-cohort-id");
    });
  });

  it("renders the CohortEdit component inside a wrapper", async () => {
    render(<CohortEditPage params={mockParams} />);

    await waitFor(() => {
      const wrapper = screen.getByTestId("cohort-edit-component").parentElement;
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

      expect(metadata.title).toBe("Test Cohort Edit");
      expect(metadata.description).toContain("Test Cohort Test Description");
      expect(metadata.description).toContain("in GLOW");
    });

    it("handles missing cohort data gracefully", async () => {
      vi.mocked(getCohort).mockResolvedValue(null);

      const metadata = await generateMetadata(
        { params: mockParams },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("Cohort Edit");
      expect(metadata.description).toContain("Cohort in GLOW");
    });
  });
});
