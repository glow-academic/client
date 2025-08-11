import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Error from "@/app/error";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock profile context
const mockUseProfile = vi.fn();
vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => mockUseProfile(),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="profile-provider">{children}</div>
  ),
}));

describe("Error", () => {
  const mockError = { message: "Test error message" } as Error;
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({
      effectiveProfile: { role: "admin" },
    });
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Error error={mockError} reset={mockReset} />);

      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("An error occurred")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Error error={mockError} reset={mockReset} />);

      // Check for proper heading structure
      expect(
        screen.getByRole("heading", { name: "Error" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "An error occurred" })
      ).toBeInTheDocument();

      // Check for buttons
      expect(
        screen.getByRole("button", { name: "Try Again" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Back to Glow" })
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle Try Again button click", async () => {
      const user = userEvent.setup();
      render(<Error error={mockError} reset={mockReset} />);

      const tryAgainButton = screen.getByRole("button", { name: "Try Again" });
      await user.click(tryAgainButton);

      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it("should handle Back to Glow button click for admin role", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "admin" },
      });

      render(<Error error={mockError} reset={mockReset} />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/analytics");
    });

    it("should handle Back to Glow button click for ta role", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "ta" },
      });

      render(<Error error={mockError} reset={mockReset} />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/home");
    });

    it("should handle Back to Glow button click for guest role", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "guest" },
      });

      render(<Error error={mockError} reset={mockReset} />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/home");
    });
  });

  describe("Navigation", () => {
    it("should navigate to analytics for non-ta/non-guest roles", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "instructional" },
      });

      render(<Error error={mockError} reset={mockReset} />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      expect(mockPush).toHaveBeenCalledWith("/analytics");
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing profile gracefully", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: null,
      });

      render(<Error error={mockError} reset={mockReset} />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      // Should default to analytics when no profile
      expect(mockPush).toHaveBeenCalledWith("/analytics");
    });

    it("should handle undefined profile role gracefully", async () => {
      const user = userEvent.setup();
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: undefined },
      });

      render(<Error error={mockError} reset={mockReset} />);

      const backButton = screen.getByRole("button", { name: "Back to Glow" });
      await user.click(backButton);

      // Should default to analytics when role is undefined
      expect(mockPush).toHaveBeenCalledWith("/analytics");
    });

    it("should display error message correctly", () => {
      const customError = {
        message: "Custom error message with special characters: !@#$%",
      } as Error;
      render(<Error error={customError} reset={mockReset} />);

      expect(
        screen.getByText("Custom error message with special characters: !@#$%")
      ).toBeInTheDocument();
    });

    it("should handle empty error message", () => {
      const emptyError = { message: "" } as Error;
      render(<Error error={emptyError} reset={mockReset} />);

      expect(screen.getByText("An error occurred")).toBeInTheDocument();
      // Check that the error message paragraph exists (even if empty)
      const errorMessageElement = screen
        .getByText("An error occurred")
        .closest("div")
        ?.querySelector("p");
      expect(errorMessageElement).toBeInTheDocument();
    });
  });
});
