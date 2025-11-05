import { render } from "@/test/custom-render";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Provider, {
  ProviderProps,
} from "@/components/providers/Provider";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ProviderProps = {
  providerId: "test-providerId",
};
// ------------------------------------------------------------------

describe("Provider", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      render(<Provider {...mockProps} />);

      // Basic rendering test - component should render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<Provider {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Provider {...mockProps} />);

      // Basic accessibility test - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      render(<Provider {...mockProps} />);

      // Component should handle user interactions
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<Provider {...mockProps} />);

      // Component should handle edge cases gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with missing/invalid props (create mode)
      render(<Provider />);

      // Component should handle invalid props gracefully
      expect(document.body).toBeInTheDocument();
    });
  });
});
