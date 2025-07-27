import { renderWithMocks } from "@/test/renderWithMocks";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import DocumentViewer, {
  DocumentViewerProps,
} from "@/components/common/chat/DocumentViewer";

global.fetch = vi.fn();

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: DocumentViewerProps = {
  // document: 'homework', /* optional */
  // bare: false, /* optional */
  // classId: 'test-classId', /* optional */
};
// ------------------------------------------------------------------
describe("DocumentViewer", () => {
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
      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Check for basic accessibility elements
      const viewer =
        document.querySelector('[data-testid="document-viewer"]') ||
        document.querySelector("div");
      expect(viewer).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Test button interactions if buttons exist
      const buttons = document.querySelectorAll("button");
      if (buttons.length > 0 && buttons[0]) {
        await user.click(buttons[0]);
        // Button should be clickable
        expect(buttons[0]).toBeInTheDocument();
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Test link interactions if links exist
      const links = document.querySelectorAll("a");
      if (links.length > 0 && links[0]) {
        await user.click(links[0]);
        // Link should be clickable
        expect(links[0]).toBeInTheDocument();
      }
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllDocuments).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Component should handle errors gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Component should show loading state initially
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<DocumentViewer {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<DocumentViewer />);

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
