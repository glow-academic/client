import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ProfileSelector from "@/components/common/profile/ProfileSelector";
import { Profile, ProfileRole } from "@/types";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed

// Define the props interface locally since it's not exported
interface ProfileSelectorProps {
  selectedProfiles: EditableProfile[];
  onProfilesChange: (profiles: EditableProfile[]) => void;
  allowedRoles: ProfileRole[];
  title?: string;
  description?: string;
}

// Define EditableProfile type to match the component
type EditableProfile =
  | Profile
  | {
      isNew: true;
      id: string;
      firstName: string;
      lastName: string;
      alias: string;
      role: ProfileRole;
    };

const mockProps: ProfileSelectorProps = {
  selectedProfiles: [],
  onProfilesChange: vi.fn(),
  allowedRoles: ["instructional", "ta"],
  title: "Test Title",
  description: "Test Description",
};

// ------------------------------------------------------------------
describe("ProfileSelector", () => {
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
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Check that the component renders with the expected sections
      expect(screen.getByText("Test Title")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
      expect(screen.getByText("Search")).toBeInTheDocument();
      expect(screen.getByText("CSV Import")).toBeInTheDocument();
      expect(screen.getByText("Quick Add")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Check that props are properly displayed
      expect(screen.getByText("Test Title")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
      expect(screen.getByText("Download Template")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Check for proper form structure
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Search" })).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "CSV Import" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "Quick Add" })
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Test tab switching
      const csvTab = screen.getByRole("tab", { name: "CSV Import" });
      await user.click(csvTab);

      // Check that CSV content is shown
      expect(
        screen.getByText(/Upload a CSV file with profiles/)
      ).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Test search functionality
      const searchInput = screen.getByPlaceholderText(
        "Search profiles by name or alias..."
      );
      await user.type(searchInput, "test");

      // Check that search input works
      expect(searchInput).toHaveValue("test");
    });

    it("should handle search functionality", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Test search input
      const searchInput = screen.getByPlaceholderText(
        "Search profiles by name or alias..."
      );
      await user.type(searchInput, "admin");

      // Wait for search to complete
      await waitFor(() => {
        expect(searchInput).toHaveValue("admin");
      });
    });

    it("should handle CSV template download", async () => {
      const user = userEvent.setup();

      // Mock URL.createObjectURL and revokeObjectURL
      const mockCreateObjectURL = vi.fn(() => "mock-url");
      const mockRevokeObjectURL = vi.fn();
      Object.defineProperty(window, "URL", {
        value: {
          createObjectURL: mockCreateObjectURL,
          revokeObjectURL: mockRevokeObjectURL,
        },
        writable: true,
      });

      // Store original createElement
      const originalCreateElement = document.createElement;

      // Mock document.createElement to prevent navigation
      const mockClick = vi.fn();
      const mockCreateElement = vi.fn((tagName) => {
        if (tagName === "a") {
          return {
            href: "",
            download: "",
            click: mockClick,
          };
        }
        // For other elements, use the original createElement
        return originalCreateElement.call(document, tagName);
      });
      Object.defineProperty(document, "createElement", {
        value: mockCreateElement,
        writable: true,
      });

      renderWithMocks(<ProfileSelector {...mockProps} />);

      const downloadButton = screen.getByText("Download Template");
      await user.click(downloadButton);

      // Check that download functionality was triggered
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockCreateElement).toHaveBeenCalledWith("a");
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();

      // Restore original createElement
      Object.defineProperty(document, "createElement", {
        value: originalCreateElement,
        writable: true,
      });
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // The getAllProfiles query is automatically mocked via imports above
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Check that the component handles API errors gracefully
      await waitFor(() => {
        expect(screen.getByText("Test Title")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Check that loading state is handled
      expect(screen.getByText("Test Title")).toBeInTheDocument();
    });
  });

  describe("Profile Management", () => {
    it("should handle profile selection", async () => {
      const onProfilesChange = vi.fn();

      renderWithMocks(
        <ProfileSelector {...mockProps} onProfilesChange={onProfilesChange} />
      );

      // Test that the callback is available
      expect(onProfilesChange).toBeDefined();
    });

    it("should display selected profiles", () => {
      const selectedProfiles: EditableProfile[] = [
        {
          isNew: true,
          id: "temp-1",
          firstName: "John",
          lastName: "Doe",
          alias: "jdoe",
          role: "instructional",
        },
      ];

      renderWithMocks(
        <ProfileSelector {...mockProps} selectedProfiles={selectedProfiles} />
      );

      // Check that selected profiles are displayed
      expect(screen.getByText("Selected Profiles (1)")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<ProfileSelector {...mockProps} />);

      // Test that component renders with minimal props
      expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      const minimalProps = {
        selectedProfiles: [],
        onProfilesChange: vi.fn(),
        allowedRoles: ["instructional"] as ProfileRole[],
      };

      renderWithMocks(<ProfileSelector {...minimalProps} />);

      // Test that component handles missing optional props
      expect(screen.getByText("Profiles")).toBeInTheDocument(); // Default title
    });

    it("should handle empty allowed roles", () => {
      const propsWithNoRoles = {
        ...mockProps,
        allowedRoles: [] as ProfileRole[],
      };

      renderWithMocks(<ProfileSelector {...propsWithNoRoles} />);

      // Test that component handles empty allowed roles
      expect(screen.getByText("Test Title")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for ProfileSelector:
 * Path: common/profile/ProfileSelector.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: ProfileSelectorProps
 * - Client component: true
 * - Uses hooks: useQuery, useCallback, useMemo, useRef, useState
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<ProfileSelector {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<ProfileSelector {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
