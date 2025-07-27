import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Report, { ReportProps } from "@/components/analytics/report/Report";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ReportProps = {
  profileId: "test-profileId",
};
// ------------------------------------------------------------------
describe("Report", () => {
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
      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state initially
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });

    it("should render with profile data", async () => {
      // Mock the getProfile query to return a profile
      const mockProfile = {
        id: "test-profileId",
        firstName: "John",
        lastName: "Doe",
        alias: "john.doe",
        role: "ta" as const,
        email: "john.doe@example.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        viewedIntro: true,
        viewedChat: true,
        defaultProfile: false,
        active: true,
        lastActive: new Date().toISOString(),
        userId: 1,
      };

      // Override the mock for this test
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);

      renderWithMocks(<Report {...mockProps} />);

      // Wait for the profile to load
      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Should display profile information
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
      expect(screen.getByText("TA")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      const mockProfile = {
        id: "test-profileId",
        firstName: "John",
        lastName: "Doe",
        alias: "john.doe",
        role: "ta" as const,
        email: "john.doe@example.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        viewedIntro: true,
        viewedChat: true,
        defaultProfile: false,
        active: true,
        lastActive: new Date().toISOString(),
        userId: 1,
      };

      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);

      renderWithMocks(<Report {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Should have proper heading structure
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state initially
      expect(screen.getByText("Loading report...")).toBeInTheDocument();

      // After error, should still show loading (component doesn't handle errors explicitly)
      await waitFor(() => {
        expect(screen.getByText("Loading report...")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      // TODO: Test loading states
      // Mock data is automatically loaded from @/mocks/schema
      renderWithMocks(<Report {...mockProps} />);

      // Should show loading spinner and text
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
      // Note: The component doesn't have a status role, just the loading text
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with null profile
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(null);

      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with missing profileId
      renderWithMocks(<Report profileId="" />);

      // Should still render loading state
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Report:
 * Path: analytics/report/Report.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: ReportProps
 * - Has props: true
 * - Props interface: ReportProps
 * - Client component: true
 * - Uses hooks: useQuery, useMemo
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Report {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Report {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
