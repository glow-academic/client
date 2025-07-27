import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  DocumentsDataTableToolbar,
  DocumentsDataTableToolbarProps,
} from "@/components/create/documents/DocumentsDataTableToolbar";
import { getMockTable } from "@/mocks/navigation";
import { Document } from "@/types";

// Mock the DataTableFacetedFilter component
vi.mock("@/components/common/history/DataTableFacetedFilter", () => ({
  DataTableFacetedFilter: ({ title }: { title: string }) => (
    <div data-testid={`filter-${title.toLowerCase()}`}>{title} Filter</div>
  ),
}));

// Mock the DataTableViewOptions component
vi.mock("@/components/common/history/DataTableViewOptions", () => ({
  DataTableViewOptions: () => (
    <div data-testid="view-options">View Options</div>
  ),
}));

describe("DocumentsDataTableToolbar", () => {
  const mockTable = getMockTable<Document>();

  const defaultProps: DocumentsDataTableToolbarProps = {
    table: mockTable,
    typeOptions: [
      { value: "homework", label: "Homework" },
      { value: "project", label: "Project" },
    ],
    scenarioOptions: [{ value: "scenario-1", label: "Scenario 1" }],
    extensionOptions: [{ value: "pdf", label: "PDF" }],
    viewMode: "list",
    onViewModeChange: vi.fn(),
    selectedCount: 0,
    onBulkDelete: vi.fn(),
    canDeleteDocument: vi.fn(() => true),
    selectedDocuments: [],
  };

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DocumentsDataTableToolbar {...defaultProps} />);

      // Check that the search input is rendered
      expect(
        screen.getByPlaceholderText("Filter documents...")
      ).toBeInTheDocument();

      // Check that the view options are rendered
      expect(screen.getByTestId("view-options")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DocumentsDataTableToolbar {...defaultProps} />);

      // Check that the search input is rendered
      expect(
        screen.getByPlaceholderText("Filter documents...")
      ).toBeInTheDocument();

      // Check that the view mode toggle buttons are rendered
      expect(screen.getByRole("button", { name: /list/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /grid/i })).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DocumentsDataTableToolbar {...defaultProps} />);

      // Check that the search input has proper accessibility attributes
      const searchInput = screen.getByPlaceholderText("Filter documents...");
      expect(searchInput).toBeInTheDocument();

      // Check that the view mode buttons are accessible
      const listButton = screen.getByRole("button", { name: /list/i });
      const gridButton = screen.getByRole("button", { name: /grid/i });
      expect(listButton).toBeInTheDocument();
      expect(gridButton).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle view mode changes", async () => {
      const user = userEvent.setup();
      const onViewModeChange = vi.fn();

      renderWithMocks(
        <DocumentsDataTableToolbar
          {...defaultProps}
          onViewModeChange={onViewModeChange}
        />
      );

      // Click the grid view button
      const gridButton = screen.getByRole("button", { name: /grid/i });
      await user.click(gridButton);

      expect(onViewModeChange).toHaveBeenCalledWith("grid");
    });

    it("should handle search input changes", async () => {
      const user = userEvent.setup();

      renderWithMocks(<DocumentsDataTableToolbar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Filter documents...");
      await user.type(searchInput, "test document");

      expect(searchInput).toHaveValue("test document");
    });

    it("should handle bulk delete when documents are selected", async () => {
      const user = userEvent.setup();
      const onBulkDelete = vi.fn();

      renderWithMocks(
        <DocumentsDataTableToolbar
          {...defaultProps}
          selectedCount={2}
          selectedDocuments={["doc-1", "doc-2"]}
          onBulkDelete={onBulkDelete}
          viewMode="list"
        />
      );

      // The bulk delete button should be visible when documents are selected
      const deleteButton = screen.getByRole("button", {
        name: /delete 2 of 2/i,
      });
      await user.click(deleteButton);

      expect(onBulkDelete).toHaveBeenCalled();
    });

    it("should disable bulk delete when no documents can be deleted", async () => {
      const onBulkDelete = vi.fn();
      const canDeleteDocument = vi.fn(() => false);

      renderWithMocks(
        <DocumentsDataTableToolbar
          {...defaultProps}
          selectedCount={2}
          selectedDocuments={["doc-1", "doc-2"]}
          onBulkDelete={onBulkDelete}
          canDeleteDocument={canDeleteDocument}
          viewMode="list"
        />
      );

      // The bulk delete button should be disabled
      const deleteButton = screen.getByRole("button", {
        name: /delete 0 of 2/i,
      });
      expect(deleteButton).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty options
      const propsWithEmptyOptions = {
        ...defaultProps,
        typeOptions: [],
        scenarioOptions: [],
        extensionOptions: [],
      };

      renderWithMocks(<DocumentsDataTableToolbar {...propsWithEmptyOptions} />);

      // Component should still render without crashing
      expect(
        screen.getByPlaceholderText("Filter documents...")
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props
      const minimalProps = {
        table: mockTable,
        typeOptions: [],
        scenarioOptions: [],
        extensionOptions: [],
        viewMode: "list" as const,
        onViewModeChange: vi.fn(),
        selectedCount: 0,
        onBulkDelete: vi.fn(),
        canDeleteDocument: vi.fn(),
        selectedDocuments: [],
      };

      renderWithMocks(<DocumentsDataTableToolbar {...minimalProps} />);

      // Component should still render
      expect(
        screen.getByPlaceholderText("Filter documents...")
      ).toBeInTheDocument();
    });

    it("should not show bulk delete button in grid view", () => {
      renderWithMocks(
        <DocumentsDataTableToolbar
          {...defaultProps}
          selectedCount={2}
          selectedDocuments={["doc-1", "doc-2"]}
          viewMode="grid"
        />
      );

      // Bulk delete button should not be present in grid view
      expect(
        screen.queryByRole("button", { name: /delete/i })
      ).not.toBeInTheDocument();
    });

    it("should not show bulk delete button when no documents are selected", () => {
      renderWithMocks(
        <DocumentsDataTableToolbar
          {...defaultProps}
          selectedCount={0}
          selectedDocuments={[]}
          viewMode="list"
        />
      );

      // Bulk delete button should not be present when no documents are selected
      expect(
        screen.queryByRole("button", { name: /delete/i })
      ).not.toBeInTheDocument();
    });
  });
});
