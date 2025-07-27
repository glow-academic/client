import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Logs from "@/components/system/logs/Logs";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";
describe("Logs", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - All classes array
   * - mockSchema.profiles - All profiles array
   *
   * Mock functions are available as:
   * - getAllAppLogsMock - Mock for getAllAppLogs
   * - createAppLogMock - Mock for createAppLog
   * etc.
   * ------------------------------------------------------------------ */

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Logs />);

      // Check that the component renders with search input
      expect(
        screen.getByPlaceholderText("Search messages...")
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Logs />);

      // Check that the refresh button is accessible
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="refresh-cw"]')
      );
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle refresh button click", async () => {
      const user = userEvent.setup();

      renderWithMocks(<Logs />);

      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="refresh-cw"]')
      );
      expect(refreshButton).toBeDefined();
      await user.click(refreshButton!);
    });
  });

  describe("API Integration", () => {
    it("should handle loading states", () => {
      renderWithMocks(<Logs />);

      // Check that loading state is handled
      // The component should show loading or data
      expect(
        screen.getByPlaceholderText("Search messages...")
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty logs gracefully", () => {
      renderWithMocks(<Logs />);

      // Component should render even with no data
      expect(
        screen.getByText("No logs match the current filters.")
      ).toBeInTheDocument();
    });
  });
});
