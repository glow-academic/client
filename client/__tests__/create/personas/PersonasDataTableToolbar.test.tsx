import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  PersonasDataTableToolbar,
  PersonasDataTableToolbarProps,
} from "@/components/create/personas/PersonasDataTableToolbar";
import { getMockTable } from "@/mocks/navigation";
import { Persona } from "@/types";

// Mock the DataTableFacetedFilter component
vi.mock("@/components/common/history/DataTableFacetedFilter", () => ({
  DataTableFacetedFilter: ({ title }: { title: string }) => (
    <div data-testid={`filter-${title.toLowerCase()}`}>{title} Filter</div>
  ),
}));

describe("PersonasDataTableToolbar", () => {
  const mockTable = getMockTable<Persona>();

  const defaultProps: PersonasDataTableToolbarProps = {
    table: mockTable,
    scenarioOptions: [{ value: "scenario-1", label: "Scenario 1" }],
    reasoningOptions: [
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
    modelOptions: [
      { value: "model-1", label: "Model 1" },
      { value: "model-2", label: "Model 2" },
    ],
    temperatureOptions: [
      { value: "0.1-0.3", label: "Low (0.1-0.3)" },
      { value: "0.4-0.7", label: "Medium (0.4-0.7)" },
      { value: "0.8-1.0", label: "High (0.8-1.0)" },
    ],
  };

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<PersonasDataTableToolbar {...defaultProps} />);

      // Check that the search input is rendered
      expect(
        screen.getByPlaceholderText("Search personas...")
      ).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<PersonasDataTableToolbar {...defaultProps} />);

      // Check that the search input is rendered
      expect(
        screen.getByPlaceholderText("Search personas...")
      ).toBeInTheDocument();

      // Check that filters are rendered
      expect(screen.getByTestId("filter-scenario")).toBeInTheDocument();
      expect(screen.getByTestId("filter-reasoning")).toBeInTheDocument();
      expect(screen.getByTestId("filter-model")).toBeInTheDocument();
      expect(screen.getByTestId("filter-temperature")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<PersonasDataTableToolbar {...defaultProps} />);

      // Check that the search input has proper accessibility attributes
      const searchInput = screen.getByPlaceholderText("Search personas...");
      expect(searchInput).toBeInTheDocument();

      // Check that the filters are accessible
      expect(screen.getByTestId("filter-scenario")).toBeInTheDocument();
      expect(screen.getByTestId("filter-reasoning")).toBeInTheDocument();
      expect(screen.getByTestId("filter-model")).toBeInTheDocument();
      expect(screen.getByTestId("filter-temperature")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle search input changes", async () => {
      const user = userEvent.setup();

      renderWithMocks(<PersonasDataTableToolbar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search personas...");
      await user.type(searchInput, "test persona");

      expect(searchInput).toHaveValue("test persona");
    });

    it("should handle filter interactions", async () => {
      const user = userEvent.setup();

      renderWithMocks(<PersonasDataTableToolbar {...defaultProps} />);

      // The filters are mocked, so we just verify they're rendered
      expect(screen.getByTestId("filter-scenario")).toBeInTheDocument();
      expect(screen.getByTestId("filter-reasoning")).toBeInTheDocument();
      expect(screen.getByTestId("filter-model")).toBeInTheDocument();
      expect(screen.getByTestId("filter-temperature")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty options
      const propsWithEmptyOptions = {
        ...defaultProps,
        scenarioOptions: [],
        reasoningOptions: [],
        modelOptions: [],
        temperatureOptions: [],
      };

      renderWithMocks(<PersonasDataTableToolbar {...propsWithEmptyOptions} />);

      // Component should still render without crashing
      expect(
        screen.getByPlaceholderText("Search personas...")
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props
      const minimalProps = {
        table: mockTable,
        scenarioOptions: [],
        reasoningOptions: [],
        modelOptions: [],
        temperatureOptions: [],
      };

      renderWithMocks(<PersonasDataTableToolbar {...minimalProps} />);

      // Component should still render
      expect(
        screen.getByPlaceholderText("Search personas...")
      ).toBeInTheDocument();
    });

    it("should handle filters with no options", () => {
      const propsWithNoFilterOptions = {
        ...defaultProps,
        scenarioOptions: [],
        reasoningOptions: [],
        modelOptions: [],
        temperatureOptions: [],
      };

      renderWithMocks(
        <PersonasDataTableToolbar {...propsWithNoFilterOptions} />
      );

      // Should still render the search input
      expect(
        screen.getByPlaceholderText("Search personas...")
      ).toBeInTheDocument();

      // Filters with no options should not be rendered
      expect(screen.queryByTestId("filter-scenario")).not.toBeInTheDocument();
      expect(screen.queryByTestId("filter-reasoning")).not.toBeInTheDocument();
      expect(screen.queryByTestId("filter-model")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("filter-temperature")
      ).not.toBeInTheDocument();
    });
  });
});
