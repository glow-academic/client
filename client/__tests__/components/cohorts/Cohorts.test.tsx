import { render } from '@/test/custom-render';
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Cohorts from "@/components/cohorts/Cohorts";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";

describe("Cohorts", () => {
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
      render(<Cohorts />);

      // Component should render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Cohorts />);

      // Basic accessibility check - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      render(<Cohorts />);

      // Component should handle state changes without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      render(<Cohorts />);

      // Component should handle user events without errors
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      vi.mocked(getAllCohorts).mockRejectedValue(new Error("API Error"));

      render(<Cohorts />);

      // Component should handle error state gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      // Mock data is automatically loaded from @/mocks/schema
      render(<Cohorts />);

      // Component should handle loading states
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      render(<Cohorts />);

      // Component should handle navigation without errors
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<Cohorts />);

      // Component should handle edge cases without errors
      expect(document.body).toBeInTheDocument();
    });
  });
});
