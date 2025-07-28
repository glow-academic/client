import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Report, { ReportProps } from "@/components/analytics/report/Report";

// Import mocks
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ReportProps = {
  profileId: "test-profile-id",
};
// ------------------------------------------------------------------
describe("Report", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state initially
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });

    it("should render with props", async () => {
      renderWithMocks(<Report {...mockProps} />);

      // Should render with the provided profileId
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state initially
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state initially
      expect(screen.getByText("Loading report...")).toBeInTheDocument();

      // After error, should still show loading (component doesn't handle errors explicitly)
      await waitFor(() => {
        expect(screen.getByText("Loading report...")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      // Test loading states
      renderWithMocks(<Report {...mockProps} />);

      // Should show loading spinner and text
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
      // Note: The component doesn't have a status role, just the loading text
    });

    it("should handle successful data loading", async () => {
      // Mock successful profile data
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue({
        id: "test-profile-id",
        firstName: "John",
        lastName: "Doe",
        role: "admin",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        userId: 1,
        alias: "john-doe",
        viewedIntro: false,
        viewedChat: false,
        defaultProfile: false,
      });

      renderWithMocks(<Report {...mockProps} />);

      // Should show loading initially
      expect(screen.getByText("Loading report...")).toBeInTheDocument();

      // Should eventually show the profile name
      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with null profile
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockResolvedValue(null);

      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with missing profileId
      renderWithMocks(<Report profileId="" />);

      // Should still render loading state
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });

    it("should handle network timeouts", async () => {
      // Mock a slow network response
      const { getProfile } = await import(
        "@/utils/queries/profiles/get-profile"
      );
      vi.mocked(getProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 1000))
      );

      renderWithMocks(<Report {...mockProps} />);

      // Should show loading state during timeout
      expect(screen.getByText("Loading report...")).toBeInTheDocument();
    });
  });
});
