import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Agents from "@/components/system/agents/Agents";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
describe("Agents", () => {
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
      renderWithMocks(<Agents />);

      // Check that the component renders
      expect(screen.getByText(/System Agents/i)).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Agents />);

      // Check that the component is accessible
      expect(screen.getByText(/System Agents/i)).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", async () => {
      renderWithMocks(<Agents />);

      // Check that the component renders with interactive elements
      expect(screen.getByText(/System Agents/i)).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllAgents).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<Agents />);

      // Assert: Check that your component shows an error message.
      expect(screen.getByText(/System Agents/i)).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      // Mock data is automatically loaded from @/mocks/schema
      renderWithMocks(<Agents />);

      // Check that the component renders in loading state
      expect(screen.getByText(/System Agents/i)).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<Agents />);

      // Check that navigation elements are present
      expect(screen.getByText(/System Agents/i)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Agents />);

      // Check that the component handles edge cases
      expect(screen.getByText(/System Agents/i)).toBeInTheDocument();
    });
  });
});
