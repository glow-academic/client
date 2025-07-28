/**
 * Rubrics.test.tsx
 * Tests for the Rubrics component, focusing on duplication functionality
 */
import Rubrics from "@/components/create/rubrics/Rubrics";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { duplicateRubric } from "@/utils/rubric/duplicate-rubric";

describe("Rubrics Component - Duplication Tests", () => {
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

  describe("Rubric Duplication", () => {
    it("should allow duplicating default rubrics with standard groups and standards", async () => {
      const user = userEvent.setup();

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

      // Mock rubrics data with a default rubric
      const mockRubricsData = [
        {
          id: "rubric-1",
          name: "Test Rubric",
          description: "A test rubric",
          points: 100,
          passPoints: 70,
          defaultRubric: true,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "rubric-2",
          name: "Non-Default Rubric",
          description: "A non-default rubric",
          points: 50,
          passPoints: 35,
          defaultRubric: false,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getAllRubrics).mockResolvedValue(mockRubricsData);

      renderWithMocks(<Rubrics />);

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.getByText("Test Rubric")).toBeInTheDocument();
      });

      // Find and click the duplicate button for the default rubric
      const duplicateButton = screen.getByText("Duplicate");
      await user.click(duplicateButton);

      // Verify the duplicate function was called with correct parameters
      await waitFor(() => {
        expect(duplicateRubric).toHaveBeenCalledWith(
          "rubric-1",
          "Test Rubric Copy"
        );
      });
    });

    it("should not allow duplicating non-default rubrics", async () => {
      // Mock rubrics data with only non-default rubrics
      const mockRubricsData = [
        {
          id: "rubric-2",
          name: "Non-Default Rubric",
          description: "A non-default rubric",
          points: 50,
          passPoints: 35,
          defaultRubric: false,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getAllRubrics).mockResolvedValue(mockRubricsData);

      renderWithMocks(<Rubrics />);

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.getByText("Non-Default Rubric")).toBeInTheDocument();
      });

      // The non-default rubric should not have a duplicate button
      const duplicateButtons = screen.queryAllByText("Duplicate");
      expect(duplicateButtons).toHaveLength(0);
    });

    it("should show error message when duplication fails", async () => {
      const user = userEvent.setup();

      // Mock the duplicateRubric function to throw an error
      vi.mocked(duplicateRubric).mockRejectedValue(
        new Error("Duplication failed")
      );

      // Mock rubrics data with a default rubric
      const mockRubricsData = [
        {
          id: "rubric-1",
          name: "Test Rubric",
          description: "A test rubric",
          points: 100,
          passPoints: 70,
          defaultRubric: true,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getAllRubrics).mockResolvedValue(mockRubricsData);

      renderWithMocks(<Rubrics />);

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.getByText("Test Rubric")).toBeInTheDocument();
      });

      // Find and click the duplicate button
      const duplicateButton = screen.getByText("Duplicate");
      await user.click(duplicateButton);

      // Verify error message is shown
      await waitFor(() => {
        expect(
          screen.getByText("Failed to duplicate rubric")
        ).toBeInTheDocument();
      });
    });

    it("should show loading state during duplication", async () => {
      const user = userEvent.setup();

      // Create a promise that doesn't resolve immediately
      let resolvePromise: (value: {
        id: string;
        name: string;
        description: string;
        points: number;
        passPoints: number;
        defaultRubric: boolean;
        active: boolean;
        createdAt: string;
        updatedAt: string;
      }) => void;
      const promise = new Promise<{
        id: string;
        name: string;
        description: string;
        points: number;
        passPoints: number;
        defaultRubric: boolean;
        active: boolean;
        createdAt: string;
        updatedAt: string;
      }>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(duplicateRubric).mockReturnValue(promise);

      // Mock rubrics data with a default rubric
      const mockRubricsData = [
        {
          id: "rubric-1",
          name: "Test Rubric",
          description: "A test rubric",
          points: 100,
          passPoints: 70,
          defaultRubric: true,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getAllRubrics).mockResolvedValue(mockRubricsData);

      renderWithMocks(<Rubrics />);

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.getByText("Test Rubric")).toBeInTheDocument();
      });

      // Find and click the duplicate button
      const duplicateButton = screen.getByText("Duplicate");
      await user.click(duplicateButton);

      // Verify loading spinner is shown
      await waitFor(() => {
        const loadingSpinner = document.querySelector(".animate-spin");
        expect(loadingSpinner).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise!({
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

    it("should show success message when duplication succeeds", async () => {
      const user = userEvent.setup();

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

      // Mock rubrics data with a default rubric
      const mockRubricsData = [
        {
          id: "rubric-1",
          name: "Test Rubric",
          description: "A test rubric",
          points: 100,
          passPoints: 70,
          defaultRubric: true,
          active: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getAllRubrics).mockResolvedValue(mockRubricsData);

      renderWithMocks(<Rubrics />);

      // Wait for the component to load
      await waitFor(() => {
        expect(screen.getByText("Test Rubric")).toBeInTheDocument();
      });

      // Find and click the duplicate button
      const duplicateButton = screen.getByText("Duplicate");
      await user.click(duplicateButton);

      // Verify success message is shown
      await waitFor(() => {
        expect(
          screen.getByText('Rubric "Test Rubric" duplicated successfully')
        ).toBeInTheDocument();
      });
    });
  });
});
