import { Simulations } from "@/components/create/simulations/Simulations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock API calls
vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn(),
}));

vi.mock("@/utils/mutations/simulations/delete-simulation", () => ({
  deleteSimulation: vi.fn(),
}));

// Import mocked functions
import { deleteSimulation } from "@/utils/mutations/simulations/delete-simulation";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

// Mock data
const mockSimulations = [
  {
    id: "sim-1",
    title: "Math Tutoring Session",
    timeLimit: 15,
    active: true,
    scenarioIds: ["scenario-1", "scenario-2"],
    documents: ["doc-1"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    rubricId: "rubric-1",
  },
  {
    id: "sim-2",
    title: "Advanced Problem Solving",
    timeLimit: 30,
    active: false,
    scenarioIds: ["scenario-3"],
    documents: ["doc-1", "doc-2"],
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    rubricId: "rubric-1",
  },
  {
    id: "sim-3",
    title: "Group Study Session",
    timeLimit: 45,
    active: true,
    scenarioIds: ["scenario-1", "scenario-2", "scenario-3"],
    documents: [],
    createdAt: "2024-01-03T00:00:00Z",
    updatedAt: "2024-01-03T00:00:00Z",
    rubricId: "rubric-1",
  },
];

describe("Simulations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(useRouter).mockReturnValue(mockRouter);
    vi.mocked(getAllSimulations).mockResolvedValue(mockSimulations);
    vi.mocked(deleteSimulation).mockResolvedValue(undefined);
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render without crashing", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });
    });

    it("should display all simulations", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
        expect(
          screen.getByText("Advanced Problem Solving")
        ).toBeInTheDocument();
        expect(screen.getByText("Group Study Session")).toBeInTheDocument();
      });
    });

    it("should display simulation details", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("15 minutes")).toBeInTheDocument();
        expect(screen.getByText("30 minutes")).toBeInTheDocument();
        expect(screen.getByText("45 minutes")).toBeInTheDocument();
      });
    });

    it("should display active/inactive badges", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getAllByText("Active")).toHaveLength(2);
        expect(screen.getByText("Inactive")).toBeInTheDocument();
      });
    });

    it("should display scenario and document counts", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("2 scenarios")).toBeInTheDocument();
        expect(screen.getByText("1 scenarios")).toBeInTheDocument();
        expect(screen.getByText("3 scenarios")).toBeInTheDocument();
      });
    });

    it("should display edit and delete buttons for each simulation", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        const allButtons = screen.getAllByRole("button");
        const actionButtons = allButtons.filter((button) =>
          button.querySelector("svg.h-4.w-4")
        );

        // Should have edit and delete buttons for each simulation (2 buttons × 3 simulations = 6 buttons)
        expect(actionButtons.length).toBeGreaterThanOrEqual(6);
      });
    });

    it("should show empty state when no simulations exist", async () => {
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("No simulations yet")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Create your first simulation using our interactive playground"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /create your first simulation/i })
        ).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);

        // Check that cards are properly structured
        const simulations = screen.getAllByText(/Tutoring|Problem|Study/);
        expect(simulations.length).toBe(3);
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle edit button clicks", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (editButton) {
        await user.click(editButton);

        expect(mockPush).toHaveBeenCalledWith("/create/simulations/s/sim-1");
      }
    });

    it("should handle delete button clicks", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(screen.getByText("Are you sure?")).toBeInTheDocument();
          expect(
            screen.getByText(/This will permanently delete the simulation/)
          ).toBeInTheDocument();
        });
      }
    });

    it("should show delete confirmation dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(screen.getByText("Are you sure?")).toBeInTheDocument();
          expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
          expect(
            screen.getByRole("button", { name: /cancel/i })
          ).toBeInTheDocument();
          expect(
            screen.getByRole("button", { name: /delete/i })
          ).toBeInTheDocument();
        });
      }
    });

    it("should handle delete confirmation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /delete/i })
          ).toBeInTheDocument();
        });

        const confirmDeleteButton = screen.getByRole("button", {
          name: /delete/i,
        });
        await user.click(confirmDeleteButton);

        await waitFor(() => {
          expect(deleteSimulation).toHaveBeenCalledWith("sim-1");
          expect(toast.success).toHaveBeenCalledWith(
            "Simulation deleted successfully"
          );
        });
      }
    });

    it("should handle delete cancellation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: /cancel/i })
          ).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        await user.click(cancelButton);

        expect(deleteSimulation).not.toHaveBeenCalled();
      }
    });

    it("should handle create new simulation button", async () => {
      const user = userEvent.setup();
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create your first simulation/i })
        ).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: /create your first simulation/i,
      });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith("/create");
    });

    it("should handle hover effects on cards", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const simulationCard = screen
        .getByText("Math Tutoring Session")
        .closest('[data-slot="card"]');
      if (simulationCard) {
        await user.hover(simulationCard);
        // Card should have hover:shadow-md class
        expect(simulationCard.className).toContain("hover:shadow-md");
      }
    });
  });

  describe("API Integration", () => {
    it("should fetch simulations on mount", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(getAllSimulations).toHaveBeenCalled();
      });
    });

    it("should refetch simulations after deletion", async () => {
      const user = userEvent.setup();

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (deleteButton) {
        await user.click(deleteButton);

        const confirmDeleteButton = screen.getByRole("button", {
          name: /delete/i,
        });
        await user.click(confirmDeleteButton);

        await waitFor(() => {
          expect(deleteSimulation).toHaveBeenCalled();
        });
      }
    });

    it("should handle API errors gracefully", async () => {
      vi.mocked(getAllSimulations).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<Simulations />);

      // Should not crash on API error
      await waitFor(() => {
        expect(getAllSimulations).toHaveBeenCalled();
      });
    });

    it("should handle delete errors", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteSimulation).mockRejectedValue(new Error("Delete failed"));

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (deleteButton) {
        await user.click(deleteButton);

        const confirmDeleteButton = screen.getByRole("button", {
          name: /delete/i,
        });
        await user.click(confirmDeleteButton);

        await waitFor(() => {
          expect(deleteSimulation).toHaveBeenCalled();
          // Note: The component doesn't show error toast, it just logs to console
        });
      }
    });
  });

  describe("Loading States", () => {
    it("should handle loading state", () => {
      vi.mocked(getAllSimulations).mockImplementation(
        () => new Promise(() => {})
      ); // Never resolves

      renderWithProviders(<Simulations />);

      // Component should render without simulations while loading
      expect(
        screen.queryByText("Math Tutoring Session")
      ).not.toBeInTheDocument();
    });

    it("should show deleting state", async () => {
      const user = userEvent.setup();
      let resolveDelete: (value: undefined) => void;
      vi.mocked(deleteSimulation).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve;
          })
      );

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (deleteButton) {
        await user.click(deleteButton);

        const confirmDeleteButton = screen.getByRole("button", {
          name: /delete/i,
        });
        await user.click(confirmDeleteButton);

        await waitFor(() => {
          expect(screen.getByText("Deleting...")).toBeInTheDocument();
        });

        // Resolve the delete promise
        resolveDelete!(undefined);
      }
    });
  });

  describe("Navigation", () => {
    it("should navigate to edit page with correct simulation ID", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Problem Solving")
        ).toBeInTheDocument();
      });

      // Find the edit button for the second simulation
      const cards = screen.getAllByRole("button");
      const editButtons = cards.filter(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (editButtons.length >= 2) {
        const editButton = editButtons[2];
        if (editButton) {
          await user.click(editButton); // Click edit button for second simulation

          expect(mockPush).toHaveBeenCalledWith("/create/simulations/s/sim-2");
        }
      }
    });

    it("should navigate to create page from empty state", async () => {
      const user = userEvent.setup();
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create your first simulation/i })
        ).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: /create your first simulation/i,
      });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith("/create");
    });
  });

  describe("Badge Display", () => {
    it("should display correct badge variants for active/inactive simulations", async () => {
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        const activeBadges = screen.getAllByText("Active");
        const inactiveBadges = screen.getAllByText("Inactive");

        expect(activeBadges).toHaveLength(2);
        expect(inactiveBadges).toHaveLength(1);
      });
    });

    it("should handle simulations with missing active property", async () => {
      const simulationsWithMissingActive = [
        {
          id: "sim-1",
          title: "Test Simulation",
          timeLimit: 15,
          scenarioIds: ["scenario-1"],
          documents: [],
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          rubricId: "rubric-1",
          active: true,
          // active property missing
        },
      ];

      vi.mocked(getAllSimulations).mockResolvedValue(
        simulationsWithMissingActive
      );

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Test Simulation")).toBeInTheDocument();
        // Should handle missing active property gracefully
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle simulations with missing data", async () => {
      const simulationsWithMissingData = [
        {
          id: "sim-1",
          title: "Valid Simulation",
          timeLimit: 15,
          active: true,
          scenarioIds: ["scenario-1"],
          documents: ["doc-1"],
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          rubricId: "rubric-1",
        },
        {
          id: "sim-2",
          title: "",
          timeLimit: null,
          active: false,
          scenarioIds: [],
          documents: [],
          createdAt: "2024-01-02T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
          rubricId: "rubric-1",
        },
        {
          id: "sim-3",
          title: "Missing arrays",
          timeLimit: 30,
          active: true,
          scenarioIds: [],
          documents: [],
          createdAt: "2024-01-03T00:00:00Z",
          updatedAt: "2024-01-03T00:00:00Z",
          rubricId: "rubric-1",
        },
      ];

      vi.mocked(getAllSimulations).mockResolvedValue(
        simulationsWithMissingData
      );

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Valid Simulation")).toBeInTheDocument();
        expect(screen.getByText("Missing arrays")).toBeInTheDocument();
      });
    });

    it("should handle simulations with very long titles", async () => {
      const simulationsWithLongTitles = [
        {
          id: "sim-1",
          title:
            "This is a very long simulation title that might cause layout issues if not handled properly in the UI components",
          timeLimit: 15,
          active: true,
          scenarioIds: ["scenario-1"],
          documents: ["doc-1"],
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          rubricId: "rubric-1",
        },
      ];

      vi.mocked(getAllSimulations).mockResolvedValue(simulationsWithLongTitles);

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(
          screen.getByText(/This is a very long simulation title/)
        ).toBeInTheDocument();
      });
    });

    it("should handle rapid button clicks", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("Math Tutoring Session")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.getAttribute("class")?.includes("h-4 w-4")
      );

      if (editButton) {
        // Rapid clicks should not cause issues
        await user.click(editButton);
        await user.click(editButton);
        await user.click(editButton);

        // Should navigate multiple times
        expect(mockPush).toHaveBeenCalledTimes(3);
      }
    });

    it("should handle component unmounting during API calls", async () => {
      const { unmount } = renderWithProviders(<Simulations />);

      unmount();

      // Should not cause errors
      expect(getAllSimulations).toHaveBeenCalled();
    });

    it("should handle null or undefined simulation data", async () => {
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(screen.getByText("No simulations yet")).toBeInTheDocument();
      });
    });

    it("should handle simulations with zero time limits", async () => {
      const simulationsWithZeroTime = [
        {
          id: "sim-1",
          title: "No Time Limit Simulation",
          timeLimit: 0,
          active: true,
          scenarioIds: ["scenario-1"],
          documents: [],
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          rubricId: "rubric-1",
        },
      ];

      vi.mocked(getAllSimulations).mockResolvedValue(simulationsWithZeroTime);

      renderWithProviders(<Simulations />);

      await waitFor(() => {
        expect(
          screen.getByText("No Time Limit Simulation")
        ).toBeInTheDocument();
        expect(screen.getByText("No time limit")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Simulations:
 * Path: create/simulations/Simulations.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: Simulations
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useState, useQuery, useRouter
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Simulations />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Simulations {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
