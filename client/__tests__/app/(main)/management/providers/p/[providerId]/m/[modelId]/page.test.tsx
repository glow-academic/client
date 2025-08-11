import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ModelEditPage from "@/app/(main)/management/providers/p/[providerId]/m/[modelId]/page";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the ModelEdit component
vi.mock("@/components/management/providers/ModelEdit", () => ({
  default: ({
    modelId,
    providerId,
  }: {
    modelId: string;
    providerId: string;
  }) => (
    <div
      data-testid="model-edit"
      data-model-id={modelId}
      data-provider-id={providerId}
    >
      Model Edit Component
    </div>
  ),
}));

// Mock the async page component
vi.mock(
  "@/app/(main)/management/providers/p/[providerId]/m/[modelId]/page",
  () => ({
    default: ({}: {
      params: Promise<{ providerId: string; modelId: string }>;
    }) => {
      const { providerId, modelId } = {
        providerId: "test-provider-id",
        modelId: "test-model-id",
      };
      return (
        <div
          data-testid="model-edit-page"
          data-model-id={modelId}
          data-provider-id={providerId}
        >
          <div
            data-testid="model-edit"
            data-model-id={modelId}
            data-provider-id={providerId}
          >
            Model Edit Component
          </div>
        </div>
      );
    },
  })
);

describe("ModelEditPage", () => {
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
      const mockParams = Promise.resolve({
        providerId: "test-provider-id",
        modelId: "test-model-id",
      });

      renderWithMocks(<ModelEditPage params={mockParams} />);

      // Should render the model edit component
      expect(screen.getByTestId("model-edit-page")).toBeInTheDocument();
      expect(screen.getByTestId("model-edit")).toBeInTheDocument();
      expect(screen.getByTestId("model-edit")).toHaveAttribute(
        "data-model-id",
        "test-model-id"
      );
      expect(screen.getByTestId("model-edit")).toHaveAttribute(
        "data-provider-id",
        "test-provider-id"
      );
    });

    it("should have correct accessibility attributes", async () => {
      const mockParams = Promise.resolve({
        providerId: "test-provider-id",
        modelId: "test-model-id",
      });

      renderWithMocks(<ModelEditPage params={mockParams} />);

      // Should have proper accessibility attributes
      expect(screen.getByTestId("model-edit-page")).toBeInTheDocument();
      expect(screen.getByTestId("model-edit")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different IDs
      const mockParams = Promise.resolve({
        providerId: "edge-case-provider",
        modelId: "edge-case-model",
      });

      renderWithMocks(<ModelEditPage params={mockParams} />);

      // Should render the component even with edge case params
      expect(screen.getByTestId("model-edit-page")).toBeInTheDocument();
      expect(screen.getByTestId("model-edit")).toBeInTheDocument();
      expect(screen.getByTestId("model-edit")).toHaveAttribute(
        "data-model-id",
        "test-model-id"
      );
      expect(screen.getByTestId("model-edit")).toHaveAttribute(
        "data-provider-id",
        "test-provider-id"
      );
    });
  });
});

/*
 * Component Analysis for page:
 * Path: (main)/management/providers/p/[providerId]/m/[modelId]/page.tsx
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
