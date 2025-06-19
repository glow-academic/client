import Model from "@/components/common/model/Model";
import { createModelMock, updateModelMock } from "@/mocks/mutations";
import { renderWithProviders } from "@/mocks/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


// Mock the queries
vi.mock("@/utils/queries/models/get-all-models", () => ({
  getAllModels: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/utils/queries/providers/get-all-providers", () => ({
  getAllProviders: vi.fn(() =>
    Promise.resolve([
      {
        id: "provider1",
        name: "Test Provider",
        description: "Test Description",
      },
    ])
  ),
}));

describe("Model Component", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    createModelMock.mockReset();
    updateModelMock.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Role-based Access Control", () => {
    it("should render for admin users", () => {
      renderWithProviders(<Model />, "admin");
      expect(screen.getByLabelText(/name/i)).toBeVisible();
    });

    it("should show access denied for instructional users", () => {
      renderWithProviders(<Model />, "instructional");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should show access denied for instructor users", () => {
      renderWithProviders(<Model />, "instructor");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should show access denied for TA users", () => {
      renderWithProviders(<Model />, "ta");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should show access denied for guest users", () => {
      renderWithProviders(<Model />, "guest");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should handle unauthenticated users", () => {
      renderWithProviders(<Model />, "guest");
      expect(screen.getByText(/access denied/i)).toBeVisible();
    });
  });

  describe("Create Mode (Admin Only)", () => {
    it("renders create form with correct initial state", () => {
      renderWithProviders(<Model />, "admin");

      // Check form elements are present
      expect(screen.getByLabelText(/name/i)).toBeVisible();
      expect(screen.getByLabelText(/description/i)).toBeVisible();
      expect(screen.getByText("Provider")).toBeVisible();
      expect(screen.getByText("Select a provider...")).toBeVisible();
      expect(screen.getByText("Status")).toBeVisible();
      expect(
        screen.getByRole("button", { name: /create model/i })
      ).toBeVisible();
    });

    it("shows validation errors when required fields are missing", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Model />, "admin");

      await user.click(screen.getByRole("button", { name: /create model/i }));

      // Check validation messages appear
      expect(await screen.findByText(/name is required/i)).toBeVisible();
      expect(screen.getByText(/description is required/i)).toBeVisible();
      expect(screen.getByText(/provider is required/i)).toBeVisible();

      // Ensure mutation was not called
      expect(createModelMock).not.toHaveBeenCalled();
    });

    it("handles basic form input", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Model />, "admin");

      // Fill out basic form fields
      await user.type(screen.getByLabelText(/name/i), "Test Model");
      await user.type(
        screen.getByLabelText(/description/i),
        "Test Description"
      );

      // Check that values were set
      expect(screen.getByDisplayValue("Test Model")).toBeVisible();
      expect(screen.getByDisplayValue("Test Description")).toBeVisible();
    });
  });

  describe("Form Validation (Admin Only)", () => {
    it("validates name field", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Model />, "admin");

      // Try to submit without name
      await user.click(screen.getByRole("button", { name: /create model/i }));
      expect(await screen.findByText(/name is required/i)).toBeVisible();

      // Fill name and error should disappear
      await user.type(screen.getByLabelText(/name/i), "Valid Name");
      expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
    });
  });
});