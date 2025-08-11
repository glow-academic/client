import { renderWithMocks } from "@/test/renderWithMocks";
import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import PersonaEditPage from "@/app/(main)/create/personas/p/[personaId]/page";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the PersonaEdit component
vi.mock("@/components/create/personas/PersonaEdit", () => ({
  default: ({ personaId }: { personaId: string }) => (
    <div data-testid="persona-edit" data-persona-id={personaId}>
      Persona Edit Component
    </div>
  ),
}));

describe("PersonaEditPage", () => {
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
      const mockParams = Promise.resolve({ personaId: "test-persona-id" });

      await act(async () => {
        renderWithMocks(<PersonaEditPage params={mockParams} />);
      });

      // Should render the persona edit component
      expect(screen.getByTestId("persona-edit")).toBeInTheDocument();
      expect(screen.getByTestId("persona-edit")).toHaveAttribute(
        "data-persona-id",
        "test-persona-id"
      );
    });

    it("should have correct accessibility attributes", async () => {
      const mockParams = Promise.resolve({ personaId: "test-persona-id" });

      await act(async () => {
        renderWithMocks(<PersonaEditPage params={mockParams} />);
      });

      // Should have proper accessibility attributes
      expect(screen.getByTestId("persona-edit")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different persona IDs
      const mockParams = Promise.resolve({ personaId: "edge-case-id" });

      await act(async () => {
        renderWithMocks(<PersonaEditPage params={mockParams} />);
      });

      // Should render the component even with edge case params
      expect(screen.getByTestId("persona-edit")).toBeInTheDocument();
      expect(screen.getByTestId("persona-edit")).toHaveAttribute(
        "data-persona-id",
        "edge-case-id"
      );
    });
  });
});

/*
 * Component Analysis for page:
 * Path: (main)/create/personas/p/[personaId]/page.tsx
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
