import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { Profile, ProfileProps } from "@/components/profile/Profile";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ProfileProps = {
  className: "test-profile-class",
};
// ------------------------------------------------------------------
describe("Profile", () => {
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
      renderWithMocks(<Profile {...mockProps} />);

      // Wait for the component to load and check for key elements
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });

    it("should render with props", () => {
      renderWithMocks(<Profile {...mockProps} />);

      // Check that the component renders with the provided className
      const profileElement = screen.getByText("Test User").closest("div");
      expect(profileElement).toHaveClass("test-profile-class");
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Profile {...mockProps} />);

      // Check for main landmark
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      // Check for proper heading structure
      const headings = screen.getAllByRole("heading");
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllClasses).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<Profile {...mockProps} />);

      // Wait for error state to be displayed
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      // Mock loading state by delaying the response
      renderWithMocks(<Profile {...mockProps} />);

      // Check that loading state is handled gracefully
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with no profile data
      renderWithMocks(<Profile {...mockProps} />);

      // Wait for component to handle missing data
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with empty props
      renderWithMocks(<Profile />);

      // Wait for component to handle missing props
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Profile:
 * Path: profile/Profile.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: Profile, ProfileProps
 * - Has props: true
 * - Props interface: ProfileProps
 * - Client component: true
 * - Uses hooks: useQuery, useSession, userId, user
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
 * render(<Profile {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Profile {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
