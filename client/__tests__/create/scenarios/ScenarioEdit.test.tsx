import ScenarioEdit from "@/components/create/scenarios/ScenarioEdit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock API calls
vi.mock("@/utils/queries/scenarios/get-scenario", () => ({
  getScenario: vi.fn(),
}));

vi.mock("@/utils/mutations/scenarios/update-scenario", () => ({
  updateScenario: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ScenarioEdit", () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();
  const testScenarioId = "test-scenario-id";

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render without crashing", () => {
      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      // Should show loading state initially
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("should render edit mode when scenario loads", async () => {
      const { getScenario } = await import(
        "@/utils/queries/scenarios/get-scenario"
      );
      vi.mocked(getScenario).mockResolvedValue({
        id: testScenarioId,
        name: "Test Scenario",
        description: "Test Description",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentId: "agent-id",
        classId: "class-id",
        crowdedness: 3,
        intensity: 4,
        seniority: "junior",
        documents: [],
      });

      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Scenario")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Modify the context and setting for this conversation scenario"
          )
        ).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      const { getScenario } = await import(
        "@/utils/queries/scenarios/get-scenario"
      );
      vi.mocked(getScenario).mockResolvedValue({
        id: testScenarioId,
        name: "Test Scenario",
        description: "Test Description",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentId: "agent-id",
        classId: "class-id",
        crowdedness: 3,
        intensity: 4,
        seniority: "junior",
        documents: [],
      });

      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/scenario name/i);
        const descriptionTextarea = screen.getByLabelText(/description/i);

        expect(nameInput).toHaveAttribute("required");
        expect(nameInput).toHaveValue("Test Scenario");
        expect(descriptionTextarea).toHaveValue("Test Description");
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const { getScenario } = await import(
        "@/utils/queries/scenarios/get-scenario"
      );
      const { updateScenario } = await import(
        "@/utils/mutations/scenarios/update-scenario"
      );

      vi.mocked(getScenario).mockResolvedValue({
        id: testScenarioId,
        name: "Test Scenario",
        description: "Test Description",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentId: "agent-id",
        classId: "class-id",
        crowdedness: 3,
        intensity: 4,
        seniority: "junior",
        documents: [],
      });
      vi.mocked(updateScenario).mockResolvedValue({
        id: testScenarioId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: "Test Scenario",
        description: "Test Description",
        agentId: "agent-id",
        classId: "class-id",
        crowdedness: 3,
        intensity: 4,
        seniority: "junior",
        documents: [],
      });

      const user = userEvent.setup();
      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Test Scenario")).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/scenario name/i);
      const submitButton = screen.getByRole("button", {
        name: /update scenario/i,
      });

      await user.clear(nameInput);
      await user.type(nameInput, "Updated Scenario");
      await user.click(submitButton);

      await waitFor(() => {
        expect(updateScenario).toHaveBeenCalledWith(testScenarioId, {
          name: "Updated Scenario",
          description: "Test Description",
        });
      });
    });

    it("should handle navigation on cancel", async () => {
      const { getScenario } = await import(
        "@/utils/queries/scenarios/get-scenario"
      );
      vi.mocked(getScenario).mockResolvedValue({
        id: testScenarioId,
        name: "Test Scenario",
        description: "Test Description",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agentId: "agent-id",
        classId: "class-id",
        crowdedness: 3,
        intensity: 4,
        seniority: "junior",
        documents: [],
      });

      const user = userEvent.setup();
      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /cancel/i })
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith("/chat/scenarios");
    });
  });

  describe("API Integration", () => {
    it("should handle loading states", () => {
      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      // Should show skeleton loading state
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("should handle error states", async () => {
      const { getScenario } = await import(
        "@/utils/queries/scenarios/get-scenario"
      );
      vi.mocked(getScenario).mockResolvedValue(null);

      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      await waitFor(() => {
        expect(screen.getByText("Scenario Not Found")).toBeInTheDocument();
        expect(
          screen.getByText("The scenario you're looking for doesn't exist.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation to scenarios list", async () => {
      const { getScenario } = await import(
        "@/utils/queries/scenarios/get-scenario"
      );
      vi.mocked(getScenario).mockResolvedValue(null);

      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      await waitFor(() => {
        expect(screen.getByText("Back to Scenarios")).toBeInTheDocument();
      });

      const backButton = screen.getByText("Back to Scenarios");
      await userEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/chat/scenarios");
    });
  });

  describe("Edge Cases", () => {
    it("should handle scenario data population", async () => {
      const { getScenario } = await import(
        "@/utils/queries/scenarios/get-scenario"
      );
      const mockScenario = {
        id: testScenarioId,
        name: "Original Scenario",
        description: "Original Description",
        agentId: "agent-id",
        crowdedness: 3,
        intensity: 4,
        seniority: "junior" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        classId: "class-id",
        documents: [],
      };

      vi.mocked(getScenario).mockResolvedValue(mockScenario);

      renderWithProviders(<ScenarioEdit scenarioId={testScenarioId} />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue("Original Scenario")
        ).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("Original Description")
        ).toBeInTheDocument();
      });
    });

    it("should require scenarioId prop", () => {
      // This test ensures the component properly requires scenarioId
      expect(() => {
        renderWithProviders(<ScenarioEdit scenarioId="" />);
      }).not.toThrow();

      // The component should handle empty scenarioId gracefully
      renderWithProviders(<ScenarioEdit scenarioId="" />);
      expect(screen.queryByText("Edit Scenario")).not.toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for ScenarioEdit:
 * Path: create/scenarios/ScenarioEdit.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (scenarioId: string)
 * - Props interface: { scenarioId: string }
 * - Client component: false (but wraps a client component)
 * - Uses hooks: None directly (delegates to Scenario component)
 * - Uses router: false directly (delegates to Scenario component)
 * - Has API calls: false directly (delegates to Scenario component)
 * - Has form handling: false directly (delegates to Scenario component)
 * - Uses state: false directly (delegates to Scenario component)
 * - Uses effects: false directly (delegates to Scenario component)
 * - Uses context: false
 *
 * This component is now a simple wrapper around the general Scenario component
 * configured for edit mode with the provided scenarioId.
 */
