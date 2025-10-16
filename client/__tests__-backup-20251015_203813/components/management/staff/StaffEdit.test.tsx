import { render, screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import StaffEdit, {
  StaffEditProps,
} from "@/components/management/staff/StaffEdit";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// Mock the toast notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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
// Test data and props
const mockProps: StaffEditProps = {
  profileId: "test-profile-id",
};

const mockProfile = {
  id: "test-profile-id",
  userId: 1,
  firstName: "John",
  lastName: "Doe",
  alias: "johndoe",
  role: "ta" as const,
  active: true,
  viewedIntro: true,
  viewedChat: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

const mockAdminProfile = {
  ...mockProfile,
  role: "admin" as const,
};

const mockSuperAdminProfile = {
  ...mockProfile,
  role: "superadmin" as const,
};

// ------------------------------------------------------------------

describe("StaffEdit", () => {
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

  beforeEach(() => {
    // Reset router mock
    mockPush.mockClear();
  });

  describe("Rendering and Loading States", () => {
    it("renders without crashing", async () => {
      render(<StaffEdit {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it("shows loading skeletons when data is loading", () => {
      render(<StaffEdit {...mockProps} />);

      // Should show skeletons for form fields
      expect(screen.getByText("First Name")).toBeInTheDocument();
      expect(screen.getByText("Last Name")).toBeInTheDocument();
      expect(screen.getByText("Username/Alias")).toBeInTheDocument();
      expect(screen.getByText("Role")).toBeInTheDocument();
    });

    it("renders form fields when data is loaded", async () => {
      // Mock the getProfile query to return data
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
        expect(screen.getByDisplayValue("johndoe")).toBeInTheDocument();
      });
    });

    it("displays correct form values from profile data", async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
        expect(screen.getByDisplayValue("johndoe")).toBeInTheDocument();
      });
    });
  });

  describe("Form Interactions", () => {
    beforeEach(async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);
    });

    it("updates form data when user types in input fields", async () => {
      const user = userEvent.setup();
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");

      expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
    });

    it("enables update button when form data changes", async () => {
      const user = userEvent.setup();
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const updateButton = screen.getByRole("button", { name: /update user/i });
      expect(updateButton).toBeDisabled();

      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");

      expect(updateButton).toBeEnabled();
    });

    it("disables form fields when submitting", async () => {
      const user = userEvent.setup();
      const { updateProfile } = await import(
        "@/utils/mutations/profiles/update-profile"
      );

      // Mock updateProfile to delay resolution
      vi.mocked(updateProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");

      const updateButton = screen.getByRole("button", { name: /update user/i });
      await user.click(updateButton);

      // Form should be disabled during submission
      expect(firstNameInput).toBeDisabled();
      expect(updateButton).toBeDisabled();
      expect(screen.getByText("Updating...")).toBeInTheDocument();
    });
  });

  describe("Role Selection", () => {
    beforeEach(async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);
    });

    it("shows correct role options for admin user", async () => {
      // Mock admin profile context
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: mockAdminProfile,
        activeProfile: mockAdminProfile,
        simulatedProfile: null,
        isSimulating: false,
        isLoading: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(),
      });

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const roleSelect = screen.getByRole("combobox");
      await userEvent.click(roleSelect);

      // Should show admin role options
      expect(screen.getAllByText("Administrator").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Instructional Staff").length).toBeGreaterThan(
        0,
      );
      expect(screen.getAllByText("Teaching Assistant").length).toBeGreaterThan(
        0,
      );
    });

    it("shows superadmin role option for superadmin user", async () => {
      // Mock superadmin profile context
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: mockSuperAdminProfile,
        activeProfile: mockSuperAdminProfile,
        simulatedProfile: null,
        isSimulating: false,
        isLoading: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(),
      });

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const roleSelect = screen.getByRole("combobox");
      await userEvent.click(roleSelect);

      // Should show superadmin role option
      expect(screen.getAllByText("Super Administrator").length).toBeGreaterThan(
        0,
      );
    });

    it("shows guest role as disabled when user has guest role", async () => {
      const guestProfile = { ...mockProfile, role: "guest" as const };
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(guestProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const roleSelect = screen.getByRole("combobox");
      await userEvent.click(roleSelect);

      // Should show guest role as disabled
      expect(screen.getAllByText("Guest (Read-only)").length).toBeGreaterThan(
        0,
      );
    });
  });

  describe("Form Submission", () => {
    beforeEach(async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);
    });

    it("successfully updates user profile", async () => {
      const user = userEvent.setup();
      const { updateProfile } = await import(
        "@/utils/mutations/profiles/update-profile"
      );
      const { toast } = await import("sonner");

      vi.mocked(updateProfile).mockResolvedValue(mockProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");

      const updateButton = screen.getByRole("button", { name: /update user/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(updateProfile).toHaveBeenCalledWith("test-profile-id", {
          firstName: "Jane",
          lastName: "Doe",
          alias: "johndoe",
          role: "ta",
        });
        expect(toast.success).toHaveBeenCalledWith("User updated successfully");
        expect(mockPush).toHaveBeenCalledWith("/management/staff");
      });
    });

    it("handles update errors gracefully", async () => {
      const user = userEvent.setup();
      const { updateProfile } = await import(
        "@/utils/mutations/profiles/update-profile"
      );
      const { logError } = await import("@/utils/logger");

      const error = new Error("Update failed");
      vi.mocked(updateProfile).mockRejectedValue(error);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");

      const updateButton = screen.getByRole("button", { name: /update user/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(logError).toHaveBeenCalledWith("Error updating user:", error);
      });
    });
  });

  describe("Delete User", () => {
    beforeEach(async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);
    });

    it("shows delete confirmation dialog", async () => {
      const user = userEvent.setup();
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", { name: /delete user/i });
      await user.click(deleteButton);

      expect(screen.getByText("Are you absolutely sure?")).toBeInTheDocument();
      expect(
        screen.getByText(
          /This will permanently delete the user account for John Doe/,
        ),
      ).toBeInTheDocument();
    });

    it("successfully deletes user when confirmed", async () => {
      const user = userEvent.setup();
      const { deleteProfile } = await import(
        "@/utils/mutations/profiles/delete-profile"
      );
      const { toast } = await import("sonner");

      vi.mocked(deleteProfile).mockResolvedValue(undefined);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", { name: /delete user/i });
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getByRole("button", {
        name: /delete user/i,
      });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(deleteProfile).toHaveBeenCalledWith("test-profile-id");
        expect(toast.success).toHaveBeenCalledWith("User deleted successfully");
        expect(mockPush).toHaveBeenCalledWith("/management/staff");
      });
    });

    it("handles delete errors gracefully", async () => {
      const user = userEvent.setup();
      const { deleteProfile } = await import(
        "@/utils/mutations/profiles/delete-profile"
      );
      const { logError } = await import("@/utils/logger");

      const error = new Error("Delete failed");
      vi.mocked(deleteProfile).mockRejectedValue(error);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", { name: /delete user/i });
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getByRole("button", {
        name: /delete user/i,
      });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(logError).toHaveBeenCalledWith("Error deleting user:", error);
      });
    });

    it("cancels delete when cancel button is clicked", async () => {
      const user = userEvent.setup();
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", { name: /delete user/i });
      await user.click(deleteButton);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(
        screen.queryByText("Are you absolutely sure?"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    beforeEach(async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);
    });

    it("navigates back to staff management page", async () => {
      const user = userEvent.setup();
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", { name: /back/i });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/management/staff");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty profileId gracefully", () => {
      render(<StaffEdit profileId="" />);
      expect(document.body).toBeInTheDocument();
    });

    it("handles API error when fetching profile", async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      const error = new Error("Profile not found");
      vi.mocked(getProfile).mockRejectedValue(error);

      render(<StaffEdit {...mockProps} />);

      // Component should still render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("handles missing profile data gracefully", async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(null);

      render(<StaffEdit {...mockProps} />);

      // Component should still render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("handles form submission with empty values", async () => {
      const user = userEvent.setup();
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      const { updateProfile } = await import(
        "@/utils/mutations/profiles/update-profile"
      );

      vi.mocked(getProfile).mockResolvedValue(mockProfile);
      vi.mocked(updateProfile).mockResolvedValue(mockProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane"); // Make a change to enable the button

      const updateButton = screen.getByRole("button", { name: /update user/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(updateProfile).toHaveBeenCalledWith("test-profile-id", {
          firstName: "Jane",
          lastName: "Doe",
          alias: "johndoe",
          role: "ta",
        });
      });
    });
  });

  describe("Accessibility", () => {
    beforeEach(async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);
    });

    it("has proper form labels and IDs", async () => {
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("First Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Last Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Username/Alias")).toBeInTheDocument();
      // Role select uses a button, so we can't use getByLabelText
      expect(screen.getByText("Role")).toBeInTheDocument();
    });

    it("has proper button labels", async () => {
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: /update user/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete user/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("disables form elements during submission", async () => {
      const user = userEvent.setup();
      const { updateProfile } = await import(
        "@/utils/mutations/profiles/update-profile"
      );

      vi.mocked(updateProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("John");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");

      const updateButton = screen.getByRole("button", { name: /update user/i });
      await user.click(updateButton);

      // All form elements should be disabled during submission
      expect(firstNameInput).toBeDisabled();
      expect(screen.getByDisplayValue("Doe")).toBeDisabled();
      expect(screen.getByDisplayValue("johndoe")).toBeDisabled();
      expect(screen.getByRole("combobox")).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /delete user/i }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    });
  });

  describe("Function Coverage", () => {
    beforeEach(async () => {
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(mockProfile);
    });

    it("handles input change function calls", async () => {
      const user = userEvent.setup();
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      // Test all input fields to ensure handleFormInputChange is called
      const firstNameInput = screen.getByDisplayValue("John");
      const lastNameInput = screen.getByDisplayValue("Doe");
      const aliasInput = screen.getByDisplayValue("johndoe");

      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");
      await user.clear(lastNameInput);
      await user.type(lastNameInput, "Smith");
      await user.clear(aliasInput);
      await user.type(aliasInput, "janesmith");

      // Verify all changes were applied
      expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Smith")).toBeInTheDocument();
      expect(screen.getByDisplayValue("janesmith")).toBeInTheDocument();
    });

    it("handles form submission with all form data populated", async () => {
      const user = userEvent.setup();
      const { updateProfile } = await import(
        "@/utils/mutations/profiles/update-profile"
      );
      const { toast } = await import("sonner");

      vi.mocked(updateProfile).mockResolvedValue(mockProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      // Fill out all form fields
      const firstNameInput = screen.getByDisplayValue("John");
      const lastNameInput = screen.getByDisplayValue("Doe");
      const aliasInput = screen.getByDisplayValue("johndoe");

      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Jane");
      await user.clear(lastNameInput);
      await user.type(lastNameInput, "Smith");
      await user.clear(aliasInput);
      await user.type(aliasInput, "janesmith");

      // Submit form
      const updateButton = screen.getByRole("button", { name: /update user/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(updateProfile).toHaveBeenCalledWith("test-profile-id", {
          firstName: "Jane",
          lastName: "Smith",
          alias: "janesmith",
          role: "ta",
        });
        expect(toast.success).toHaveBeenCalledWith("User updated successfully");
        expect(mockPush).toHaveBeenCalledWith("/management/staff");
      });
    });

    it("handles back navigation function", async () => {
      const user = userEvent.setup();
      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", { name: /back/i });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/management/staff");
    });

    it("handles delete function with confirmation", async () => {
      const user = userEvent.setup();
      const { deleteProfile } = await import(
        "@/utils/mutations/profiles/delete-profile"
      );
      const { toast } = await import("sonner");

      vi.mocked(deleteProfile).mockResolvedValue(undefined);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", { name: /delete user/i });
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getByRole("button", {
        name: /delete user/i,
      });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(deleteProfile).toHaveBeenCalledWith("test-profile-id");
        expect(toast.success).toHaveBeenCalledWith("User deleted successfully");
        expect(mockPush).toHaveBeenCalledWith("/management/staff");
      });
    });

    it("handles form data initialization from target user", async () => {
      const customProfile = {
        ...mockProfile,
        firstName: "Custom",
        lastName: "User",
        alias: "customuser",
        role: "admin" as const,
      };

      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(customProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Custom")).toBeInTheDocument();
        expect(screen.getByDisplayValue("User")).toBeInTheDocument();
        expect(screen.getByDisplayValue("customuser")).toBeInTheDocument();
      });
    });

    it("handles form data initialization with different profile data", async () => {
      const customProfile = {
        ...mockProfile,
        firstName: "Different",
        lastName: "Profile",
        alias: "differentuser",
        role: "ta" as const,
      };

      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(customProfile);

      render(<StaffEdit {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Different")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Profile")).toBeInTheDocument();
        expect(screen.getByDisplayValue("differentuser")).toBeInTheDocument();
      });
    });
  });
});
