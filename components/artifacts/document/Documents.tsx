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
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";

import type {
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListBody,
  DocumentsListOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
  CreateDocumentIn,
  CreateDocumentOut,
} from "@/app/(main)/management/documents/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import type { VisibilityState } from "@tanstack/react-table";
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
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export interface DocumentsProps {
  // Server-provided data (for server-side rendering)
  listData: DocumentsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  deleteDocumentAction?: (
    input: DeleteDocumentIn
  ) => Promise<DeleteDocumentOut>;
  updateDocumentAction?: (
    input: UpdateDocumentIn
  ) => Promise<UpdateDocumentOut>;
  createDocumentAction?: (input: CreateDocumentIn) => Promise<CreateDocumentOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/document/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: DocumentsListBody;
}

const DOCUMENTS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  field_ids: true,
  scenario_ids: true,
  department_ids: true,
  updatedAt: true,
  // Hidden facet column — always off
  departments: false,
};

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
  initialColumnVisibility,
  deleteDocumentAction,
  updateDocumentAction,
  createDocumentAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
}: DocumentsProps) {
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "documents",
    initialColumnVisibility ?? DOCUMENTS_INITIAL_COLUMN_VISIBILITY,
  );
  const router = useRouter();

  useDocumentAi({
    onComplete: () => router.refresh(),
  });

  // Table state for filtering
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
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

  // Extract data from V3 response - arrays directly (composite types).
  // ``baseDocuments`` is the SSR-fetched truth; ``useArtifactGhosts``
  // layers a per-call CRUD lifecycle on top so committed rows merge
  // into the table without a ``router.refresh()`` (which would re-burst
  // the page's SSR fetches — same rationale as Personas.tsx /
  // Scenarios.tsx).
  const baseDocuments = useMemo(
    () => documentsData?.documents || [],
    [documentsData]
  );

  const {
    ghosts: documentGhosts,
    mergedRows: mergedDocuments,
    ack: ackDocumentGhost,
  } = useArtifactGhosts({
    artifactType: "document",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/row. Each maps to a distinct ghost visual in
    // the inline ghost rows (creating / updating / deleting /
    // duplicating skeleton). Without ``duplicate`` here the LLM's
    // duplicate tool dispatch fires audit events that nothing is
    // subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseDocuments,
    rowKey: "document_id",
    // ``documents`` plural matches the field name the create /
    // duplicate / update impls now include on their responses (see
    // ``hydrate_document_list_rows``). The hook reads
    // ``output.documents`` from the audit ``.completed`` payload to
    // materialize new/changed rows directly — no SSR refresh needed.
    artifactPlural: "documents",
  });

  // Downstream code reads ``documents`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const documents = mergedDocuments;

  // Unified ack: live in-flight ghosts go through the hook; server-side
  // persistent pending rows (synthesized from ``pending_status``) ack
  // via the generic server action and refresh.
  const handleDocumentAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = documentGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackDocumentGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "document",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [documentGhosts, ackDocumentGhost, router],
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

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params model
  // the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection of named rows
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //   - (none of the above)        → empty selection
  //
  // The all-matching mode keeps the URL compact for huge datasets
  // (one boolean instead of N ids) and follows the active filter —
  // change the filter and "all matching" follows naturally. Shallow
  // updates avoid the RSC re-fetch burst.
  const [selectedDocumentIds, setSelectedDocumentIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedDocumentIds, setExcludedDocumentIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.
  const totalMatchingCount = documentsData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedDocumentIds.includes(id)
        : selectedDocumentIds.includes(id);
    },
    [selectAllMatching, excludedDocumentIds, selectedDocumentIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedDocumentIds.length)
    : selectedDocumentIds.length;

  /** Selected rows that are loaded on the current page. Under all-
   *  matching mode this is "every loaded row not in excludedIds";
   *  under explicit mode it's the rows whose id is in selectedIds.
   *  Bulk-op handlers dispatch on ``selectAllMatching`` to either
   *  enumerate per-row patches (explicit) or send the filter envelope
   *  + ``patch`` for the server to expand (all-matching). */
  const selectedDocuments = useMemo(() => {
    return documents.filter((d) => isSelected(d.document_id));
  }, [documents, isSelected]);
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

  // Toggle selection for a single document. Under all-matching mode
  // we toggle membership in excludedDocumentIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedDocumentIds toggle.
  const toggleSelection = useCallback((documentId: string) => {
    if (selectAllMatching) {
      void setExcludedDocumentIds((prev) =>
        prev.includes(documentId)
          ? prev.filter((id) => id !== documentId)
          : [...prev, documentId],
      );
    } else {
      void setSelectedDocumentIds((prev) =>
        prev.includes(documentId)
          ? prev.filter((id) => id !== documentId)
          : [...prev, documentId],
      );
    }
  }, [selectAllMatching, setExcludedDocumentIds, setSelectedDocumentIds]);

  const clearSelection = useCallback(() => {
    void setSelectedDocumentIds([]);
    void setSelectAllMatching(false);
    void setExcludedDocumentIds([]);
  }, [setSelectedDocumentIds, setSelectAllMatching, setExcludedDocumentIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = documents.filter((d) => d.document_id).map((d) => d.document_id!);
    void setSelectAllMatching(false);
    void setExcludedDocumentIds([]);
    void setSelectedDocumentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [documents, setSelectAllMatching, setExcludedDocumentIds, setSelectedDocumentIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedDocumentIds([]);
    void setExcludedDocumentIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedDocumentIds, setExcludedDocumentIds, setSelectAllMatching]);

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
          const checked = isSelected(docId);
          return (
            <Checkbox
              checked={checked}
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
                asChild
                variant="outline"
                size="sm"
                data-testid={`edit-${document.document_id}`}
              >
                <Link
                  href={`/management/documents/${document.document_id}`}
                  prefetch={false}
                  aria-label={`Edit ${document.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Link>
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
      handlePreview,
      handleSingleDelete,
      isSelected,
      toggleSelection,
    ]
  );

  // Create table instance for filtering and sorting
  const table = useReactTable({
    data: documents,
    columns: columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 20,
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
    // Depend on the ``documents`` array reference (not just length) so
    // updates that mutate row content but not list cardinality still
    // invalidate the memo. ``documents`` is stabilized upstream by
    // ``mergedDocuments``'s useMemo, so a new reference only appears
    // when state.added/replaced/hiddenIds actually change — no
    // spurious recomputes.
    documents,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteDocumentAction`` call shape; the
    // body just differs.
    if (!deleteDocumentAction) return;
    if (!selectAllMatching && deletableDocuments.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const body = selectAllMatching
        ? {
            // Server resolves matching ids from the same filter the
            // page used (currentSearchBody is the SSR body), subtracts
            // ``excluded_ids``, then runs the existing per-row delete.
            // Per-row permission failures soft-skip — surfaced in
            // response.results[].
            all: true as const,
            excluded_ids: excludedDocumentIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            document_ids: deletableDocuments.map((d) => d.document_id!),
            accept: true,
          };

      const result = await deleteDocumentAction({ body } as DeleteDocumentIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteDocumentOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} document(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} document(s) deleted successfully`);
      }
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
    if (!updateDocumentAction) return;
    if (!selectAllMatching && editableDocuments.length === 0) return;

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
      // Shared change set used by both paths. Under all-matching the
      // server clones this per resolved row (stamping each id);
      // under explicit we clone client-side, preserving per-row flag
      // state for fields we aren't toggling.
      const sharedPatch = {
        ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
      };

      let body: UpdateDocumentIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // each toggle becomes "set to this value across all matching
        // rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
          if (bulkEditTemplateStatus && templateFlagId) flag_ids.push(templateFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedDocumentIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdateDocumentIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableDocuments.map((doc) => {
          let flag_ids: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = hasActiveChange ? bulkEditActiveStatus : !doc.is_inactive;
            // Document list rows expose ``is_template`` from the
            // server now; fall back to false when undefined.
            const isTemplate = hasTemplateChange
              ? bulkEditTemplateStatus
              : (doc.is_template ?? false);
            flag_ids = [];
            if (isActive && activeFlagId) flag_ids.push(activeFlagId);
            if (isTemplate && templateFlagId) flag_ids.push(templateFlagId);
          }
          return {
            id: doc.document_id!,
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { documents: items } as UpdateDocumentIn["body"];
      }

      const result = await updateDocumentAction({ body } as UpdateDocumentIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateDocumentOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} document(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} document(s) updated successfully`);
      }
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

  // Check if all documents on the current page are selected. Under
  // all-matching mode every loaded row whose id isn't in
  // ``excludedDocumentIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = documents.filter((d) => d.document_id).map((d) => d.document_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [documents, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > documents.length;

  const departmentPickerOptions = useMemo(
    () => departmentOptions.map((opt) => ({ value: opt.value, label: opt.label })),
    [departmentOptions],
  );

  // Render a ghost table row for an in-flight CRUD operation.
  // Mirrors the persona/scenario card-ghost pattern but adapted to a
  // table layout: we still get a status badge, lifecycle-tinted
  // background, spinner placeholder where the thumbnail would be,
  // and the row's existing-content (for update/delete via
  // ``g.before``) or streaming args (for create/duplicate via
  // ``g.partial``). Selection checkbox + actions are suppressed —
  // there's no committed id yet to act on.
  const renderDocumentGhostRow = (
    ghost: Ghost<DocumentRow>,
  ) => {
    const ghostState = ghost.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    // ``before`` is populated for update/delete from baseRows
    // lookup; ``partial`` is the LLM streaming args for
    // create/duplicate. Either way we display whatever the hook
    // exposes — sparse fields render as muted placeholders.
    const shell = (ghost.before ?? ghost.partial ?? {}) as Partial<DocumentRow>;
    const docName = shell.name || (inFlight ? "Generating…" : "Pending");

    const ghostTintClass = isFailed
      ? "bg-destructive/5 border-l-4 border-l-destructive/40"
      : isPending
      ? "bg-amber-50/40 dark:bg-amber-950/20 border-l-4 border-l-amber-500/50"
      : ghostState === "deleting"
      ? "bg-destructive/5 opacity-70 border-l-4 border-l-destructive/30"
      : inFlight
      ? "bg-primary/5 animate-pulse border-l-4 border-l-primary/40"
      : "";

    const visibleCols = table.getVisibleLeafColumns();
    return (
      <TableRow
        key={`ghost-${ghost.callId}`}
        className={`transition-colors ${ghostTintClass}`}
        data-testid="document-ghost-row"
        data-ghost-state={ghostState}
        aria-busy={inFlight ? true : undefined}
      >
        {visibleCols.map((col) => {
          // Select column: no checkbox while ghost (no row id yet).
          if (col.id === "select") {
            return (
              <TableCell key={`ghost-${ghost.callId}-${col.id}`} className="border-r px-3 py-2 text-center" />
            );
          }
          // Name column: spinner placeholder for the thumbnail +
          // streaming/before name + status badge.
          if (col.id === "name") {
            return (
              <TableCell key={`ghost-${ghost.callId}-${col.id}`} className="border-r px-3 py-2">
                <div className="flex items-center gap-3 min-w-[240px]">
                  <div className="h-12 w-10 rounded border bg-muted/40 flex items-center justify-center">
                    {inFlight ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      title={docName}
                      className="text-sm font-medium truncate max-w-[260px]"
                    >
                      {truncateText(docName, 32)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={isFailed ? "destructive" : isPending ? "outline" : "secondary"}
                        className={`text-[10px] ${isPending ? "border-amber-500 text-amber-700 dark:text-amber-400" : ""}`}
                      >
                        {ghostState === "creating" && "Creating…"}
                        {ghostState === "duplicating" && "Duplicating…"}
                        {ghostState === "updating" && "Updating…"}
                        {ghostState === "deleting" && "Deleting…"}
                        {ghostState === "pending" && "Pending"}
                        {ghostState === "failed" && "Failed"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </TableCell>
            );
          }
          // Actions column: Accept/Reject when pending; suppressed otherwise.
          if (col.id === "actions") {
            if (isPending && ghost.callId) {
              return (
                <TableCell key={`ghost-${ghost.callId}-${col.id}`} className="border-r px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleDocumentAck(ghost.callId, true, ghost.op)}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleDocumentAck(ghost.callId, false, ghost.op)}
                    >
                      Reject
                    </Button>
                  </div>
                </TableCell>
              );
            }
            return (
              <TableCell key={`ghost-${ghost.callId}-${col.id}`} className="border-r px-3 py-2 text-center" />
            );
          }
          // Default cell: render an empty placeholder (most facet
          // columns aren't streamed by the LLM, so showing the
          // before-row's value would be misleading for update/delete
          // already covered by the row tint).
          return (
            <TableCell key={`ghost-${ghost.callId}-${col.id}`} className="border-r px-3 py-2 text-center">
              <span className="text-xs text-muted-foreground">—</span>
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

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
        {documents.length === 0 && documentGhosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No documents found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toolbar — swaps between filter bar and selection action bar */}
            {selectedCount > 0 ? (
              <div className="space-y-2" data-testid="documents-toolbar">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {deleteDocumentAction && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        disabled={!selectAllMatching && deletableDocuments.length === 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {selectAllMatching
                          ? `Delete ${selectedCount} matching`
                          : `Delete ${deletableDocuments.length} of ${selectedCount}`}
                      </Button>
                    )}
                    {updateDocumentAction && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={openBulkEditDialog}
                        disabled={!selectAllMatching && editableDocuments.length === 0}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        {selectAllMatching
                          ? `Edit ${selectedCount} matching`
                          : `Edit ${editableDocuments.length} of ${selectedCount}`}
                      </Button>
                    )}
                    {!allPageSelected && !selectAllMatching && (
                      <Button variant="ghost" size="sm" className="h-8" onClick={selectAllOnPage}>
                        Select Page
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8" onClick={clearSelection}>
                      Unselect All
                    </Button>
                  </div>
                  <DataTableViewOptions
                    table={table}
                    hiddenColumns={["select", "name", "actions", "departments"]}
                  />
                </div>

                {/* Cross-page selection banners. Two states:
                    (a) page-all selected, more matching elsewhere → offer
                        "Select all N matching" to flip into all-matching mode.
                    (b) all-matching active → show count + Clear so the
                        user always has an obvious escape hatch.
                    Mutually exclusive — both never render at once. */}
                {!selectAllMatching && allPageSelected && hasMoreThanCurrentPage && (
                  <div
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                    data-testid="select-all-matching-banner"
                  >
                    <span className="text-muted-foreground">
                      All {documents.length} on this page selected.
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={selectAllMatchingNow}
                    >
                      Select all {totalMatchingCount} matching
                    </Button>
                  </div>
                )}
                {selectAllMatching && (
                  <div
                    className="flex items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm"
                    data-testid="all-matching-active-banner"
                  >
                    <span className="text-muted-foreground">
                      All {selectedCount} matching documents selected
                      {excludedDocumentIds.length > 0 && ` (${excludedDocumentIds.length} excluded)`}.
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={clearSelection}
                    >
                      Clear
                    </Button>
                  </div>
                )}
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
                <div className="flex items-center gap-2">
                  {parseCsvAction && importFields && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setShowBulkImportDialog(true)}
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Import CSV
                    </Button>
                  )}
                  <DataTableViewOptions
                    table={table}
                    hiddenColumns={["select", "name", "actions", "departments"]}
                  />
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
                  {/* In-flight ghost rows from audited writes
                      (create/duplicate/update/delete in non-terminal
                      states). Once a ghost commits, its hydrated row
                      is in mergedDocuments (via state.added) AND the
                      ghost's state flips to "committed" — we filter
                      those out so the real row replaces the ghost in
                      place without a duplicate frame. */}
                  {documentGhosts
                    .filter((g) => g.state !== "committed" && g.state !== "accepted")
                    .map((g) => renderDocumentGhostRow(g))}
                  {tableRows.length ? (
                    tableRows.map((row) => {
                      const docRow = row.original;
                      // Server-side pending status (from soft_calls_mv).
                      // Render as a ghost row so Accept/Reject controls
                      // appear and the visual reflects the dormant state.
                      if (docRow.pending_status === "pending" && docRow.pending_call_id) {
                        const persistentGhost: Ghost<DocumentRow> = {
                          callId: docRow.pending_call_id,
                          op: (docRow.pending_operation as Ghost<DocumentRow>["op"]) ?? "create",
                          state: "pending",
                          rowId: docRow.document_id ?? null,
                          partial: docRow as unknown as Ghost<DocumentRow>["partial"],
                          before: docRow,
                          tool: null,
                          error: null,
                          arguments: {},
                        };
                        return renderDocumentGhostRow(persistentGhost);
                      }
                      return (
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
                      );
                    })
                  ) : (
                    documentGhosts.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={table.getVisibleLeafColumns().length}
                          className="h-24 text-center px-6"
                        >
                          No documents match the current filters.
                        </TableCell>
                      </TableRow>
                    )
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
          count={selectAllMatching ? selectedCount : deletableDocuments.length}
          entityLabel="document"
          entityLabelPlural="documents"
          isDeleting={isBulkDeleting}
          onConfirm={handleBulkDelete}
          description={
            <>
              <p>This action cannot be undone.</p>
              {selectAllMatching ? (
                // All-matching mode: server resolves rows from filter +
                // exclusions; per-row permission failures soft-skip.
                // We can't enumerate names without round-tripping through
                // the search endpoint (which would re-trigger the RSC
                // burst), so show the count + filter state instead.
                <div className="text-sm text-muted-foreground">
                  <p>
                    All <span className="font-medium text-foreground">{selectedCount}</span> matching
                    {" "}documents will be deleted server-side using the current filter.
                  </p>
                  {excludedDocumentIds.length > 0 && (
                    <p className="mt-1">
                      {excludedDocumentIds.length} explicitly excluded.
                    </p>
                  )}
                  <p className="mt-1">
                    Documents you don't have permission to delete will be skipped automatically.
                  </p>
                </div>
              ) : (
                <>
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
              )}
            </>
          }
        />

        {/* Bulk Edit Modal */}
        <BulkEditDialog
          open={showBulkEditDialog}
          onOpenChange={setShowBulkEditDialog}
          count={selectAllMatching ? selectedCount : editableDocuments.length}
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

        {/* Bulk Import Dialog */}
        {parseCsvAction && importFields && (
          <BulkImport
            open={showBulkImportDialog}
            onClose={() => {
              setShowBulkImportDialog(false);
              router.refresh();
            }}
            fields={importFields}
            artifactName="Documents"
            parseCsvAction={parseCsvAction}
            onSave={async (items) => {
              if (!createDocumentAction) throw new Error("Create action not available");
              const documents = items.map((item) => ({
                name: item["name"] as string | undefined,
                description: item["description"] as string | undefined,
                departments: item["departments"] as string[] | undefined,
              }));
              return createDocumentAction({ body: { documents } } as CreateDocumentIn);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
