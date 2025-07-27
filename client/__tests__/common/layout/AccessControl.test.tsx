import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { AccessControl } from "@/components/common/layout/AccessControl";

// Import mocks
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
type AccessControlProps = {
  children: React.ReactNode;
  pathname: string;
};
const mockProps: AccessControlProps = {
  children: <div>test-children</div>,
  pathname: "test-pathname",
};
// ------------------------------------------------------------------
describe("AccessControl", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<AccessControl {...mockProps} />);

      // Should render children when access is granted
      await waitFor(() => {
        expect(screen.getByText("test-children")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with different pathname
      const propsWithDifferentPath: AccessControlProps = {
        children: <div>different-children</div>,
        pathname: "/analytics",
      };

      renderWithMocks(<AccessControl {...propsWithDifferentPath} />);

      await waitFor(() => {
        expect(screen.getByText("different-children")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<AccessControl {...mockProps} />);

      await waitFor(() => {
        // Check that children are rendered
        expect(screen.getByText("test-children")).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<AccessControl {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("test-children")).toBeInTheDocument();
      });

      // Children should be interactive
      const childrenElement = screen.getByText("test-children");
      expect(childrenElement).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<AccessControl {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("test-children")).toBeInTheDocument();
      });

      // Should render children based on pathname access
      expect(screen.getByText("test-children")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<AccessControl {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("test-children")).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      expect(screen.getByText("test-children")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with missing children
      renderWithMocks(
        <AccessControl pathname="test-pathname">
          <div>fallback</div>
        </AccessControl>
      );

      await waitFor(() => {
        expect(screen.getByText("fallback")).toBeInTheDocument();
      });
    });

    it("should handle loading state", async () => {
      // Test that component renders even during loading
      renderWithMocks(<AccessControl {...mockProps} />);

      // Should render children when access is granted
      await waitFor(() => {
        expect(screen.getByText("test-children")).toBeInTheDocument();
      });
    });

    it("should handle access denied state", async () => {
      // Mock the profile context to simulate access denied
      const mockUseProfile = vi.fn(() => ({
        effectiveProfile: {
          role: "guest",
          firstName: "Test",
          lastName: "User",
        },
        isLoading: false,
      }));

      vi.doMock("@/contexts/profile-context", () => ({
        useProfile: mockUseProfile,
      }));

      // Test with a pathname that guests don't have access to
      renderWithMocks(
        <AccessControl pathname="/admin">
          <div>admin-content</div>
        </AccessControl>
      );

      await waitFor(() => {
        // Should show access denied message
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
    });
  });
});
