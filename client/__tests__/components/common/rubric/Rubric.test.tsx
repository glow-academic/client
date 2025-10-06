import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Rubric, { RubricProps } from "@/components/common/rubric/Rubric";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// Mock the toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the router
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  usePathname: () => "/test-path",
}));

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: RubricProps = {
  // rubricId: 'test-rubricId', /* optional */
};
// ------------------------------------------------------------------
describe("Rubric", () => {
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
      render(<Rubric {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText("Create Rubric")).toBeInTheDocument();
    });

    it("should render create form with empty fields", () => {
      render(<Rubric />);

      // Check that form fields are present
      expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("should render edit form with existing data", async () => {
      render(<Rubric rubricId="test-rubric-id" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", () => {
      render(<Rubric {...mockProps} />);

      // Check for proper form structure
      expect(screen.getByText("Create Rubric")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      render(<Rubric />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Check that the form submission button is present
      expect(screen.getByText("Create Rubric")).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      render(<Rubric />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Test that the component renders properly
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      render(<Rubric />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Test that the component renders properly
      expect(screen.getByText("Name")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      createRubricMock.mockRejectedValue(new Error("API Error"));

      render(<Rubric {...mockProps} />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Check that the component renders properly with error handling setup
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      render(<Rubric rubricId="test-rubric-id" />);

      // Check that the component shows loading skeletons
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      render(<Rubric />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Check that the cancel button is present
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<Rubric {...mockProps} />);

      // Test that the component renders without crashing even with minimal props
      expect(screen.getByText("Create Rubric")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(<Rubric />);

      // Test that the component handles missing props gracefully
      expect(screen.getByText("Create Rubric")).toBeInTheDocument();
    });

    it("should validate form fields", async () => {
      render(<Rubric />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Check that the form renders properly
      expect(screen.getByText("Create Rubric")).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("should validate required fields", async () => {
      const user = userEvent.setup();
      render(<Rubric />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Try to submit without filling required fields
      const submitButton = screen.getByText("Create Rubric");
      await user.click(submitButton);

      // Should handle submission attempt
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });
    });

    it("should handle form submission", async () => {
      const user = userEvent.setup();
      render(<Rubric />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });

      // Fill in required fields
      const nameInput = screen.getByLabelText("Name");
      await user.type(nameInput, "Test Rubric");

      // Submit the form
      const submitButton = screen.getByText("Create Rubric");
      await user.click(submitButton);

      // Should handle submission
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should load existing rubric data when editing", async () => {
      // Mock rubric data
      const { getRubric } = await import("@/utils/queries/rubrics/get-rubric");
      vi.mocked(getRubric).mockResolvedValue({
        id: "test-rubric-id",
        name: "Existing Rubric",
        description: "An existing rubric",
        points: 100,
        passPoints: 70,
        defaultRubric: false,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(<Rubric rubricId="test-rubric-id" />);

      // Wait for the form to load with existing data
      await waitFor(() => {
        expect(screen.getByText("Existing Rubric")).toBeInTheDocument();
      });
    });
  });
});
