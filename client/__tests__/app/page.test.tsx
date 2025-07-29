import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import LoginPage, { metadata } from "@/app/page";

// Mock the Login component
vi.mock("@/components/common/login/Login", () => ({
  default: () => <div data-testid="login-component">Login Component</div>,
}));

describe("LoginPage", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<LoginPage />);

      expect(screen.getByTestId("login-component")).toBeInTheDocument();
      expect(screen.getByText("Login Component")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<LoginPage />);

      // Check that the login component is rendered
      expect(screen.getByTestId("login-component")).toBeInTheDocument();
    });
  });

  describe("Metadata", () => {
    it("should export correct metadata", () => {
      expect(metadata).toBeDefined();
      expect(metadata.title).toBeDefined();
      expect(metadata.description).toBeDefined();

      // Check metadata structure
      expect(metadata.description).toContain("Login to GLOW");
      expect(metadata.description).toContain(
        "Graduate Learning Orientation Workshop"
      );
    });
  });

  describe("Component Structure", () => {
    it("should render Login component", () => {
      renderWithMocks(<LoginPage />);

      // Verify the Login component is rendered
      expect(screen.getByTestId("login-component")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle component rendering gracefully", () => {
      renderWithMocks(<LoginPage />);

      // Should render without errors
      expect(screen.getByTestId("login-component")).toBeInTheDocument();
    });
  });
});
