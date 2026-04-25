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

import DocumentViewer from "@/components/common/viewers/DocumentViewer";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Edit,
  Eye,
  FileText,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import type {
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
} from "@/app/(main)/management/documents/page";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDocumentAi } from "@/hooks/use-document-ai";
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
  updateDocumentAction?: (
    input: UpdateDocumentIn
  ) => Promise<UpdateDocumentOut>;
}

type DocumentRow = NonNullable<DocumentsListOut["documents"]>[number];

const DocumentPreviewThumb = ({ document }: { document: DocumentRow }) => {
  const hasPreview = Boolean(document.file_id);
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
        src={`/api/documents/preview/${document.file_id}`}
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
  updateDocumentAction,
}: DocumentsProps) {
  const router = useRouter();

  useDocumentAi({
    onComplete: () => router.refresh(),
  });

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

  // Flag catalog (e.g. document_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (documentsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [documentsData?.flag_filter]);

  // Selection state
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const selectedCount = selectedDocumentIds.length;
  const selectedDocuments = useMemo(() => {
    return documents.filter((d) => d.document_id && selectedDocumentIds.includes(d.document_id));
  }, [documents, selectedDocumentIds]);
  const deletableDocuments = useMemo(
    () => selectedDocuments.filter((d) => d.can_delete),
    [selectedDocuments],
  );
  const nonDeletableDocuments = useMemo(
    () => selectedDocuments.filter((d) => !d.can_delete),
    [selectedDocuments],
  );
  const editableDocuments = useMemo(
    () => selectedDocuments.filter((d) => d.can_edit ?? true),
    [selectedDocuments],
  );

  const toggleSelection = useCallback((documentId: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedDocumentIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = documents.filter((d) => d.document_id).map((d) => d.document_id!);
    setSelectedDocumentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [documents]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);
  const [bulkEditTemplateStatus, setBulkEditTemplateStatus] = useState<boolean | null>(null);
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[] | null>(null);

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
        id: "select",
        header: () => null,
        cell: ({ row }) => {
          const docId = row.original.document_id;
          if (!docId) return null;
          const isSelected = selectedDocumentIds.includes(docId);
          return (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelection(docId)}
              aria-label={`Select document ${row.original.name || "Unnamed"}`}
            />
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
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
          const itemIds = (row.getValue("field_ids") as string[]) ?? [];
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
          const scenarioIds = (row.getValue("scenario_ids") as string[]) ?? [];
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
          const scenarioIds = (row.getValue("scenario_ids") as string[]) ?? [];
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
      selectedDocumentIds,
      toggleSelection,
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

  const handleBulkDelete = async () => {
    if (!deleteDocumentAction || deletableDocuments.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableDocuments.map((d) => d.document_id!);
      await deleteDocumentAction({ body: { document_ids: ids, accept: true } });
      toast.success(`${ids.length} document(s) deleted successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete documents";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete documents");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateDocumentAction || editableDocuments.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasTemplateChange = bulkEditTemplateStatus !== null;
    const hasDeptChange = bulkEditDepartmentIds !== null;
    const hasAnyFlagChange = hasActiveChange || hasTemplateChange;

    if (!hasActiveChange && !hasTemplateChange && !hasDeptChange) {
      toast.error("No changes selected");
      return;
    }

    const flagId = (type: string) => flagOptions.find((f) => f.type === type)?.id;
    const activeFlagId = flagId("document_active");
    const templateFlagId = flagId("document_template");

    setIsBulkEditing(true);
    try {
      const items = editableDocuments.map((doc) => {
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          const isActive = hasActiveChange ? bulkEditActiveStatus : !doc.is_inactive;
          // Document type doesn't expose is_template on list rows yet — preserve nothing for it.
          const isTemplate = hasTemplateChange ? bulkEditTemplateStatus : false;
          flag_ids = [];
          if (isActive && activeFlagId) flag_ids.push(activeFlagId);
          if (isTemplate && templateFlagId) flag_ids.push(templateFlagId);
        }
        return {
          id: doc.document_id!,
          ...(hasAnyFlagChange && { flag_ids }),
          ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
        };
      });

      await updateDocumentAction({ body: { documents: items } } as UpdateDocumentIn);
      toast.success(`${items.length} document(s) updated successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update documents";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update documents");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setBulkEditTemplateStatus(null);
    setBulkEditDepartmentIds(null);
    setShowBulkEditDialog(true);
  };

  const allPageSelected = useMemo(() => {
    const pageIds = documents.filter((d) => d.document_id).map((d) => d.document_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedDocumentIds.includes(id));
  }, [documents, selectedDocumentIds]);

  const departmentPickerOptions = useMemo(
    () => departmentOptions.map((opt) => ({ value: opt.value, label: opt.label })),
    [departmentOptions],
  );

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
        body: { document_ids: [deletingDocument.document_id], accept: true },
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
            {/* Toolbar — swaps between filter bar and selection action bar */}
            {selectedCount > 0 ? (
              <div
                className="flex items-center justify-between gap-2"
                data-testid="documents-toolbar"
              >
                <div className="flex items-center gap-2">
                  {deleteDocumentAction && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8"
                      onClick={() => setShowBulkDeleteDialog(true)}
                      disabled={deletableDocuments.length === 0}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete {deletableDocuments.length} of {selectedCount}
                    </Button>
                  )}
                  {updateDocumentAction && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={openBulkEditDialog}
                      disabled={editableDocuments.length === 0}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit {editableDocuments.length} of {selectedCount}
                    </Button>
                  )}
                  {!allPageSelected && (
                    <Button variant="ghost" size="sm" className="h-8" onClick={selectAllOnPage}>
                      Select All
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8" onClick={clearSelection}>
                    Unselect All
                  </Button>
                </div>
              </div>
            ) : (
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
                  <ThreePickerFilters
                    slots={[
                      {
                        column: table.getColumn("scenario_ids"),
                        title: "Scenarios",
                        options: scenarioOptions,
                      },
                      {
                        column: table.getColumn("field_ids"),
                        title: "Fields",
                        options: fieldFilterOptions,
                      },
                      {
                        column: table.getColumn("departments"),
                        title: "Department",
                        options: departmentOptions,
                      },
                    ]}
                  />
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
            )}

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

        {/* Bulk Delete Confirmation Dialog */}
        <BulkDeleteDialog
          open={showBulkDeleteDialog}
          onOpenChange={setShowBulkDeleteDialog}
          count={deletableDocuments.length}
          entityLabel="document"
          entityLabelPlural="documents"
          isDeleting={isBulkDeleting}
          onConfirm={handleBulkDelete}
          description={
            <>
              <p>This action cannot be undone.</p>
              {deletableDocuments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                  <ul className="text-sm space-y-0.5">
                    {deletableDocuments.map((d) => (
                      <li key={d.document_id} className="flex items-center gap-1.5">
                        <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                        {d.name || "Unnamed Document"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {nonDeletableDocuments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">Cannot be deleted (in use):</p>
                  <ul className="text-sm space-y-0.5">
                    {nonDeletableDocuments.map((d) => (
                      <li key={d.document_id} className="flex items-center gap-1.5 text-muted-foreground">
                        {d.name || "Unnamed Document"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          }
        />

        {/* Bulk Edit Modal */}
        <BulkEditDialog
          open={showBulkEditDialog}
          onOpenChange={setShowBulkEditDialog}
          count={editableDocuments.length}
          entityLabelPlural="documents"
          isSaving={isBulkEditing}
          onSave={handleBulkEdit}
        >
          <BulkEditFlagField
            label="Active Status"
            value={bulkEditActiveStatus}
            onChange={setBulkEditActiveStatus}
          />

          <BulkEditFlagField
            label="Template"
            trueLabel="Template"
            falseLabel="Not Template"
            value={bulkEditTemplateStatus}
            onChange={setBulkEditTemplateStatus}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Departments</Label>
              {bulkEditDepartmentIds !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setBulkEditDepartmentIds(null)}
                >
                  Reset
                </Button>
              )}
            </div>
            {bulkEditDepartmentIds === null ? (
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setBulkEditDepartmentIds([])}
              >
                No change — click to edit departments
              </Button>
            ) : (
              <GenericPicker
                items={departmentPickerOptions}
                selectedIds={bulkEditDepartmentIds}
                onSelect={setBulkEditDepartmentIds}
                multiSelect
                getId={(d) => d.value}
                getLabel={(d) => d.label}
                placeholder="Select departments..."
                showClearAction
                clearActionLabel="Clear All"
                searchPlaceholder="Search departments..."
                emptyMessage="No departments found."
                groupHeading="Departments"
                hideSelectedChips={false}
                showClearAll
              />
            )}
          </div>
        </BulkEditDialog>

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
                    file_id: previewDocument.file_id ?? null,
                    field_ids: previewDocument.field_ids ?? null,
                    valid_field_ids: previewDocument.valid_field_ids ?? null,
                    active_scenario_count:
                      previewDocument.active_scenario_count ?? null,
                    total_scenario_links:
                      previewDocument.total_scenario_links ?? null,
                  }}
                  bare={true}
                  isFormDocument={false}
                  downloadBaseUrl="/api/documents/download"
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
