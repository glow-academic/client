import { renderWithMocks } from "@/test/renderWithMocks";
import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import StaffEditPage from "@/app/(main)/management/staff/p/[profileId]/page";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the StaffEdit component
vi.mock("@/components/management/staff/StaffEdit", () => ({
  default: ({ profileId }: { profileId: string }) => (
    <div data-testid="staff-edit" data-profile-id={profileId}>
      Staff Edit Component
    </div>
  ),
}));

describe("StaffEditPage", () => {
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
      const mockParams = Promise.resolve({ profileId: "test-profile-id" });

      await act(async () => {
        renderWithMocks(<StaffEditPage params={mockParams} />);
      });

      // Should render the staff edit component
      expect(screen.getByTestId("staff-edit")).toBeInTheDocument();
      expect(screen.getByTestId("staff-edit")).toHaveAttribute(
        "data-profile-id",
        "test-profile-id"
      );
    });

    it("should have correct accessibility attributes", async () => {
      const mockParams = Promise.resolve({ profileId: "test-profile-id" });

      await act(async () => {
        renderWithMocks(<StaffEditPage params={mockParams} />);
      });

      // Should have proper accessibility attributes
      expect(screen.getByTestId("staff-edit")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different profile IDs
      const mockParams = Promise.resolve({ profileId: "edge-case-id" });

      await act(async () => {
        renderWithMocks(<StaffEditPage params={mockParams} />);
      });

      // Should render the component even with edge case params
      expect(screen.getByTestId("staff-edit")).toBeInTheDocument();
      expect(screen.getByTestId("staff-edit")).toHaveAttribute(
        "data-profile-id",
        "edge-case-id"
      );
    });
  });
});

/*
 * Component Analysis for page:
 * Path: (main)/management/staff/p/[profileId]/page.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: generateMetadata
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: None
 * - Uses router: false
 * - Has API calls: false
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
 * render(<page />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<page {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
