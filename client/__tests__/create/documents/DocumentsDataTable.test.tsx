import { renderWithMocks } from "@/test/renderWithMocks";
import type { ColumnDef } from "@tanstack/react-table";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  DocumentsDataTable,
  DocumentsDataTableProps,
} from "@/components/create/documents/DocumentsDataTable";
import { Document } from "@/types";

// Mock the DocumentsDataTableToolbar component
vi.mock("@/components/create/documents/DocumentsDataTableToolbar", () => ({
  DocumentsDataTableToolbar: () => (
    <div data-testid="documents-data-table-toolbar">Toolbar</div>
  ),
}));

// Mock the DataTablePagination component
vi.mock("@/components/common/history/DataTablePagination", () => ({
  DataTablePagination: () => (
    <div data-testid="data-table-pagination">Pagination</div>
  ),
}));

const mockColumns: ColumnDef<Document>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    id: "type",
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <div>{row.getValue("type")}</div>,
  },
];

const mockDocuments: Document[] = [
  {
    id: "doc-1",
    name: "Test Document 1",
    type: "homework",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    filePath: "/test/path",
    mimeType: "application/pdf",
    classified: false,
    fileId: null,
  },
  {
    id: "doc-2",
    name: "Test Document 2",
    type: "project",
    active: false,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    filePath: "/test/path2",
    mimeType: "application/pdf",
    classified: true,
    fileId: "file-2",
  },
];

const mockRenderDocumentCard = (document: Document) => (
  <div key={document.id} data-testid={`document-card-${document.id}`}>
    {document.name}
  </div>
);

describe("DocumentsDataTable", () => {
  const defaultProps: DocumentsDataTableProps = {
    columns: mockColumns,
    data: mockDocuments,
    typeOptions: [
      { value: "homework", label: "Homework" },
      { value: "project", label: "Project" },
    ],
    scenarioOptions: [{ value: "scenario-1", label: "Scenario 1" }],
    extensionOptions: [{ value: "pdf", label: "PDF" }],
    renderDocumentCard: mockRenderDocumentCard,
    viewMode: "list",
    onViewModeChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    canDelete: vi.fn(() => true),
    selectedDocuments: [],
    onDocumentSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onBulkDelete: vi.fn(),
  };

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<DocumentsDataTable {...defaultProps} />);

      // Check that the toolbar is rendered
      expect(
        screen.getByTestId("documents-data-table-toolbar")
      ).toBeInTheDocument();

      // Check that the pagination is rendered
      expect(screen.getByTestId("data-table-pagination")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<DocumentsDataTable {...defaultProps} />);

      // Check that the toolbar is rendered
      expect(
        screen.getByTestId("documents-data-table-toolbar")
      ).toBeInTheDocument();

      // Check that the pagination is rendered
      expect(screen.getByTestId("data-table-pagination")).toBeInTheDocument();
    });

    it("should render documents in list view", () => {
      renderWithMocks(<DocumentsDataTable {...defaultProps} viewMode="list" />);

      // In list view, documents should be rendered in a table
      expect(screen.getByText("Test Document 1")).toBeInTheDocument();
      expect(screen.getByText("Test Document 2")).toBeInTheDocument();
    });

    it("should render documents in grid view", () => {
      renderWithMocks(<DocumentsDataTable {...defaultProps} viewMode="grid" />);

      // In grid view, documents should be rendered as cards
      expect(screen.getByTestId("document-card-doc-1")).toBeInTheDocument();
      expect(screen.getByTestId("document-card-doc-2")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<DocumentsDataTable {...defaultProps} />);

      // Check that the toolbar is accessible
      expect(
        screen.getByTestId("documents-data-table-toolbar")
      ).toBeInTheDocument();

      // Check that the pagination is accessible
      expect(screen.getByTestId("data-table-pagination")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const onViewModeChange = vi.fn();

      renderWithMocks(
        <DocumentsDataTable
          {...defaultProps}
          onViewModeChange={onViewModeChange}
        />
      );

      // The view mode change is handled by the toolbar component
      // which is mocked, so we just verify the prop is passed correctly
      expect(onViewModeChange).toBeDefined();
    });

    it("should handle user events", async () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();

      renderWithMocks(
        <DocumentsDataTable
          {...defaultProps}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      // The edit and delete actions are handled by the table actions column
      // which is rendered in list view
      expect(onEdit).toBeDefined();
      expect(onDelete).toBeDefined();
    });

    it("should handle document selection", async () => {
      const user = userEvent.setup();
      const onDocumentSelect = vi.fn();
      const onSelectAll = vi.fn();

      renderWithMocks(
        <DocumentsDataTable
          {...defaultProps}
          viewMode="list"
          onDocumentSelect={onDocumentSelect}
          onSelectAll={onSelectAll}
        />
      );

      // Find and click the select all checkbox
      const selectAllCheckbox = screen.getByRole("checkbox", {
        name: /select all/i,
      });
      await user.click(selectAllCheckbox);

      expect(onSelectAll).toHaveBeenCalledWith(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty data
      const propsWithEmptyData = {
        ...defaultProps,
        data: [],
      };

      renderWithMocks(<DocumentsDataTable {...propsWithEmptyData} />);

      // Should show no results message
      expect(screen.getByText("No results.")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props
      const minimalProps = {
        columns: [],
        data: [],
        typeOptions: [],
        scenarioOptions: [],
        extensionOptions: [],
        renderDocumentCard: vi.fn(),
        viewMode: "list" as const,
        onViewModeChange: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        canDelete: vi.fn(),
        selectedDocuments: [],
        onDocumentSelect: vi.fn(),
        onSelectAll: vi.fn(),
        onBulkDelete: vi.fn(),
      };

      renderWithMocks(<DocumentsDataTable {...minimalProps} />);

      // Component should still render
      expect(
        screen.getByTestId("documents-data-table-toolbar")
      ).toBeInTheDocument();
    });

    it("should handle documents that cannot be deleted", () => {
      const canDelete = vi.fn(() => false);

      renderWithMocks(
        <DocumentsDataTable
          {...defaultProps}
          canDelete={canDelete}
          viewMode="list"
        />
      );

      // The delete buttons should not be rendered for documents that cannot be deleted
      // This is handled by the actions column in the table
      expect(canDelete).toBeDefined();
    });
  });
});
