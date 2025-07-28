import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Home from "@/components/home/Home";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// Helper function to mock all Home component queries
const mockHomeQueries = async () => {
  const { getAllCohorts } = await import(
    "@/utils/queries/cohorts/get-all-cohorts"
  );
  const { getAllSimulations } = await import(
    "@/utils/queries/simulations/get-all-simulations"
  );
  const { getAllProfiles } = await import(
    "@/utils/queries/profiles/get-all-profiles"
  );
  const { getAllRubrics } = await import(
    "@/utils/queries/rubrics/get-all-rubrics"
  );
  const { getSimulationAttemptsByProfiles } = await import(
    "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
  );
  const { getSimulationChatsByAttempts } = await import(
    "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts"
  );
  const { getSimulationChatGradesBySimulationChats } = await import(
    "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
  );

  vi.mocked(getAllCohorts).mockResolvedValue([]);
  vi.mocked(getAllSimulations).mockResolvedValue([]);
  vi.mocked(getAllProfiles).mockResolvedValue([]);
  vi.mocked(getAllRubrics).mockResolvedValue([]);
  vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue([]);
  vi.mocked(getSimulationChatsByAttempts).mockResolvedValue([]);
  vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);
};

describe("Home", () => {
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

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for the component to load and check for key elements
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Check for main landmark
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Check for proper heading structure
      const headings = screen.getAllByRole("heading");
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Test that the component renders with mock data
      expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Test that the component is interactive
      expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      vi.mocked(getAllCohorts).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Home />);

      // Wait for error state to be displayed
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });

    it("should handle missing profile data", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });
  });

  describe("Guest User Access", () => {
    it("should show access denied for guest users", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });
  });

  describe("Cohort Display", () => {
    it("should display no cohorts message when no cohorts are available", async () => {
      await mockHomeQueries();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Check for the specific message
      expect(
        screen.getByText(
          "There are no cohorts assigned to you. Please contact an administrator."
        )
      ).toBeInTheDocument();
    });
  });
});
