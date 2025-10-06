import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { default as NotFound } from "@/app/not-found";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/not-found",
}));

// Mock profile context
const mockUseProfile = vi.fn();
vi.mock("@/contexts/profile-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/contexts/profile-context")>();
  return {
    ...actual,
    useProfile: () => mockUseProfile(),
  };
});

describe("NotFound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({
      effectiveProfile: { role: "admin" },
    });
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<NotFound />);

      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Page Not Found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The page you're looking for doesn't exist or has been moved.",
        ),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<NotFound />);

      // Check for proper heading structure
      expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Page Not Found" }),
      ).toBeInTheDocument();

      // Check for button
      expect(
        screen.getByRole("button", { name: "Back to Glow" }),
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle Back to Glow button click for admin role", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "admin" },
      });

      render(<NotFound />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/analytics");
    });

    it("should handle Back to Glow button click for ta role", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "ta" },
      });

      render(<NotFound />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/home");
    });

    it("should handle Back to Glow button click for guest role", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "guest" },
      });

      render(<NotFound />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/home");
    });
  });

  describe("Navigation", () => {
    it("should navigate to analytics for non-ta/non-guest roles", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "admin" },
      });

      render(<NotFound />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/analytics");
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing profile gracefully", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: null,
      });

      render(<NotFound />);

      // Should still render the basic 404 content
      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    });

    it("should handle undefined profile role gracefully", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: undefined },
      });

      render(<NotFound />);

      // Should still render the basic 404 content
      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    });

    it("should display help text correctly", () => {
      render(<NotFound />);

      expect(
        screen.getByText(
          "The page you're looking for doesn't exist or has been moved.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "If you believe this is an error, please contact support or try refreshing the page.",
        ),
      ).toBeInTheDocument();
    });
  });
});
