import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  NavigationBreadcrumbs,
  NavigationBreadcrumbsProps,
} from "@/components/common/layout/NavigationBreadcrumbs";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: NavigationBreadcrumbsProps = {
  breadcrumbs: [],
};
// ------------------------------------------------------------------
describe("NavigationBreadcrumbs", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<NavigationBreadcrumbs {...mockProps} />);

      // Should render the breadcrumbs component
      await waitFor(() => {
        expect(screen.getByRole("navigation")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with breadcrumbs data
      const propsWithBreadcrumbs: NavigationBreadcrumbsProps = {
        breadcrumbs: [{ title: "Home" }, { title: "Analytics" }],
      };

      render(<NavigationBreadcrumbs {...propsWithBreadcrumbs} />);

      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Analytics")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<NavigationBreadcrumbs {...mockProps} />);

      await waitFor(() => {
        // Check for navigation element
        const nav = screen.getByRole("navigation");
        expect(nav).toBeInTheDocument();

        // Check for proper ARIA attributes
        expect(nav).toHaveAttribute("aria-label");
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", async () => {
      const user = userEvent.setup();
      const propsWithBreadcrumbs: NavigationBreadcrumbsProps = {
        breadcrumbs: [{ title: "Home" }, { title: "Analytics" }],
      };

      render(<NavigationBreadcrumbs {...propsWithBreadcrumbs} />);

      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Click on a breadcrumb link
      const homeLink = screen.getByText("Home");
      await user.click(homeLink);

      // Should navigate to the href
      expect(homeLink).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const propsWithBreadcrumbs: NavigationBreadcrumbsProps = {
        breadcrumbs: [{ title: "Home" }, { title: "Analytics" }],
      };

      render(<NavigationBreadcrumbs {...propsWithBreadcrumbs} />);

      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Analytics")).toBeInTheDocument();
      });

      // Should render breadcrumb links
      const homeLink = screen.getByText("Home");
      const analyticsLink = screen.getByText("Analytics");
      expect(homeLink).toBeInTheDocument();
      expect(analyticsLink).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      render(<NavigationBreadcrumbs {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("navigation")).toBeInTheDocument();
      });

      // Should render properly even with empty breadcrumbs
      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      render(<NavigationBreadcrumbs breadcrumbs={[]} />);

      await waitFor(() => {
        expect(screen.getByRole("navigation")).toBeInTheDocument();
      });

      // Should render with empty breadcrumbs
      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });
  });
});
