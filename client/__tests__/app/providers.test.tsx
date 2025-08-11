import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ——————————————————————————————————————————
import { Providers } from "@/app/providers";
import { Session } from "next-auth";

// Mock NextAuth session
const mockSession: Session | null = {
  user: { id: "123" },
  expires: new Date().toISOString(),
}

// Mock useSession to return proper structure
const mockUseSession = vi.fn(() => ({
  data: mockSession,
  status: "authenticated",
  update: vi.fn(),
}));

// Mock useQuery to return proper structure
const mockUseQuery = vi.fn(() => ({
  data: [{ id: "1", name: "Test Profile" }],
  isLoading: false,
  error: null,
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
  useSession: () => mockUseSession(),
}));

// React Query is mocked globally in auth.ts

// Mock Toaster
vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

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
    it("renders without crashing", () => {
      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should have correct provider structure", () => {
      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      // Check that all providers are rendered
      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
    });
  });

  describe("Session Management", () => {
    it("should handle authenticated session", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should handle unauthenticated session", () => {
      mockUseSession.mockReturnValue({
        data: null as unknown as Session,
        status: "unauthenticated",
        update: vi.fn(),
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should handle loading session", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: "123" },
          expires: new Date().toISOString(),
        },
        status: "loading",
        update: vi.fn(),
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });
  });

  describe("Profile Loading", () => {
    it("should handle profile loading state", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      mockUseQuery.mockReturnValue({
        data: null as unknown as { id: string; name: string }[],
        isLoading: true,
        error: null,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should handle profile loaded state", () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
        update: vi.fn(),
      });

      mockUseQuery.mockReturnValue({
        data: [{ id: "1", name: "Test Profile" }],
        isLoading: false,
        error: null,
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });
  });

  describe("Children Rendering", () => {
    it("should render children correctly", () => {
      renderWithMocks(
        <Providers>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </Providers>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
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
        data: {
          user: { id: "123" },
          expires: new Date().toISOString(),
        },
        status: "unauthenticated",
        update: vi.fn(),
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should handle undefined session gracefully", () => {
      mockUseSession.mockReturnValue({
        data: undefined as unknown as Session,
        status: "loading",
        update: vi.fn(),
      });

      renderWithMocks(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should handle empty children gracefully", () => {
      renderWithMocks(<Providers>{null}</Providers>);

      expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    });
  });
});
