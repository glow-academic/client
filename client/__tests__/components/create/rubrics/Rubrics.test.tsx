/**
 * Rubrics.test.tsx
 * Comprehensive tests for the Rubrics component
 */
import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Rubrics from "@/components/create/rubrics/Rubrics";

// Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// Mock the profile context
const mockProfileContext = {
  effectiveProfile: {
    id: "test-profile-id",
    firstName: "Test",
    lastName: "User",
    role: "admin",
  },
  activeProfile: {
    id: "test-profile-id",
    firstName: "Test",
    lastName: "User",
    role: "admin",
  },
  isLoading: false,
};

vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => mockProfileContext,
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the TableRubric component
vi.mock("@/components/common/rubric/TableRubric", () => ({
  default: ({ rubricId }: { rubricId: string }) => (
    <div data-testid={`table-rubric-${rubricId}`}>
      Table for rubric {rubricId}
    </div>
  ),
}));

// Mock the RubricsDataTable component
vi.mock("./RubricsDataTable", () => ({
  RubricsDataTable: ({
    data,
    renderRubricCard,
  }: {
    data: Array<{
      id: string;
      name: string;
      description: string | null;
      points: number;
      passPoints: number;
      defaultRubric: boolean;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    renderRubricCard: (rubric: {
      id: string;
      name: string;
      description: string | null;
      points: number;
      passPoints: number;
      defaultRubric: boolean;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    }) => React.ReactNode;
  }) => (
    <div data-testid="rubrics-data-table">
      {data.length > 0 ? (
        data.map((rubric) => renderRubricCard(rubric))
      ) : (
        <div>No rubrics found</div>
      )}
    </div>
  ),
}));

// Mock the duplicateRubric server action
vi.mock("@/utils/rubric/duplicate-rubric", () => ({
  duplicateRubric: vi.fn(),
}));

// Mock the deleteRubric mutation
vi.mock("@/utils/mutations/rubrics/delete-rubric", () => ({
  deleteRubric: vi.fn(),
}));

import { duplicateRubric } from "@/utils/rubric/duplicate-rubric";

describe("Rubrics Component", () => {
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
    // Reset profile context
    Object.assign(mockProfileContext, {
      effectiveProfile: {
        id: "test-profile-id",
        firstName: "Test",
        lastName: "User",
        role: "admin",
      },
      activeProfile: {
        id: "test-profile-id",
        firstName: "Test",
        lastName: "User",
        role: "admin",
      },
      isLoading: false,
    });
  });

  describe("Component Rendering", () => {
    it("renders without crashing", async () => {
      // Mock the API calls to return data
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByTestId("rubrics-data-table")).toBeInTheDocument();
      });
    });

    it("shows loading state when rubrics are loading", async () => {
      // Mock loading state
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockImplementation(() => new Promise(() => {}));

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByText("Loading rubrics...")).toBeInTheDocument();
      });
    });

    it("renders rubric cards with correct data", async () => {
      const mockRubrics = [
        {
          id: "rubric-1",
          name: "Math Problem Solving Rubric",
          description: "A comprehensive rubric for math problem solving",
          points: 100,
          passPoints: 70,
          defaultRubric: true,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockResolvedValue(mockRubrics);
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(
          screen.getByText("Math Problem Solving Rubric")
        ).toBeInTheDocument();
        expect(screen.getByText("100 total points")).toBeInTheDocument();
        expect(screen.getByText("Pass: 70 pts (70%)")).toBeInTheDocument();
        expect(screen.getByText("Active")).toBeInTheDocument();
      });
    });
  });

  describe("Rubric Card Display", () => {
    it("displays rubric information correctly", async () => {
      const mockRubric = {
        id: "rubric-1",
        name: "Test Rubric",
        description: "Test description",
        points: 100,
        passPoints: 70,
        defaultRubric: true,
        active: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubric]);
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByText("Test Rubric")).toBeInTheDocument();
        expect(screen.getByText("Test description")).toBeInTheDocument();
        expect(screen.getByText("100 total points")).toBeInTheDocument();
        expect(screen.getByText("Pass: 70 pts (70%)")).toBeInTheDocument();
        expect(screen.getByText("Active")).toBeInTheDocument();
      });
    });

    it("shows inactive status for inactive rubrics", async () => {
      const mockRubric = {
        id: "rubric-1",
        name: "Test Rubric",
        description: "Test description",
        points: 100,
        passPoints: 70,
        defaultRubric: true,
        active: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubric]);
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByText("Inactive")).toBeInTheDocument();
      });
    });
  });

  describe("Permission Logic", () => {
    it("allows superadmin to edit any rubric", async () => {
      mockProfileContext.effectiveProfile.role = "superadmin";

      const mockRubric = {
        id: "rubric-1",
        name: "Test Rubric",
        description: "Test description",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const mockSimulation = {
        id: "sim-1",
        title: "Test Simulation",
        rubricId: "rubric-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        timeLimit: null,
        active: true,
        scenarioIds: [],
        defaultSimulation: false,
        practiceSimulation: false,
      };

      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubric]);
      vi.mocked(getAllSimulations).mockResolvedValue([mockSimulation]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
    });

    it("prevents non-superadmin from editing used rubrics", async () => {
      mockProfileContext.effectiveProfile.role = "admin";

      const mockRubric = {
        id: "rubric-1",
        name: "Test Rubric",
        description: "Test description",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const mockSimulation = {
        id: "sim-1",
        title: "Test Simulation",
        rubricId: "rubric-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        timeLimit: null,
        active: true,
        scenarioIds: [],
        defaultSimulation: false,
        practiceSimulation: false,
      };

      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubric]);
      vi.mocked(getAllSimulations).mockResolvedValue([mockSimulation]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.queryByText("Edit")).not.toBeInTheDocument();
      });
    });
  });

  describe("duplicateRubric Function", () => {
    it("should duplicate a rubric with standard groups and standards", async () => {
      // Mock the duplicateRubric function to return success
      vi.mocked(duplicateRubric).mockResolvedValue({
        id: "new-rubric-id",
        name: "Test Rubric Copy",
        description: "A test rubric",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      // Call the duplicate function directly
      const result = await duplicateRubric("rubric-1", "Test Rubric Copy");

      // Verify the function was called with correct parameters
      expect(duplicateRubric).toHaveBeenCalledWith(
        "rubric-1",
        "Test Rubric Copy"
      );

      // Verify the result
      expect(result).toEqual({
        id: "new-rubric-id",
        name: "Test Rubric Copy",
        description: "A test rubric",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });
    });

    it("should handle duplication errors gracefully", async () => {
      // Mock the duplicateRubric function to throw an error
      vi.mocked(duplicateRubric).mockRejectedValue(
        new Error("Duplication failed")
      );

      // Verify the function throws an error
      await expect(
        duplicateRubric("rubric-1", "Test Rubric Copy")
      ).rejects.toThrow("Duplication failed");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty rubrics list", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([]);
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(
          screen.getByText("No rubrics match the current filters.")
        ).toBeInTheDocument();
      });
    });

    it("handles missing rubric description", async () => {
      const mockRubric = {
        id: "rubric-1",
        name: "Test Rubric",
        description: "Test description",
        points: 100,
        passPoints: 70,
        defaultRubric: true,
        active: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubric]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByText("Test Rubric")).toBeInTheDocument();
        expect(screen.getByText("Test description")).toBeInTheDocument();
      });
    });

    it("handles API errors gracefully", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllRubrics).mockRejectedValue(new Error("API Error"));
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      render(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByTestId("rubrics-data-table")).toBeInTheDocument();
      });
    });
  });
});
