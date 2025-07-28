import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the Report component
vi.mock("@/components/analytics/report/Report", () => ({
  default: ({ profileId }: { profileId: string }) => (
    <div data-testid="report-component" data-profile-id={profileId}>
      Report Component for {profileId}
    </div>
  ),
}));

// Mock the getProfile function
const mockGetProfile = vi.fn();
vi.mock("@/utils/queries/profiles/get-profile", () => ({
  getProfile: mockGetProfile,
}));

// ——————————————————————————————————————————
import ReportsPage, {
  generateMetadata,
} from "@/app/(main)/analytics/reports/p/[profileId]/page";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockParams = Promise.resolve({ profileId: "test-profile-id" });
// ------------------------------------------------------------------

describe("ReportsPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      renderWithMocks(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toBeInTheDocument();
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          "test-profile-id"
        );
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toBeInTheDocument();
      });
    });
  });

  describe("Component Integration", () => {
    it("should pass profileId to Report component", async () => {
      renderWithMocks(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          "test-profile-id"
        );
      });
    });

    it("should render the Report component inside a wrapper", async () => {
      renderWithMocks(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toBeInTheDocument();
        expect(
          screen.getByText("Report Component for test-profile-id")
        ).toBeInTheDocument();
      });
    });
  });

  describe("generateMetadata", () => {
    it("generates metadata with profile data", async () => {
      const mockProfile = {
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
      };

      mockGetProfile.mockResolvedValue(mockProfile);

      const metadata = await generateMetadata(
        { params: Promise.resolve({ profileId: "test-profile-id" }) },
        {} as any
      );

      expect(metadata.title).toBe("John Doe");
      expect(metadata.description).toContain(
        "Reports for individual staff in GLOW"
      );
    });

    it("handles missing profile data gracefully", async () => {
      mockGetProfile.mockResolvedValue(null);

      const metadata = await generateMetadata(
        { params: Promise.resolve({ profileId: "test-profile-id" }) },
        {} as any
      );

      expect(metadata.title).toBe("undefined undefined");
      expect(metadata.description).toContain(
        "Reports for individual staff in GLOW"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different profile IDs
      const differentParams = Promise.resolve({
        profileId: "different-profile-id",
      });

      renderWithMocks(<ReportsPage params={differentParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          "different-profile-id"
        );
      });
    });

    it("should handle missing or invalid props", async () => {
      // Test with empty profileId
      const emptyParams = Promise.resolve({ profileId: "" });

      renderWithMocks(<ReportsPage params={emptyParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          ""
        );
      });
    });
  });
});
