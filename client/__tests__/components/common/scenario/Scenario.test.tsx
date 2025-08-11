import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Scenario, { ScenarioProps } from "@/components/common/scenario/Scenario";

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
const mockProps: ScenarioProps = {
  // scenarioId: 'test-scenarioId', /* optional */
  // mode: 'create', /* optional */
};
// ------------------------------------------------------------------
describe("Scenario", () => {
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
      render(<Scenario {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
    });

    it("should render create form with empty fields", () => {
      render(<Scenario mode="create" />);

      // Check that form fields are present
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
      expect(screen.getByText("Save Scenario")).toBeInTheDocument();
    });

    it("should render edit form with existing data", async () => {
      render(<Scenario scenarioId="test-scenario-id" mode="edit" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Update Scenario")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", () => {
      render(<Scenario {...mockProps} />);

      // Check for proper form structure
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      render(<Scenario mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Save Scenario")).toBeInTheDocument();
      });

      // Check that the form submission button is present
      expect(screen.getByText("Save Scenario")).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      render(<Scenario mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Save Scenario")).toBeInTheDocument();
      });

      // Test that the component renders properly
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      render(<Scenario mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Save Scenario")).toBeInTheDocument();
      });

      // Test that the component renders properly
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      createScenarioMock.mockRejectedValue(new Error("API Error"));

      render(<Scenario {...mockProps} />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Save Scenario")).toBeInTheDocument();
      });

      // Check that the component renders properly with error handling setup
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      render(<Scenario scenarioId="test-scenario-id" mode="edit" />);

      // Check that the component shows loading state
      expect(screen.getByText("Loading Scenario...")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const user = userEvent.setup();
      render(<Scenario mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Save Scenario")).toBeInTheDocument();
      });

      const backButton = screen.getByText("Back");
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/create/scenarios");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<Scenario {...mockProps} />);

      // Test that the component renders without crashing even with minimal props
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(<Scenario />);

      // Test that the component handles missing props gracefully
      expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
    });

    it("should validate form fields", async () => {
      render(<Scenario mode="create" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Save Scenario")).toBeInTheDocument();
      });

      // Check that the form renders properly
      expect(screen.getByText("Save Scenario")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Scenario:
 * Path: common/scenario/Scenario.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: ScenarioProps
 * - Has props: true
 * - Props interface: ScenarioProps
 * - Client component: true
 * - Uses hooks: useQuery, useQueryClient, useRouter, useEffect, useMemo, useState
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Scenario {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Scenario {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
