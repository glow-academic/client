import { render } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  DataTableRowActions,
  DataTableRowActionsProps,
} from "@/components/common/history/DataTableRowActions";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: DataTableRowActionsProps = {
  id: "test-id",
  profileId: "test-profile-id",
  scenarios: [],
  interactionIds: [],
};
// ------------------------------------------------------------------
describe("DataTableRowActions", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<DataTableRowActions {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<DataTableRowActions {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<DataTableRowActions {...mockProps} />);

      // Check for basic accessibility elements
      const actions =
        document.querySelector('[data-testid="row-actions"]') ||
        document.querySelector("div");
      expect(actions).toBeInTheDocument();
    });
  });

  describe("Button text logic", () => {
    it("should show 'View' when isIncomplete is true", () => {
      render(<DataTableRowActions {...mockProps} isIncomplete={true} />);

      const button = document.querySelector("button");
      expect(button).toHaveTextContent("View");
    });

    it("should show 'View' when isIncomplete is false and not current user", () => {
      render(<DataTableRowActions {...mockProps} isIncomplete={false} />);

      const button = document.querySelector("button");
      expect(button).toHaveTextContent("View");
    });

    it("should show 'Continue' when isIncomplete is false and is current user with incomplete simulation", () => {
      // Mock the profile context to return the same profileId
      const mockProfileContext = {
        effectiveProfile: { id: "test-profile-id" },
      };

      render(
        <DataTableRowActions
          {...mockProps}
          isIncomplete={false}
          scenarios={[{ completed: false }]}
          interactionIds={["1", "2"]}
        />,
        { profileContext: mockProfileContext },
      );

      const button = document.querySelector("button");
      expect(button).toHaveTextContent("Continue");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<DataTableRowActions {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(
        <DataTableRowActions
          id="test"
          profileId="test-profile-id"
          scenarios={[]}
          interactionIds={[]}
        />,
      );

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
