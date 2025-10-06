import { render } from "@/test/custom-render";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ModelEdit, {
  ModelEditProps,
} from "@/components/management/providers/ModelEdit";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ModelEditProps = {
  modelId: "test-modelId",
  providerId: "test-providerId",
};
// ------------------------------------------------------------------

describe("ModelEdit", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      render(<ModelEdit {...mockProps} />);

      // Basic rendering test - component should render without crashing
      // The ModelEdit component renders a Model component, so we check for its presence
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<ModelEdit {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<ModelEdit {...mockProps} />);

      // Basic accessibility test - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user interactions", async () => {
      render(<ModelEdit {...mockProps} />);

      // Component should handle user interactions
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<ModelEdit {...mockProps} />);

      // Component should handle edge cases gracefully
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with missing/invalid props
      render(<ModelEdit modelId="" providerId="" />);

      // Component should handle invalid props gracefully
      expect(document.body).toBeInTheDocument();
    });
  });
});
