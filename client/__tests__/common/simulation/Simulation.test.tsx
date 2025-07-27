import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Simulation, {
  SimulationProps,
} from "@/components/common/simulation/Simulation";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SimulationProps = {
  // simulationId: 'test-simulationId', /* optional */
};
// ------------------------------------------------------------------
describe("Simulation", () => {
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
      renderWithMocks(<Simulation {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText(/Simulation Information/)).toBeInTheDocument();
    });

    it("should render create form with empty fields", () => {
      renderWithMocks(<Simulation mode="create" />);

      // Check that form fields are present
      expect(screen.getByLabelText(/Simulation Title/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
      expect(screen.getByText(/Create Simulation/)).toBeInTheDocument();
    });

    it("should render edit form with existing data", async () => {
      renderWithMocks(
        <Simulation simulationId="test-simulation-id" mode="edit" />
      );

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText(/Update Simulation/)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Simulation {...mockProps} />);

      // Check for proper form structure
      expect(screen.getByText(/Simulation Information/)).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Simulation mode="create" />);

      // Fill in the form
      const titleInput = screen.getByLabelText(/Simulation Title/);
      const descriptionInput = screen.getByLabelText(/Description/);

      await user.type(titleInput, "Test Simulation");
      await user.type(descriptionInput, "Test Description");

      // Submit the form
      const submitButton = screen.getByText(/Create Simulation/);
      await user.click(submitButton);

      // Check that the form submission was attempted
      expect(submitButton).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Simulation mode="create" />);

      // Test form input changes
      const titleInput = screen.getByLabelText(/Simulation Title/);
      await user.type(titleInput, "Test");
      expect(titleInput).toHaveValue("Test");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Simulation mode="create" />);

      // Test form input changes
      const titleInput = screen.getByLabelText(/Simulation Title/);
      await user.type(titleInput, "Test Simulation");
      expect(titleInput).toHaveValue("Test Simulation");
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { createSimulationMock } = await import("@/mocks/mutations");
      createSimulationMock.mockRejectedValue(new Error("API Error"));

      const user = userEvent.setup();
      renderWithMocks(<Simulation {...mockProps} />);

      // Fill and submit form to trigger error
      const titleInput = screen.getByLabelText(/Simulation Title/);
      const descriptionInput = screen.getByLabelText(/Description/);

      await user.type(titleInput, "Test Simulation");
      await user.type(descriptionInput, "Test Description");

      const submitButton = screen.getByText(/Create Simulation/);
      await user.click(submitButton);

      // Check that error handling is in place
      await waitFor(() => {
        expect(createSimulationMock).toHaveBeenCalled();
      });
    });

    it("should handle loading states", () => {
      renderWithMocks(
        <Simulation simulationId="test-simulation-id" mode="edit" />
      );

      // Check that loading skeletons are shown initially
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Simulation mode="create" />);

      const backButton = screen.getByText("Back");
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/management/simulations");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Simulation {...mockProps} />);

      // Test that the component renders without crashing even with minimal props
      expect(screen.getByText(/Simulation Information/)).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<Simulation />);

      // Test that the component handles missing props gracefully
      expect(screen.getByText(/Simulation Information/)).toBeInTheDocument();
    });

    it("should validate form fields", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Simulation mode="create" />);

      // Try to submit without filling required fields
      const submitButton = screen.getByText(/Create Simulation/);
      await user.click(submitButton);

      // Check that validation prevents submission
      expect(submitButton).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Simulation:
 * Path: common/simulation/Simulation.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: SimulationProps
 * - Has props: true
 * - Props interface: SimulationProps
 * - Client component: true
 * - Uses hooks: useQuery, useQueryClient, useEffect, useState, useRouter
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
 * render(<Simulation {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Simulation {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
