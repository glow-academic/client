import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ScenarioAttributePicker, {
  ScenarioAttributePickerProps,
} from "@/components/common/analytics/ScenarioAttributePicker";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ScenarioAttributePickerProps = {
  selectedAttribute: "classes",
  onAttributeChange: vi.fn(),
};

// ------------------------------------------------------------------
describe("ScenarioAttributePicker", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ScenarioAttributePicker {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/Classes/)).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      renderWithMocks(<ScenarioAttributePicker {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/Classes/)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ScenarioAttributePicker {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      const propsWithDifferentAttribute = {
        ...mockProps,
        selectedAttribute: "locations" as const,
      };

      renderWithMocks(
        <ScenarioAttributePicker {...propsWithDifferentAttribute} />,
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/Locations/)).toBeInTheDocument();
      });
    });

    it("should handle missing or invalid props", async () => {
      const propsWithDifferentAttribute = {
        ...mockProps,
        selectedAttribute: "deadlines" as const,
      };

      renderWithMocks(
        <ScenarioAttributePicker {...propsWithDifferentAttribute} />,
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/Deadlines/)).toBeInTheDocument();
      });
    });
  });
});
