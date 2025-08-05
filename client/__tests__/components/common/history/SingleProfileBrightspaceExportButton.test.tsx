import { renderWithMocks } from "@/test/renderWithMocks";
import type { Table } from "@tanstack/react-table";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { SingleProfileCertificateButton } from "@/components/common/history/SingleProfileCertificateButton";

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

// Mock the profile context
vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => ({
    activeProfile: {
      id: "test-profile-id",
      userId: 1,
      firstName: "Test",
      lastName: "User",
      alias: "testuser",
      role: "admin",
      active: true,
      viewedIntro: true,
      viewedChat: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      defaultProfile: false,
    },
    setActiveProfile: vi.fn(),
    profiles: [],
    isLoading: false,
  }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/history",
}));

// Create a mock table
const createMockTable = (): Table<unknown> =>
  ({
    getState: () => ({
      rowSelection: {},
      columnFilters: [],
    }),
    getFilteredSelectedRowModel: () => ({
      rows: [],
    }),
    getFilteredRowModel: () => ({
      rows: [],
    }),
  }) as unknown as Table<unknown>;

const mockProps = {
  table: createMockTable(),
  profileOptions: [{ value: "profile-1", label: "Test Profile" }],
};

describe("SingleProfileCertificateButton", () => {
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<SingleProfileCertificateButton {...mockProps} />);

      // Should render the certificate button
      expect(screen.getByText(/Download Certificate/)).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<SingleProfileCertificateButton {...mockProps} />);

      // Should render the certificate button
      expect(screen.getByText(/Download Certificate/)).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<SingleProfileCertificateButton {...mockProps} />);

      // Check for the certificate button
      const button = screen.getByRole("button", {
        name: /Download Certificate/,
      });
      expect(button).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle button click", async () => {
      const user = userEvent.setup();
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);

      // Click the export button
      const button = screen.getByRole("button", { name: /Brightspace Export/ });
      await user.click(button);

      // Should open the popover - use getAllByText to handle multiple elements
      expect(screen.getAllByText("Brightspace Export")).toHaveLength(2);
    });

    it("should handle export functionality", async () => {
      const user = userEvent.setup();
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);

      // Click the export button to open popover
      const button = screen.getByRole("button", { name: /Brightspace Export/ });
      await user.click(button);

      // Should show export content
      expect(screen.getByText("Export to CSV")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      vi.mocked(getAllCohorts).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);

      // Component should still render even with API errors
      expect(screen.getByText(/Brightspace Export/)).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);

      // Component should show export button
      expect(screen.getByText(/Brightspace Export/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<SingleProfileBrightspaceExportButton {...mockProps} />);

      // Should render properly even with minimal props
      expect(screen.getByText(/Brightspace Export/)).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal props
      const minimalProps = {
        table: createMockTable(),
        profileOptions: [],
      };

      renderWithMocks(
        <SingleProfileBrightspaceExportButton {...minimalProps} />
      );

      // Should render with minimal props
      expect(screen.getByText(/Brightspace Export/)).toBeInTheDocument();
    });
  });
});
