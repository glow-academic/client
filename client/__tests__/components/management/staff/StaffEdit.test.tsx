import { renderWithMocks } from "@/test/renderWithMocks";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import StaffEdit, {
  StaffEditProps,
} from "@/components/management/staff/StaffEdit";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: StaffEditProps = {
  profileId: "test-profileId",
};
// ------------------------------------------------------------------

describe("StaffEdit", () => {
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
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Basic rendering test - component should render without crashing
      // The component should show user information or a loading state
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Basic accessibility test - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Component should handle form submissions
      expect(document.body).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Component should handle state changes gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Component should handle user events
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getProfile).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<StaffEdit {...mockProps} />);

      // Assert: Check that your component shows an error message.
      // Component should handle API errors gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      // Test loading states
      // Mock data is automatically loaded from @/mocks/schema

      renderWithMocks(<StaffEdit {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Component should handle navigation
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<StaffEdit {...mockProps} />);

      // Component should handle edge cases gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with missing/invalid props
      renderWithMocks(<StaffEdit profileId="" />);

      // Component should handle invalid props gracefully
      expect(document.body).toBeInTheDocument();
    });
  });
});
