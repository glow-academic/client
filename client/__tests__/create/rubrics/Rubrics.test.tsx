import Rubrics from "@/components/create/rubrics/Rubrics";
import { renderWithProviders } from "@/mocks/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  },
}));

vi.mock("@/utils/logger", () => ({
  logError: vi.fn(),
}));

// Import the mocked functions after mocking
import { rubrics as mockRubrics } from "@/mocks/schema";
import { deleteRubric } from "@/utils/mutations/rubrics/delete-rubric";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";

describe("Rubrics", () => {
  const mockPush = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    const { useRouter } = await import("next/navigation");
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderWithProviders(<Rubrics />);

      // Check for empty state when no rubrics
      expect(screen.getByText("No rubrics yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Create your first evaluation rubric to define assessment criteria"
        )
      ).toBeInTheDocument();
    });

    it("should render create button in empty state", () => {
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderWithProviders(<Rubrics />);

      expect(
        screen.getByRole("button", { name: /create your first rubric/i })
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle create new rubric button click in empty state", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      const createButton = screen.getByRole("button", {
        name: /create your first rubric/i,
      });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith("/create/rubrics/new");
    });

    it("should handle edit rubric", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubrics[0]]);

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      // Wait for rubric to load
      await waitFor(() => {
        expect(screen.getByText(mockRubrics[0].name)).toBeInTheDocument();
      });

      // Find edit button (icon only button)
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.querySelector("svg")?.classList.contains("lucide-square-pen")
      );

      expect(editButton).toBeInTheDocument();
      await user.click(editButton!);

      expect(mockPush).toHaveBeenCalledWith(
        `/create/rubrics/r/${mockRubrics[0].id}`
      );
    });

    it("should handle delete confirmation dialog", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubrics[0]]);

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      // Wait for rubric to load
      await waitFor(() => {
        expect(screen.getByText(mockRubrics[0].name)).toBeInTheDocument();
      });

      // Find delete button (icon only button with trash icon)
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.querySelector("svg")?.classList.contains("lucide-trash2")
      );

      expect(deleteButton).toBeInTheDocument();
      await user.click(deleteButton!);

      // Check if delete dialog appears
      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle API calls", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderWithProviders(<Rubrics />);

      await waitFor(() => {
        expect(getAllRubrics).toHaveBeenCalled();
      });
    });

    it("should handle loading states", () => {
      vi.mocked(getAllRubrics).mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<Rubrics />);

      // Component should render even during loading (will show empty state)
      expect(screen.getByText("No rubrics yet")).toBeInTheDocument();
    });

    it("should handle error states", async () => {
      vi.mocked(getAllRubrics).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<Rubrics />);

      // Component should still render with error (will show empty state)
      expect(screen.getByText("No rubrics yet")).toBeInTheDocument();
    });

    it("should handle empty state", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderWithProviders(<Rubrics />);

      // Check for empty state message
      await waitFor(() => {
        expect(screen.getByText("No rubrics yet")).toBeInTheDocument();
      });
      expect(
        screen.getByText(
          "Create your first evaluation rubric to define assessment criteria"
        )
      ).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("should display rubric information correctly", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubrics[0]]);

      renderWithProviders(<Rubrics />);

      // Check if rubric data is displayed
      await waitFor(() => {
        expect(screen.getByText(mockRubrics[0].name)).toBeInTheDocument();
      });
      expect(screen.getByText(mockRubrics[0].description)).toBeInTheDocument();
      expect(
        screen.getByText(`${mockRubrics[0].points} total points`)
      ).toBeInTheDocument();
    });

    it("should calculate pass percentage correctly", async () => {
      const highStandardRubric = {
        ...mockRubrics[0],
        passPoints: 85,
        points: 100,
      };

      vi.mocked(getAllRubrics).mockResolvedValue([highStandardRubric]);

      renderWithProviders(<Rubrics />);

      // Check if high standard badge is shown for 85% pass rate
      await waitFor(() => {
        expect(screen.getByText("High Standard")).toBeInTheDocument();
      });
      expect(screen.getByText(/Pass: 85 pts \(85%\)/)).toBeInTheDocument();
    });

    it("should show standard badge for 70% pass rate", async () => {
      const standardRubric = {
        ...mockRubrics[0],
        passPoints: 70,
        points: 100,
      };

      vi.mocked(getAllRubrics).mockResolvedValue([standardRubric]);

      renderWithProviders(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByText("Standard")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      vi.mocked(getAllRubrics).mockResolvedValue([]);

      renderWithProviders(<Rubrics />);

      // Component should render without errors
      expect(screen.getByText("No rubrics yet")).toBeInTheDocument();
    });

    it("should handle rubrics with zero points", async () => {
      const zeroPointsRubric = {
        ...mockRubrics[0],
        name: "Zero Points Rubric",
        points: 0,
        passPoints: 0,
      };

      vi.mocked(getAllRubrics).mockResolvedValue([zeroPointsRubric]);

      renderWithProviders(<Rubrics />);

      // Should handle zero points without crashing
      await waitFor(() => {
        expect(screen.getByText("Zero Points Rubric")).toBeInTheDocument();
      });
      expect(screen.getByText("0 total points")).toBeInTheDocument();
    });

    it("should handle rubrics without description", async () => {
      const noDescriptionRubric = {
        ...mockRubrics[0],
        name: "No Description Rubric",
        description: "",
      };

      vi.mocked(getAllRubrics).mockResolvedValue([noDescriptionRubric]);

      renderWithProviders(<Rubrics />);

      await waitFor(() => {
        expect(screen.getByText("No Description Rubric")).toBeInTheDocument();
      });
      // Description should not be displayed if empty
      expect(screen.queryByText("")).not.toBeInTheDocument();
    });
  });

  describe("Delete Functionality", () => {
    it("should handle successful delete", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubrics[0]]);
      vi.mocked(deleteRubric).mockResolvedValue(undefined);

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      // Wait for rubric to load
      await waitFor(() => {
        expect(screen.getByText(mockRubrics[0].name)).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.querySelector("svg")?.classList.contains("lucide-trash2")
      );

      await user.click(deleteButton!);

      // Confirm delete in dialog
      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      expect(deleteRubric).toHaveBeenCalledWith(mockRubrics[0].id);
    });

    it("should handle delete cancellation", async () => {
      vi.mocked(getAllRubrics).mockResolvedValue([mockRubrics[0]]);

      const user = userEvent.setup();
      renderWithProviders(<Rubrics />);

      // Wait for rubric to load
      await waitFor(() => {
        expect(screen.getByText(mockRubrics[0].name)).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg") &&
          button.querySelector("svg")?.classList.contains("lucide-trash2")
      );

      await user.click(deleteButton!);

      // Cancel delete in dialog
      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
      });

      expect(deleteRubric).not.toHaveBeenCalled();
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
 * expect(screen.getByText('No rubrics yet')).toBeInTheDocument();
 *
 * User interaction:
 * const createButton = screen.getByRole('button', { name: /create your first rubric/i });
 * await user.click(createButton);
 * expect(mockPush).toHaveBeenCalledWith('/create/rubrics/new');
 *
 * API integration:
 * vi.mocked(getAllRubrics).mockResolvedValue([mockRubric]);
 * renderWithProviders(<Rubrics />);
 * expect(getAllRubrics).toHaveBeenCalled();
 */
