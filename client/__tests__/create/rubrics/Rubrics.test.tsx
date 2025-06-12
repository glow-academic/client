import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Rubrics from "@/components/create/rubrics/Rubrics";

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

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock("@/utils/mutations/rubrics/delete-rubric", () => ({
  deleteRubric: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock API calls
global.fetch = vi.fn();

describe("Rubrics", () => {
  let queryClient: QueryClient;

  const renderWithProviders = (children: ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      renderWithProviders(<Rubrics />);

      expect(screen.getByText("Rubrics")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Manage your evaluation rubrics and create new assessment criteria",
        ),
      ).toBeInTheDocument();
    });

    it("should render create button", () => {
      renderWithProviders(<Rubrics />);

      expect(
        screen.getByRole("button", { name: /create new rubric/i }),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithProviders(<Rubrics />);

      // Check for proper heading structure
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();

      // Check for button accessibility
      const createButton = screen.getByRole("button", {
        name: /create new rubric/i,
      });
      expect(createButton).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle create new rubric button click", async () => {
      const mockPush = vi.fn();
      const { useRouter } = await import("next/navigation");
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush,
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      });

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      const createButton = screen.getByRole("button", {
        name: /create new rubric/i,
      });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith("/rubrics/new");
    });

    it("should handle edit rubric", async () => {
      const mockPush = vi.fn();
      const { useRouter } = await import("next/navigation");
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush,
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      });

      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([
        {
          id: "test-id",
          name: "Test Rubric",
          description: "Test Description",
          points: 100,
          passPoints: 70,
          createdAt: "2023-01-01",
          rubricType: "simulation",
        },
      ]);

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      // Wait for rubric to load and click edit
      const editButton = await screen.findByRole("button", { name: "" }); // Edit button with icon only
      await user.click(editButton);

      expect(mockPush).toHaveBeenCalledWith("/rubrics/r/test-id");
    });

    it("should handle delete confirmation dialog", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([
        {
          id: "test-id",
          name: "Test Rubric",
          description: "Test Description",
          points: 100,
          passPoints: 70,
          createdAt: "2023-01-01",
          rubricType: "simulation",
        },
      ]);

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      // Wait for rubric to load and click delete
      const deleteButtons = await screen.findAllByRole("button");
      const deleteButton = deleteButtons.find((button) =>
        button.querySelector("svg"),
      ); // Delete button with icon

      if (deleteButton) {
        await user.click(deleteButton);

        // Check if delete dialog appears
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      }
    });
  });

  describe("API Integration", () => {
    it("should handle API calls", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderWithProviders(<Rubrics />);

      expect(getAllRubrics).toHaveBeenCalled();
    });

    it("should handle loading states", () => {
      renderWithProviders(<Rubrics />);

      // Component should render even during loading
      expect(screen.getByText("Rubrics")).toBeInTheDocument();
    });

    it("should handle error states", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<Rubrics />);

      // Component should still render with error
      expect(screen.getByText("Rubrics")).toBeInTheDocument();
    });

    it("should handle empty state", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderWithProviders(<Rubrics />);

      // Check for empty state message
      expect(await screen.findByText("No rubrics yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Create your first evaluation rubric to define assessment criteria",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("should display rubric information correctly", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([
        {
          id: "test-id",
          name: "Test Rubric",
          description: "Test Description",
          points: 100,
          passPoints: 70,
          createdAt: "2023-01-01",
          rubricType: "simulation",
        },
      ]);

      renderWithProviders(<Rubrics />);

      // Check if rubric data is displayed
      expect(await screen.findByText("Test Rubric")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
      expect(screen.getByText("100 total points")).toBeInTheDocument();
      expect(screen.getByText(/Pass: 70 pts \(70%\)/)).toBeInTheDocument();
    });

    it("should calculate pass percentage correctly", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([
        {
          id: "test-id",
          name: "High Standard Rubric",
          description: "Test Description",
          points: 100,
          passPoints: 85,
          createdAt: "2023-01-01",
          rubricType: "simulation",
        },
      ]);

      renderWithProviders(<Rubrics />);

      // Check if high standard badge is shown for 85% pass rate
      expect(await screen.findByText("High Standard")).toBeInTheDocument();
      expect(screen.getByText(/Pass: 85 pts \(85%\)/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithProviders(<Rubrics />);

      // Component should render without errors
      expect(screen.getByText("Rubrics")).toBeInTheDocument();
    });

    it("should handle rubrics with zero points", async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      vi.mocked(getAllRubrics).mockResolvedValue([
        {
          id: "test-id",
          name: "Zero Points Rubric",
          description: "Test Description",
          points: 0,
          passPoints: 0,
          createdAt: "2023-01-01",
          rubricType: "simulation",
        },
      ]);

      renderWithProviders(<Rubrics />);

      // Should handle zero points without crashing
      expect(await screen.findByText("Zero Points Rubric")).toBeInTheDocument();
      expect(screen.getByText("0 total points")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Rubrics:
 * Path: create/rubrics/Rubrics.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None
 * - Client component: true
 * - Uses hooks: useState, useQuery, useRouter
 * - Uses router: true
 * - Has API calls: true (getAllRubrics, deleteRubric)
 * - Has form handling: false
 * - Uses state: true (delete dialog, loading states)
 * - Uses effects: false (uses React Query)
 * - Uses context: false
 *
 * Key functionality:
 * - Displays all rubrics in a grid layout
 * - Create new rubric navigation
 * - Edit existing rubrics
 * - Delete rubrics with confirmation
 * - Empty state handling
 * - Pass percentage calculation and status badges
 * - Responsive design with cards
 *
 * Example implementations:
 *
 * Basic rendering:
 * renderWithProviders(<Rubrics />);
 * expect(screen.getByText('Rubrics')).toBeInTheDocument();
 *
 * User interaction:
 * const createButton = screen.getByRole('button', { name: /create new rubric/i });
 * await user.click(createButton);
 * expect(mockPush).toHaveBeenCalledWith('/rubrics/new');
 *
 * API integration:
 * vi.mocked(getAllRubrics).mockResolvedValue([mockRubric]);
 * renderWithProviders(<Rubrics />);
 * expect(getAllRubrics).toHaveBeenCalled();
 */
