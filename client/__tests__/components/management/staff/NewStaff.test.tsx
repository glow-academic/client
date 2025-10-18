/**
 * NewStaff.test.tsx
 * Tests for the NewStaff component
 */

import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewStaff from "@/components/management/staff/NewStaff";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// Mock the toast notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock the router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock data for testing
const mockCreatedProfile = {
  id: "new-profile-id",
  userId: 2,
  firstName: "Jane",
  lastName: "Smith",
  alias: "jsmith",
  role: "ta" as const,
  active: true,
  viewedIntro: false,
  viewedChat: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

describe("NewStaff", () => {
  beforeEach(async () => {
    // Mock the API functions
    const { getAllProfiles } = await import(
      "@/utils/queries/profiles/get-all-profiles"
    );
    const { getAllCohorts } = await import(
      "@/utils/queries/cohorts/get-all-cohorts"
    );
    const { createProfiles } = await import(
      "@/utils/mutations/profiles/create-profiles"
    );
    const { getProfileByAlias } = await import(
      "@/utils/auth/get-profile-by-alias"
    );

    vi.mocked(getAllProfiles).mockResolvedValue([]);
    vi.mocked(getAllCohorts).mockResolvedValue([]);
    vi.mocked(createProfiles).mockResolvedValue([mockCreatedProfile]);
    vi.mocked(getProfileByAlias).mockResolvedValue(null); // Alias is available
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe("Rendering and Loading States", () => {
    it("renders without crashing", () => {
      render(<NewStaff />);
      expect(document.body).toBeInTheDocument();
    });

    it("shows both tabs by default", () => {
      render(<NewStaff />);

      expect(screen.getByText("CSV Import")).toBeInTheDocument();
      expect(screen.getByText("Manual Add")).toBeInTheDocument();
    });

    it("shows CSV import content by default", () => {
      render(<NewStaff />);

      expect(screen.getByText(/choose csv file/i)).toBeInTheDocument();
      expect(screen.getByText(/download template/i)).toBeInTheDocument();
      expect(
        screen.getByText(/include the following columns/i),
      ).toBeInTheDocument();
    });

    it("shows manual add content when tab is clicked", async () => {
      const user = userEvent.setup();
      render(<NewStaff />);

      const manualTab = screen.getByText("Manual Add");
      await user.click(manualTab);

      expect(screen.getByText("First Name *")).toBeInTheDocument();
      expect(screen.getByText("Last Name *")).toBeInTheDocument();
      expect(screen.getByText("Alias *")).toBeInTheDocument();
      expect(screen.getByText("Role *")).toBeInTheDocument();
    });
  });

  describe("Manual Profile Creation", () => {
    beforeEach(async () => {
      // Switch to manual tab
      const user = userEvent.setup();
      render(<NewStaff />);

      const manualTab = screen.getByText("Manual Add");
      await user.click(manualTab);
    });

    it("shows all required form fields", () => {
      expect(screen.getByLabelText("First Name *")).toBeInTheDocument();
      expect(screen.getByLabelText("Last Name *")).toBeInTheDocument();
      expect(screen.getByLabelText("Alias *")).toBeInTheDocument();
      expect(screen.getByText("Role *")).toBeInTheDocument();
    });

    it("updates form fields when user types", async () => {
      const user = userEvent.setup();

      const firstNameInput = screen.getByLabelText("First Name *");
      const lastNameInput = screen.getByLabelText("Last Name *");
      const aliasInput = screen.getByLabelText("Alias *");

      await user.type(firstNameInput, "Jane");
      await user.type(lastNameInput, "Smith");
      await user.type(aliasInput, "jsmith");

      expect(firstNameInput).toHaveValue("Jane");
      expect(lastNameInput).toHaveValue("Smith");
      expect(aliasInput).toHaveValue("jsmith");
    });

    it("shows role options based on user permissions", async () => {
      const user = userEvent.setup();

      const roleSelect = screen
        .getByText("Role *")
        .closest("div")
        ?.querySelector("button");
      if (roleSelect) {
        await user.click(roleSelect);
      }

      // Should show admin role options for admin user
      expect(screen.getByText("Administrator")).toBeInTheDocument();
      expect(screen.getByText("Instructional Staff")).toBeInTheDocument();
      expect(screen.getByText("Instructor")).toBeInTheDocument();
      expect(screen.getByText("Teaching Assistant")).toBeInTheDocument();
    });

    it("disables create button when form is incomplete", () => {
      const createButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      expect(createButton).toBeDisabled();
    });

    it("enables create button when all fields are filled", async () => {
      const user = userEvent.setup();

      const firstNameInput = screen.getByLabelText("First Name *");
      const lastNameInput = screen.getByLabelText("Last Name *");
      const aliasInput = screen.getByLabelText("Alias *");
      const roleSelect = screen
        .getByText("Role *")
        .closest("div")
        ?.querySelector("button");

      await user.type(firstNameInput, "Jane");
      await user.type(lastNameInput, "Smith");
      await user.type(aliasInput, "jsmith");
      if (roleSelect) {
        await user.click(roleSelect);
      }

      const taOption = screen.getByText("Teaching Assistant");
      await user.click(taOption);

      const createButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      expect(createButton).toBeEnabled();
    });

    it("successfully creates profile when form is submitted", async () => {
      const user = userEvent.setup();
      const { createProfiles } = await import(
        "@/utils/mutations/profiles/create-profiles"
      );
      const { toast } = await import("sonner");

      vi.mocked(createProfiles).mockResolvedValue([mockCreatedProfile]);

      const firstNameInput = screen.getByLabelText("First Name *");
      const lastNameInput = screen.getByLabelText("Last Name *");
      const aliasInput = screen.getByLabelText("Alias *");
      const roleSelect = screen
        .getByText("Role *")
        .closest("div")
        ?.querySelector("button");

      await user.type(firstNameInput, "Jane");
      await user.type(lastNameInput, "Smith");
      await user.type(aliasInput, "jsmith");
      if (roleSelect) {
        await user.click(roleSelect);
      }

      const taOption = screen.getByText("Teaching Assistant");
      await user.click(taOption);

      const createButton = screen.getByRole("button", {
        name: /create profile/i,
      });
      await user.click(createButton);

      await waitFor(() => {
        expect(createProfiles).toHaveBeenCalledWith([
          {
            firstName: "Jane",
            lastName: "Smith",
            alias: "jsmith",
            role: "ta",
          },
        ]);
        expect(toast.success).toHaveBeenCalledWith(
          "Successfully created new profile: Jane Smith (jsmith)",
        );
      });

      // Form should be reset
      expect(firstNameInput).toHaveValue("");
      expect(lastNameInput).toHaveValue("");
      expect(aliasInput).toHaveValue("");
    });
  });

  describe("CSV Import Functionality", () => {
    it("shows file upload area", () => {
      render(<NewStaff />);

      expect(screen.getByText(/supports .csv files/i)).toBeInTheDocument();
      expect(
        screen.getAllByText(/firstName \(required\)/i).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(/lastName \(required\)/i).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/alias \(required\)/i).length).toBeGreaterThan(
        0,
      );
      expect(screen.getAllByText(/role \(required\)/i).length).toBeGreaterThan(
        0,
      );
      expect(
        screen.getAllByText(/cohortName \(optional\)/i).length,
      ).toBeGreaterThan(0);
    });
  });
});
