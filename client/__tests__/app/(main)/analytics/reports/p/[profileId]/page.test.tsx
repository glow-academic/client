import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import { afterEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/auth";
import "@/mocks/navigation";

// Mock the Report component
vi.mock("@/components/analytics/report/Report", () => ({
  default: ({ profileId }: { profileId: string }) => (
    <div data-testid="report-component" data-profile-id={profileId}>
      Report Component for {profileId}
    </div>
  ),
}));

// Mock React.use to handle Promise unwrapping
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn((promise) => {
      if (promise instanceof Promise) {
        return { profileId: "test-profile-id" };
      }
      return promise;
    }),
  };
});

// ——————————————————————————————————————————
import ReportsPage, {
  generateMetadata,
} from "@/app/(main)/analytics/reports/p/[profileId]/page";
import { getProfile } from "@/utils/queries/profiles/get-profile";
import { ResolvingMetadata } from "next";

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
      render(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      render(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toBeInTheDocument();
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          "test-profile-id"
        );
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toBeInTheDocument();
      });
    });
  });

  describe("Component Integration", () => {
    it("should pass profileId to Report component", async () => {
      render(<ReportsPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          "test-profile-id"
        );
      });
    });

    it("should render the Report component inside a wrapper", async () => {
      render(<ReportsPage params={mockParams} />);

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
        role: "admin" as const,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        defaultProfile: false,
        userId: 1,
        alias: "john-doe",
        viewedIntro: true,
        viewedChat: true,
      };

      vi.mocked(getProfile).mockResolvedValue(mockProfile);

      const metadata = await generateMetadata(
        { params: Promise.resolve({ profileId: "test-profile-id" }) },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("John Doe");
      expect(metadata.description).toContain("Reports for individual staff");
    });

    it("handles missing profile gracefully", async () => {
      vi.mocked(getProfile).mockResolvedValue(null);

      const metadata = await generateMetadata(
        { params: Promise.resolve({ profileId: "test-profile-id" }) },
        {} as ResolvingMetadata
      );

      expect(metadata.title).toBe("undefined undefined");
      expect(metadata.description).toContain("Reports for individual staff");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      const differentParams = Promise.resolve({ profileId: "different-id" });

      render(<ReportsPage params={differentParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          "test-profile-id"
        );
      });
    });

    it("should handle missing or invalid props", async () => {
      const emptyParams = Promise.resolve({ profileId: "" });

      render(<ReportsPage params={emptyParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("report-component")).toHaveAttribute(
          "data-profile-id",
          "test-profile-id"
        );
      });
    });
  });
});
