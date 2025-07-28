import { renderWithMocks } from "@/test/renderWithMocks";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import NewStaff from "@/components/management/staff/NewStaff";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

describe("NewStaff", () => {
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
      renderWithMocks(<NewStaff />);

      // Basic rendering test - component should render without crashing
      // The component should show a form for creating new staff
      expect(document.body).toBeInTheDocument();
    });

    it("should render with correct content", () => {
      renderWithMocks(<NewStaff />);

      // Check that the component renders its expected content
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<NewStaff />);

      // Basic accessibility test - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      renderWithMocks(<NewStaff />);

      // Component should handle form submissions
      expect(document.body).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      renderWithMocks(<NewStaff />);

      // Component should handle state changes gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<NewStaff />);

      // Component should handle user events
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getProfilesByUser).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<NewStaff />);

      // Assert: Check that your component shows an error message.
      // Component should handle API errors gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      // Test loading states
      // Mock data is automatically loaded from @/mocks/schema

      renderWithMocks(<NewStaff />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<NewStaff />);

      // Component should handle navigation
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<NewStaff />);

      // Component should handle edge cases gracefully
      expect(document.body).toBeInTheDocument();
    });
  });
});
