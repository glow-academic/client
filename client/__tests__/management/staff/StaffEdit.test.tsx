import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import StaffEdit from "@/components/management/staff/StaffEdit";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock API calls
vi.mock("@/utils/queries/profiles/get-all-profiles", () => ({
  getAllProfiles: vi.fn(),
}));

describe("StaffEdit", () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();
  const testUserId = "test-user-id";

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    (useRouter as any).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  const mockTargetUser = {
    id: testUserId,
    firstName: "Jane",
    lastName: "Smith",
    alias: "jsmith",
    role: "instructor",
    classIds: ["class1", "class2"],
  };

  const mockAllUsers = [mockTargetUser];

  describe("Rendering", () => {
    it("should render loading state initially", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should render user not found when user does not exist", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue([]); // Target user not in list

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByText("User Not Found")).toBeInTheDocument();
        expect(
          screen.getByText("The requested user could not be found."),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /back to staff management/i }),
        ).toBeInTheDocument();
      });
    });

    it("should render invalid user type for non-staff users", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      const studentUser = { ...mockTargetUser, role: "student" };

      (getAllProfiles as any).mockResolvedValue([studentUser]);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByText("Invalid User Type")).toBeInTheDocument();
        expect(
          screen.getByText(
            "This user is not a staff member and cannot be edited here.",
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /back to staff management/i }),
        ).toBeInTheDocument();
      });
    });

    it("should render edit form for staff users", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByText("User Information")).toBeInTheDocument();
        expect(
          screen.getByText("Basic user details and account information."),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/username\/alias/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });
    });

    it("should show back button in header", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /back/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Functionality", () => {
    it("should populate form with existing user data", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Smith")).toBeInTheDocument();
        expect(screen.getByDisplayValue("jsmith")).toBeInTheDocument();
      });
    });

    it("should handle form input changes", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Janet");

      expect(screen.getByDisplayValue("Janet")).toBeInTheDocument();
    });

    it("should enable save button when changes are made", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save/i }),
        ).toBeDisabled();
      });

      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.type(firstNameInput, "t");

      expect(
        screen.getByRole("button", { name: /save/i }),
      ).not.toBeDisabled();
    });

    it("should handle form submission", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.type(firstNameInput, "t");

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      expect(
        screen.getByRole("button", { name: /saving.../i }),
      ).toBeInTheDocument();
    });

    it("should navigate back on cancel", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /cancel/i }),
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith("/management/staff");
    });

    it("should navigate back on header back button", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /back/i }),
        ).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", { name: /back/i });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/management/staff");
    });
  });

  describe("Role Management", () => {
    it("should display current role information", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByText("Role & Permissions")).toBeInTheDocument();
        expect(screen.getByText("Current Role:")).toBeInTheDocument();
        expect(screen.getByText("Instructor")).toBeInTheDocument();
        expect(screen.getByText("2 classes assigned")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Can manage assigned classes and teaching assistants",
          ),
        ).toBeInTheDocument();
      });
    });

    it("should allow role selection", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      });

      // Click on role selector
      const roleSelect = screen.getByRole("combobox");
      await user.click(roleSelect);

      // Should show role options
      expect(screen.getByText("Instructional Staff")).toBeInTheDocument();
      expect(screen.getByText("Teaching Assistant")).toBeInTheDocument();
    });

    it("should update role permissions when role changes", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      });

      // Click on role selector and select TA
      const roleSelect = screen.getByRole("combobox");
      await user.click(roleSelect);
      
      const taOption = screen.getByText("Teaching Assistant");
      await user.click(taOption);

      // Should update permissions text
      await waitFor(() => {
        expect(screen.getByText("Can assist with assigned classes")).toBeInTheDocument();
      });
    });
  });

  describe("Password Management", () => {
    it("should show password field for all users", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
        expect(
          screen.getByText("Leave blank to keep the current password."),
        ).toBeInTheDocument();
      });
    });

    it("should handle password changes", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/new password/i);
      await user.type(passwordInput, "newpassword123");

      expect(passwordInput).toHaveValue("newpassword123");
    });
  });

  describe("Delete Functionality", () => {
    it("should show delete section for all users", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByText("Danger Zone")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Permanently delete this user account. This action cannot be undone.",
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /delete user/i }),
        ).toBeInTheDocument();
      });
    });

    it("should show delete confirmation dialog with updated user info", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /delete user/i }),
        ).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", { name: /delete user/i });
      await user.click(deleteButton);

      expect(screen.getByText("Are you absolutely sure?")).toBeInTheDocument();
      expect(
        screen.getByText(
          /This will permanently delete the user account for Jane Smith/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete user/i }),
      ).toBeInTheDocument();
    });

    it("should handle delete confirmation", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /delete user/i }),
        ).toBeInTheDocument();
      });

      // Open delete dialog and confirm
      const deleteButton = screen.getByRole("button", { name: /delete user/i });
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getAllByRole("button", {
        name: /delete user/i,
      })[1]; // Second one in dialog
      await user.click(confirmDeleteButton);

      // Should show loading state
      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith("/management/staff");
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Navigation and Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      // Should show loading state and not crash
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should navigate to staff page after successful update", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
      });

      // Make a change and submit
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.type(firstNameInput, "t");

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      // Wait for navigation
      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith("/management/staff");
        },
        { timeout: 2000 },
      );
    });

    it("should handle back navigation from error states", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue([]);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /back to staff management/i }),
        ).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", {
        name: /back to staff management/i,
      });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/management/staff");
    });
  });

  describe("Field Validation", () => {
    it("should show email preview for alias field", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      const user = userEvent.setup();
      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByText("Will be used as redacted@purdue.edu")).toBeInTheDocument();
      });

      // Change alias and check email preview updates
      const aliasInput = screen.getByLabelText(/username\/alias/i);
      await user.clear(aliasInput);
      await user.type(aliasInput, "newuser");

      expect(screen.getByText("Will be used as redacted@purdue.edu")).toBeInTheDocument();
    });

    it("should require all mandatory fields", async () => {
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );

      (getAllProfiles as any).mockResolvedValue(mockAllUsers);

      renderWithProviders(<StaffEdit profileId={testUserId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveAttribute("required");
        expect(screen.getByLabelText(/last name/i)).toHaveAttribute("required");
        expect(screen.getByLabelText(/username\/alias/i)).toHaveAttribute("required");
      });
    });
  });
});

/*
 * Component Analysis for StaffEdit:
 * Path: management/staff/StaffEdit.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (profileId: string)
 * - Props interface: { profileId: string }
 * - Client component: false
 * - Uses hooks: useRouter, useQuery, useState, useEffect
 * - Uses router: true
 * - Has API calls: true (getAllProfiles)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 *
 * The component provides comprehensive staff editing functionality with
 * role management, individual field editing, and simplified access control
 * since only admins can access this screen.
 */
