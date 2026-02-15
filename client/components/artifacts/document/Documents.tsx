/**
 * Documents.tsx
 * Documents component, used to view and manage documents with enhanced filtering and CRUD operations.
 * @AshokSaravanan222 & @siladiea
 * 07/25/2025
 */

"use client";
import {
  type ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import DocumentViewer from "@/components/artifacts/attempt/chat/viewers/DocumentViewer";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Edit,
  Eye,
  FileText,
  Trash2,
  X,
} from "lucide-react";

import type {
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListOut,
} from "@/app/(main)/management/documents/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export interface DocumentsProps {
  // Server-provided data (for server-side rendering)
  listData: DocumentsListOut;
  // Server actions (replaces useMutation)
  deleteDocumentAction?: (
    input: DeleteDocumentIn
  ) => Promise<DeleteDocumentOut>;
}

type DocumentRow = NonNullable<DocumentsListOut["documents"]>[number];

const DocumentPreviewThumb = ({ document }: { document: DocumentRow }) => {
  const hasPreview = Boolean(document.upload_id);
  const [showPreview, setShowPreview] = useState(hasPreview);

  useEffect(() => {
    setShowPreview(hasPreview);
  }, [hasPreview]);

  if (!showPreview) {
    return (
      <div className="h-12 w-10 rounded border bg-muted/40 flex items-center justify-center">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-12 w-10 rounded border overflow-hidden bg-muted/40">
      <img
        src={`/api/resources/uploads/download/${document.upload_id}?preview=true`}
        alt={document.name ?? "Document preview"}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setShowPreview(false)}
      />
    </div>
  );
};

export default function Documents({
  listData: serverListData,
  deleteDocumentAction,
}: DocumentsProps) {
  const router = useRouter();
  // Table state for filtering
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<
    (typeof documents)[number] | null
  >(null);
  const [previewDocument, setPreviewDocument] = useState<
    (typeof documents)[number] | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use server-provided data directly
  const documentsData = serverListData;

  // Extract data from V3 response - arrays directly (composite types)
  const documents = useMemo(
    () => documentsData?.documents || [],
    [documentsData]
  );
  const scenarios = useMemo(
    () =>
      (documentsData?.scenario_filter?.options || []).map((opt) => ({
        scenario_id: opt.id,
        name: opt.name,
      })),
    [documentsData?.scenario_filter],
  );
  const fields = useMemo(
    () =>
      (documentsData?.field_filter?.options || []).map((opt) => ({
        field_id: opt.id,
        name: opt.name,
      })),
    [documentsData?.field_filter],
  );
  const departments = useMemo(
    () =>
      (documentsData?.department_filter?.options || []).map((opt) => ({
        department_id: opt.id,
        name: opt.name,
      })),
    [documentsData?.department_filter]
  );

  // Create lookup maps from arrays for performance (replacing old mappings)
  const scenarioMapping = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    scenarios.forEach((s) => {
      if (s.scenario_id) {
        map[s.scenario_id] = { name: s.name || "" };
      }
    });
    return map;
  }, [scenarios]);

  const fieldMapping = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    fields.forEach((f) => {
      if (f.field_id) {
        map[f.field_id] = { name: f.name || "" };
      }
    });
    return map;
  }, [fields]);

  const departmentMapping = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    departments.forEach((d) => {
      if (d.department_id) {
        map[d.department_id] = { name: d.name || "" };
      }
    });
    return map;
  }, [departments]);

  // Use server-provided filter options directly (ListFilterSection pattern)
  const scenarioOptions = useMemo(
    () =>
      (documentsData?.scenario_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.scenario_filter],
  );
  const fieldFilterOptions = useMemo(
    () =>
      (documentsData?.field_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.field_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (documentsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.department_filter],
  );

  // Permission checking using server-provided flags
  const canDeleteDocument = useCallback(
    (documentId: string) => {
      const doc = documents.find((d) => d.document_id === documentId);
      return doc?.can_delete ?? false;
    },
    [documents]
  );

  // Handle document preview
  const handlePreview = useCallback((document: (typeof documents)[number]) => {
    setPreviewDocument(document);
    setShowPreviewDialog(true);
  }, []);

  // Handle document edit - navigate to edit page
  const handleEdit = useCallback(
    (document: (typeof documents)[number]) => {
      router.push(`/management/documents/${document.document_id}`);
    },
    [router]
  );

  // Handle single document delete
  const handleSingleDelete = useCallback(
    (document: (typeof documents)[number]) => {
      setDeletingDocument(document);
      setShowDeleteDialog(true);
    },
    []
  );

  // Define table columns inline using useMemo
  const columns = useMemo<ColumnDef<(typeof documents)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Document" />
        ),
        cell: ({ row }) => {
          const name = (row.getValue("name") as string) || "Untitled";
          const document = row.original;
          return (
            <div className="flex items-center gap-3 min-w-[240px]">
              <DocumentPreviewThumb document={document} />
              <div className="min-w-0">
                <div
                  title={name}
                  className="text-sm font-medium truncate max-w-[260px]"
                >
                  {truncateText(name, 32)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="uppercase">
                    {document.extension ?? "FILE"}
                  </span>
                  {!document.active && (
                    <Badge variant="secondary" className="text-[10px]">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "field_ids",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fields" />
        ),
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("field_ids") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
        cell: ({ row }) => {
          const itemIds = row.getValue("field_ids") as string[];
          if (!itemIds.length) {
            return <span className="text-xs text-muted-foreground">None</span>;
          }
          return (
            <div className="max-w-[240px] flex flex-wrap gap-1">
              {itemIds.slice(0, 4).map((id) => {
                const item = fieldMapping[id];
                const name = item ? item["name"] : id;
                return (
                  <Badge key={id} variant="default" className="text-[10px]">
                    {name}
                  </Badge>
                );
              })}
              {itemIds.length > 4 && (
                <Badge variant="outline" className="text-[10px]">
                  +{itemIds.length - 4}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "scenario_ids",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          const scenarioIds = row.getValue("scenario_ids") as string[];
          if (scenarioIds.length === 0) {
            return (
              <div className="max-w-[200px]">
                <span className="text-muted-foreground text-xs">None</span>
              </div>
            );
          }
          return (
            <div className="max-w-[200px] flex flex-wrap gap-1">
              {scenarioIds.slice(0, 3).map((id) => {
                const name = scenarioMapping[id]?.["name"] || id;
                return (
                  <Badge key={id} variant="outline" className="text-xs">
                    {truncateText(name as string, 15)}
                  </Badge>
                );
              })}
              {scenarioIds.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{scenarioIds.length - 3} more
                </Badge>
              )}
            </div>
          );
        },
        filterFn: (row, _id, value) => {
          const scenarioIds = row.getValue("scenario_ids") as string[];
          return (
            value.length === 0 ||
            scenarioIds.some((id: string) => value.includes(id))
          );
        },
      },
      {
        accessorKey: "department_ids",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Departments" />
        ),
        cell: ({ row }) => {
          const departmentIds = row.getValue("department_ids") as string[];
          if (!departmentIds?.length) {
            return (
              <div className="max-w-[200px]">
                <span className="text-muted-foreground text-xs">None</span>
              </div>
            );
          }
          return (
            <div className="max-w-[220px] flex flex-wrap gap-1">
              {departmentIds.slice(0, 2).map((id) => {
                const dept = departmentMapping[id];
                return (
                  <Badge key={id} variant="outline" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    {dept?.name || id}
                  </Badge>
                );
              })}
              {departmentIds.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{departmentIds.length - 2}
                </Badge>
              )}
            </div>
          );
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof documents)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "updated_at",
        id: "updatedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Updated" />
        ),
        cell: ({ row }) => {
          const date = new Date(row.getValue("updatedAt"));
          return (
            <div className="text-xs text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
        sortingFn: "datetime",
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const document = row.original;
          return (
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="outline"
                size="sm"
                data-testid={`preview-${document.document_id}`}
                onClick={() => handlePreview(document)}
                aria-label={`Preview ${document.name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${document.document_id}`}
                onClick={() => handleEdit(document)}
                aria-label={`Edit ${document.name}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {document.document_id &&
                canDeleteDocument(document.document_id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`delete-${document.document_id}`}
                    onClick={() => handleSingleDelete(document)}
                    aria-label={`Delete ${document.name}`}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [
      scenarioMapping,
      fieldMapping,
      departmentMapping,
      canDeleteDocument,
      handleEdit,
      handlePreview,
      handleSingleDelete,
    ]
  );

  // Create table instance for filtering and sorting
  const table = useReactTable({
    data: documents,
    columns: columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
      columnVisibility: {
        departments: false,
      },
    },
  });

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    documents.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Handle document delete
  const handleDelete = async () => {
    if (!deletingDocument || !deletingDocument.document_id) return;

    if (!canDeleteDocument(deletingDocument.document_id)) {
      toast.error(
        "This document cannot be deleted as it is used in active scenarios"
      );
      setShowDeleteDialog(false);
      setDeletingDocument(null);
      return;
    }

    setIsDeleting(true);
    try {
      if (!deleteDocumentAction) return;
      await deleteDocumentAction({
        body: { document_id: deletingDocument.document_id },
      });
      router.refresh();
      toast.success("Document deleted successfully");
      setShowDeleteDialog(false);
      setDeletingDocument(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete document"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No documents found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toolbar */}
            <div
              className="flex items-center justify-between"
              data-testid="documents-toolbar"
            >
              <div className="flex flex-1 items-center space-x-2 flex-wrap">
                <div className="w-full md:w-auto mb-2 md:mb-0">
                  <Input
                    data-testid="documents-search"
                    placeholder="Filter documents..."
                    value={
                      (table.getColumn("name")?.getFilterValue() as string) ??
                      ""
                    }
                    onChange={(event) =>
                      table
                        .getColumn("name")
                        ?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-full md:w-[150px] lg:w-[250px]"
                    aria-label="Search documents by name"
                    aria-controls="documents-list"
                  />
                </div>
                {table.getColumn("scenario_ids") && scenarioOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={table.getColumn("scenario_ids")!}
                    title="Scenarios"
                    options={scenarioOptions}
                  />
                )}
                {table.getColumn("field_ids") && fieldFilterOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={table.getColumn("field_ids")!}
                    title="Fields"
                    options={fieldFilterOptions}
                  />
                )}
                {table.getColumn("departments") &&
                  departmentOptions.length > 0 && (
                    <DataTableFacetedFilter
                      column={table.getColumn("departments")!}
                      title="Department"
                      options={departmentOptions}
                    />
                  )}
                {table.getState().columnFilters.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => table.resetColumnFilters()}
                    className="h-8 px-2 lg:px-3 hidden md:flex"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <div
              className="rounded-md border overflow-x-auto"
              data-testid="documents-table"
            >
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        if (!header.column.getIsVisible()) return null;

                        return (
                          <TableHead
                            key={header.id}
                            colSpan={header.colSpan}
                            className={`border-r py-2 text-xs text-center ${
                              header.column.getCanSort()
                                ? "cursor-pointer select-none pl-4"
                                : ""
                            }`}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {tableRows.length ? (
                    tableRows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="hover:bg-muted/30 transition-colors"
                        data-testid="documents-row"
                        data-document-id={row.original.document_id ?? undefined}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className="border-r px-3 py-2 text-center"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={table.getVisibleLeafColumns().length}
                        className="h-24 text-center px-6"
                      >
                        No documents match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <DataTablePagination table={table} />
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            data-testid="dialog-delete-document"
            aria-labelledby="delete-document-title"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-document-title">
                Delete Document
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deletingDocument ? (
                  <>
                    Are you sure you want to delete "{deletingDocument.name}"?
                    <br />
                    <br />
                    <span className="text-sm text-muted-foreground">
                      This action cannot be undone.
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    This action cannot be undone.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isDeleting}
                data-testid="btn-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={
                  isDeleting ||
                  !deletingDocument ||
                  !deletingDocument.document_id ||
                  !canDeleteDocument(deletingDocument.document_id)
                }
                variant="destructive"
                data-testid="btn-confirm-delete"
              >
                {isDeleting ? "Deleting..." : "Delete Document"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview Document Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="sm:max-w-4xl h-full max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                {previewDocument?.name || "Document Preview"}
              </DialogTitle>
              <DialogDescription>
                Preview the document content below.
              </DialogDescription>
            </DialogHeader>
            {previewDocument && (
              <div className="flex-1 min-h-0">
                <DocumentViewer
                  document={{
                    document_id: previewDocument.document_id ?? null,
                    name: previewDocument.name ?? null,
                    updated_at: previewDocument.updated_at ?? null,
                    extension: previewDocument.extension ?? null,
                    scenario_ids: previewDocument.scenario_ids ?? null,
                    can_edit: previewDocument.can_edit ?? null,
                    can_delete: previewDocument.can_delete ?? null,
                    active: previewDocument.active ?? null,
                    department_ids: previewDocument.department_ids ?? null,
                    upload_id: previewDocument.upload_id ?? null,
                    field_ids: previewDocument.field_ids ?? null,
                    valid_field_ids: previewDocument.valid_field_ids ?? null,
                    active_scenario_count:
                      previewDocument.active_scenario_count ?? null,
                    total_scenario_links:
                      previewDocument.total_scenario_links ?? null,
                  }}
                  bare={true}
                  isFormDocument={false}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPreviewDialog(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
