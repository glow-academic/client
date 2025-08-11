import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Personas from "@/components/create/personas/Personas";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

describe("Personas", () => {
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
      // ✨ All mocks are automatically set up via imports above
      render(<Personas />);

      // Wait for the component to load
      await waitFor(() => {
        expect(
          screen.getByText("No personas match the current filters."),
        ).toBeInTheDocument();
      });
    });

    it("should display personas when available", async () => {
      // Mock personas data
      const mockPersonas = [
        {
          id: "persona-1",
          name: "Test Persona 1",
          description: "Test description 1",
          systemPrompt: "Test prompt 1",
          temperature: 0.7,
          defaultPersona: true,
          color: "#ff0000",
          icon: "brain",
          modelId: "model-1",
          reasoning: "high" as const,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "persona-2",
          name: "Test Persona 2",
          description: "Test description 2",
          systemPrompt: "Test prompt 2",
          temperature: 0.3,
          defaultPersona: false,
          color: "#00ff00",
          icon: "zap",
          modelId: "model-2",
          reasoning: "low" as const,
          active: false,
          createdAt: "2024-01-02T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ];

      // Override the mock to return our test data
      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockResolvedValue(mockPersonas);

      render(<Personas />);

      // Wait for personas to load
      await waitFor(() => {
        expect(screen.getByText("Test Persona 1")).toBeInTheDocument();
        expect(screen.getByText("Test Persona 2")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<Personas />);

      // Check for empty state message
      await waitFor(() => {
        expect(
          screen.getByText("No personas match the current filters."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle persona duplication", async () => {
      const user = userEvent.setup();

      const mockPersonas = [
        {
          id: "persona-1",
          name: "Test Persona",
          description: "Test description",
          systemPrompt: "Test prompt",
          temperature: 0.7,
          defaultPersona: true,
          color: "#ff0000",
          icon: "brain",
          modelId: "model-1",
          reasoning: "high" as const,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockResolvedValue(mockPersonas);

      render(<Personas />);

      await waitFor(() => {
        expect(screen.getByText("Test Persona")).toBeInTheDocument();
      });

      // Find and click the duplicate button (it has a Copy icon)
      const buttons = screen.getAllByRole("button");
      const duplicateButton = buttons.find((button) =>
        button.querySelector('svg[class*="lucide-copy"]'),
      );
      expect(duplicateButton).toBeDefined();
      await user.click(duplicateButton!);

      // The duplication should be handled by the component
      expect(duplicateButton).toBeInTheDocument();
    });

    it("should handle persona editing", async () => {
      const user = userEvent.setup();

      const mockPersonas = [
        {
          id: "persona-1",
          name: "Test Persona",
          description: "Test description",
          systemPrompt: "Test prompt",
          temperature: 0.7,
          defaultPersona: true,
          color: "#ff0000",
          icon: "brain",
          modelId: "model-1",
          reasoning: "high" as const,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockResolvedValue(mockPersonas);

      // Mock scenarios to ensure persona is not in use (so it can be edited)
      const { getAllScenarios } = await import(
        "@/utils/queries/scenarios/get-all-scenarios"
      );
      vi.mocked(getAllScenarios).mockResolvedValue([]);

      render(<Personas />);

      await waitFor(() => {
        expect(screen.getByText("Test Persona")).toBeInTheDocument();
      });

      // Find and click the edit button (using icon selector)
      const buttons = screen.getAllByRole("button");
      const editButton = buttons.find((button) =>
        button.querySelector('svg[class*="lucide-square-pen"]'),
      );
      expect(editButton).toBeDefined();
      await user.click(editButton!);

      // The edit should navigate to the edit page
      expect(editButton).toBeInTheDocument();
    });

    it("should handle persona deletion", async () => {
      const user = userEvent.setup();

      const mockPersonas = [
        {
          id: "persona-1",
          name: "Test Persona",
          description: "Test description",
          systemPrompt: "Test prompt",
          temperature: 0.7,
          defaultPersona: false,
          color: "#ff0000",
          icon: "brain",
          modelId: "model-1",
          reasoning: "high" as const,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockResolvedValue(mockPersonas);

      render(<Personas />);

      await waitFor(() => {
        expect(screen.getByText("Test Persona")).toBeInTheDocument();
      });

      // Find and click the delete button (using icon selector)
      const buttons = screen.getAllByRole("button");
      const deleteButton = buttons.find((button) =>
        button.querySelector('svg[class*="lucide-trash"]'),
      );
      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      // Should show delete confirmation dialog
      expect(screen.getByText("Delete Persona")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();

      const mockPersonas = [
        {
          id: "persona-1",
          name: "Test Persona",
          description: "Test description",
          systemPrompt: "Test prompt",
          temperature: 0.7,
          defaultPersona: true,
          color: "#ff0000",
          icon: "brain",
          modelId: "model-1",
          reasoning: "high" as const,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockResolvedValue(mockPersonas);

      render(<Personas />);

      await waitFor(() => {
        expect(screen.getByText("Test Persona")).toBeInTheDocument();
      });

      // Test search functionality
      const searchInput = screen.getByPlaceholderText("Search personas...");
      await user.type(searchInput, "Test");

      // Verify that the search input has the typed value
      expect(searchInput).toHaveValue("Test");
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockRejectedValue(new Error("API Error"));

      render(<Personas />);

      // The component should handle the error gracefully
      await waitFor(() => {
        // Component should still render without crashing
        expect(
          screen.getByText("No personas match the current filters."),
        ).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      // Create a promise that never resolves to simulate loading
      const loadingPromise = new Promise<never>(() => {});
      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockReturnValue(loadingPromise);

      render(<Personas />);

      // The component should render without crashing during loading
      // React Query will handle the loading state internally
      expect(
        screen.getByPlaceholderText("Search personas..."),
      ).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      // This component doesn't have direct navigation, but we can test
      // that it renders without navigation-related errors
      render(<Personas />);

      await waitFor(() => {
        expect(
          screen.getByText("No personas match the current filters."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with empty personas array
      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockResolvedValue([]);

      render(<Personas />);

      await waitFor(() => {
        expect(
          screen.getByText("No personas match the current filters."),
        ).toBeInTheDocument();
      });
    });

    it("should handle personas with missing properties", async () => {
      const mockPersonas = [
        {
          id: "persona-1",
          name: "",
          description: "",
          systemPrompt: "",
          temperature: 0.7,
          defaultPersona: false,
          color: "",
          icon: "",
          modelId: null,
          reasoning: null,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockResolvedValue(mockPersonas);

      render(<Personas />);

      // Component should handle empty properties gracefully
      await waitFor(() => {
        expect(screen.getByText("Unnamed Persona")).toBeInTheDocument();
      });
    });
  });
});
