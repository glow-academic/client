import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { Providers } from "@/app/providers";

// Mock NextAuth session
const mockSession = {
  user: { id: "123" },
  expires: new Date().toISOString(),
};

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
  useSession: () => mockUseSession(),
}));

// Mock React Query
const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  ),
  useQuery: () => mockUseQuery(),
}));

// Mock profile query
const mockGetProfilesByUser = vi.fn();
vi.mock("@/utils/queries/profiles/get-profiles-by-user", () => ({
  getProfilesByUser: mockGetProfilesByUser,
}));

// Mock contexts
vi.mock("@/contexts/profile-context", () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="profile-provider">{children}</div>
  ),
}));

vi.mock("@/contexts/websocket-context", () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="websocket-provider">{children}</div>
  ),
}));

// Mock Toaster
vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

describe("Providers", () => {
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
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
      expect(screen.getByTestId("query-provider")).toBeInTheDocument();
      expect(screen.getByTestId("profile-provider")).toBeInTheDocument();
      expect(screen.getByTestId("websocket-provider")).toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should have correct provider structure", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      // Check that all providers are rendered in the correct order
      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
      expect(screen.getByTestId("query-provider")).toBeInTheDocument();
      expect(screen.getByTestId("profile-provider")).toBeInTheDocument();
      expect(screen.getByTestId("websocket-provider")).toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
    });
  });

  describe("Session Management", () => {
    it("should handle authenticated session", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    });

    it("should handle unauthenticated session", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    });

    it("should handle loading session", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    });
  });

  describe("Profile Loading", () => {
    it("should handle profile loading state", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("profile-provider")).toBeInTheDocument();
    });

    it("should handle profile loaded state", () => {
      const mockProfile = {
        id: "test-profile-id",
        userId: 123,
        firstName: "Test",
        lastName: "User",
        role: "admin",
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: mockProfile,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("profile-provider")).toBeInTheDocument();
    });
  });

  describe("Children Rendering", () => {
    it("should render children correctly", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const testContent = "This is test content";
      renderWithMocks(
        <Providers>
          <div data-testid="test-child">{testContent}</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </Providers>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing session data gracefully", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    });

    it("should handle undefined session gracefully", () => {
      mockUseSession.mockReturnValue({
        data: undefined,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    });

    it("should handle empty children gracefully", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithMocks(<Providers>{null}</Providers>);

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
    });
  });
});
