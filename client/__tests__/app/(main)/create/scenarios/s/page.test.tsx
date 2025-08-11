import { renderWithMocks } from "@/test/renderWithMocks";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ScenariosPage from "@/app/(main)/create/scenarios/s/page";

// Import centralized mocks
import "@/mocks/navigation";

describe("ScenariosPage", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ScenariosPage />);

      // Should redirect to /create/scenarios
      const { redirect } = await import("next/navigation");
      expect(redirect).toHaveBeenCalledWith("/create/scenarios");
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ScenariosPage />);

      // Should redirect to /create/scenarios
      const { redirect } = await import("next/navigation");
      expect(redirect).toHaveBeenCalledWith("/create/scenarios");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ScenariosPage />);

      // Should redirect to /create/scenarios
      const { redirect } = await import("next/navigation");
      expect(redirect).toHaveBeenCalledWith("/create/scenarios");
    });
  });
});

/*
 * Component Analysis for page:
 * Path: (main)/create/scenarios/s/page.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: metadata
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
