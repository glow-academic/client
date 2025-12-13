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
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Building2, Edit, Eye, Trash2, UploadCloud, X } from "lucide-react";

import type {
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListOut,
  GenerateTemplateIn,
  GenerateTemplateOut,
} from "@/app/(main)/management/documents/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
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
    input: DeleteDocumentIn,
  ) => Promise<DeleteDocumentOut>;
  generateTemplateAction?: (
    input: GenerateTemplateIn,
  ) => Promise<GenerateTemplateOut>;
}

export default function Documents({
  listData: serverListData,
  deleteDocumentAction,
  generateTemplateAction: _generateTemplateAction,
}: DocumentsProps) {
  const router = useRouter();
  const { departmentIds } = useProfile();

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

  // Extract data from V3 response
  const documents = useMemo(
    () => documentsData?.documents || [],
    [documentsData],
  );
  const scenarioMapping = useMemo(
    () => documentsData?.scenario_mapping || {},
    [documentsData],
  );
  const fieldMapping = useMemo(
    () => documentsData?.field_mapping || {},
    [documentsData],
  );
  const departmentMapping = useMemo(
    () => documentsData?.department_mapping || {},
    [documentsData],
  );

  // Use server-provided filter options directly (no client-side computation)
  const scenarioOptions = useMemo(
    () =>
      (documentsData?.scenario_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.scenario_options],
  );
  const departmentOptions = useMemo(
    () =>
      (documentsData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.department_options],
  );

  // Handle document preview
  const handlePreview = useCallback((document: (typeof documents)[number]) => {
    setPreviewDocument(document);
    setShowPreviewDialog(true);
  }, []);

  // Define columns inline using useMemo (for filtering/sorting only, cards render the data)
  const columns = useMemo<ColumnDef<(typeof documents)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Document" />
        ),
        cell: ({ row }) => {
          const name = row.getValue("name") as string;
          return (
            <div className="flex items-center gap-3 max-w-[300px]">
              <span title={name} className="text-sm font-medium">
                {truncateText(name, 25)}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "field_ids",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fields" />
        ),
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
          const date = new Date(row.getValue("updated_at"));
          const active = row.original.active || false;
          return (
            <div className="text-xs text-muted-foreground">
              {date.toLocaleDateString()}
              {!active && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Inactive
                </div>
              )}
            </div>
          );
        },
        sortingFn: "datetime",
      },
    ],
    [scenarioMapping, fieldMapping],
  );

  // Permission checking using server-provided flags
  const canDeleteDocument = useCallback(
    (documentId: string) => {
      const doc = documents.find((d) => d.document_id === documentId);
      return doc?.can_delete ?? false;
    },
    [documents],
  );

  // Handle document edit - navigate to edit page
  const handleEdit = useCallback(
    (document: (typeof documents)[number]) => {
      router.push(`/management/documents/d/${document.document_id}`);
    },
    [router],
  );

  // Handle single document delete
  const handleSingleDelete = useCallback(
    (document: (typeof documents)[number]) => {
      setDeletingDocument(document);
      setShowDeleteDialog(true);
    },
    [],
  );

  // Create table instance for filtering and sorting (cards are rendered from rows)
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
        pageSize: 12,
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
    if (!deletingDocument) return;

    if (!canDeleteDocument(deletingDocument.document_id)) {
      toast.error(
        "This document cannot be deleted as it is used in active scenarios",
      );
      setShowDeleteDialog(false);
      setDeletingDocument(null);
      return;
    }

    setIsDeleting(true);
    try {
      if (!deleteDocumentAction) return;
      await deleteDocumentAction({
        body: { documentId: deletingDocument.document_id },
      });
      router.refresh();
      toast.success("Document deleted successfully");
      setShowDeleteDialog(false);
      setDeletingDocument(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete document",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {documents.length === 0 ? (
          <div className="col-span-full">
            <div className="border-dashed border-2 rounded-lg">
              <div className="flex flex-col items-center justify-center py-12">
                <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Documents will appear here once uploaded
                </p>
              </div>
            </div>
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
                {table.getColumn("scenario_ids") && (
                  <DataTableFacetedFilter
                    column={table.getColumn("scenario_ids")!}
                    title="Scenarios"
                    options={scenarioOptions}
                  />
                )}
                {table.getColumn("departments") &&
                  departmentOptions.length > 0 &&
                  departmentIds.length > 1 && (
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

            {/* Cards Grid */}
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              role="grid"
              aria-label="documents grid"
              data-testid="documents-grid"
            >
              {tableRows.length ? (
                tableRows.map((row) => {
                  const document = row.original;
                  return (
                    <Card
                      key={document.document_id}
                      aria-label={document.name}
                      data-testid="document-card"
                      data-document-id={document.document_id}
                      className="relative flex flex-col h-full"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg truncate">
                              {document.name}
                            </CardTitle>
                            <div className="mt-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {!document.active && (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </div>
                              {document.department_ids &&
                                document.department_ids.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {document.department_ids
                                      .slice(0, 2)
                                      .map((deptId) => {
                                        const dept = departmentMapping[deptId];
                                        return (
                                          <Badge
                                            key={deptId}
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            <Building2 className="h-3 w-3 mr-1" />
                                            {dept?.name || deptId}
                                          </Badge>
                                        );
                                      })}
                                    {document.department_ids.length > 2 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        +{document.department_ids.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
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
                            {canDeleteDocument(document.document_id) && (
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
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
                        {document.field_ids &&
                          document.field_ids.length > 0 && (
                            <div className="mb-3">
                              <div className="flex flex-wrap gap-1">
                                {document.field_ids
                                  .slice(0, 3)
                                  .map((id) => {
                                    const item = fieldMapping[id];
                                    return (
                                      <Badge
                                        key={id}
                                        variant="default"
                                        className="text-[10px]"
                                      >
                                        {item?.name || id}
                                      </Badge>
                                    );
                                  })}
                                {document.field_ids.length > 3 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    +{document.field_ids.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        <div className="text-xs text-muted-foreground">
                          Updated{" "}
                          {new Date(document.updated_at).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No documents match the current filters.
                </div>
              )}
            </div>

            {/* Pagination */}
            <DataTablePagination table={table} card={true} />
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
                    document_id: previewDocument.document_id,
                    name: previewDocument.name,
                    updatedAt: previewDocument.updated_at,
                    extension: previewDocument.extension || "",
                    scenario_ids: previewDocument.scenario_ids,
                    can_edit: previewDocument.can_edit,
                    can_delete: previewDocument.can_delete,
                    active: previewDocument.active,
                    department_ids: previewDocument.department_ids || [],
                    upload_id: previewDocument.upload_id || null,
                    field_ids: previewDocument.field_ids,
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
