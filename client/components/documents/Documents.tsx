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
  VisibilityState,
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

import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DocumentPreviewCard } from "@/components/documents/DocumentPreviewCard";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Edit, Eye, Grid3X3, List, Trash2, UploadCloud, X } from "lucide-react";

type DocumentType =
  | "homework"
  | "project"
  | "quiz"
  | "midterm"
  | "lab"
  | "lecture"
  | "syllabus";

import type {
  BulkDeleteDocumentsIn,
  BulkDeleteDocumentsOut,
  BulkUpdateDocumentsIn,
  BulkUpdateDocumentsOut,
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentDetailBulkIn,
  DocumentDetailBulkOut,
  DocumentDetailIn,
  DocumentDetailOut,
  DocumentsListOut,
  FinalizeDocumentUploadIn,
  FinalizeDocumentUploadOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
} from "@/app/(main)/create/documents/page";
import type {
  CreateParameterItemIn,
  CreateParameterItemOut,
} from "@/app/(main)/management/parameters/page";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import ParameterItemPicker from "@/components/common/forms/ParameterItemPicker";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";
import { DocumentUploadDialog } from "./DocumentUploadDialog";

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

// Explicitly define server action types (matching the page exports)
export type GetDocumentDetailAction = (
  input: DocumentDetailIn,
) => Promise<DocumentDetailOut>;
export type GetDocumentDetailBulkAction = (
  input: DocumentDetailBulkIn,
) => Promise<DocumentDetailBulkOut>;

export interface DocumentsProps {
  // Server-provided data (for server-side rendering)
  listData: DocumentsListOut;
  // Server actions (replaces useMutation)
  deleteDocumentAction?: (
    input: DeleteDocumentIn,
  ) => Promise<DeleteDocumentOut>;
  bulkDeleteDocumentsAction?: (
    input: BulkDeleteDocumentsIn,
  ) => Promise<BulkDeleteDocumentsOut>;
  updateDocumentAction?: (
    input: UpdateDocumentIn,
  ) => Promise<UpdateDocumentOut>;
  bulkUpdateDocumentsAction?: (
    input: BulkUpdateDocumentsIn,
  ) => Promise<BulkUpdateDocumentsOut>;
  // Server actions for fetching detail data
  getDocumentDetailAction?: GetDocumentDetailAction;
  getDocumentDetailBulkAction?: GetDocumentDetailBulkAction;
  // Server actions for upload and parameter item creation
  finalizeDocumentUploadAction?: (
    input: FinalizeDocumentUploadIn,
  ) => Promise<FinalizeDocumentUploadOut>;
  createParameterItemAction?: (
    input: CreateParameterItemIn,
  ) => Promise<CreateParameterItemOut>;
}

export default function Documents({
  listData: serverListData,
  deleteDocumentAction,
  bulkDeleteDocumentsAction,
  updateDocumentAction,
  bulkUpdateDocumentsAction,
  getDocumentDetailAction,
  getDocumentDetailBulkAction,
  finalizeDocumentUploadAction,
  createParameterItemAction,
}: DocumentsProps) {
  const router = useRouter();
  const { effectiveProfile, effectiveDepartmentIds } = useProfile();
  const isMobile = useIsMobile();

  // State management
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Table state
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<
    (typeof documents)[number] | null
  >(null);
  const [previewDocument, setPreviewDocument] = useState<
    (typeof documents)[number] | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [documentDetail, setDocumentDetail] =
    useState<DocumentDetailOut | null>(null);
  const [bulkDocumentDetail, setBulkDocumentDetail] =
    useState<DocumentDetailBulkOut | null>(null);
  const [isLoadingDocumentDetail, setIsLoadingDocumentDetail] = useState(false);
  const [isLoadingBulkDetail, setIsLoadingBulkDetail] = useState(false);
  const [bulkType, setBulkType] = useState<DocumentType | "__keep__">(
    "__keep__",
  );
  const [bulkParameterItemIds, setBulkParameterItemIds] = useState<string[]>(
    [],
  );
  const [bulkDepartmentId, setBulkDepartmentId] = useState<string | null>(null);

  // Staged selections per department (preserved when departments are deselected)
  // Separate for single edit and bulk edit modes
  type StagedSelections = {
    parameter_item_ids?: string[];
  };
  const [_stagedSelectionsEdit, setStagedSelectionsEdit] = useState<
    Record<string, StagedSelections>
  >({});
  const [_stagedSelectionsBulk, setStagedSelectionsBulk] = useState<
    Record<string, StagedSelections>
  >({});
  const [previousDepartmentIdsEdit, setPreviousDepartmentIdsEdit] = useState<
    string[]
  >([]);
  const [previousDepartmentIdBulk, setPreviousDepartmentIdBulk] = useState<
    string | null
  >(null);

  // Listen for upload button click from layout
  useEffect(() => {
    const handleOpenUpload = () => setUploadDialogOpen(true);
    window.addEventListener("openDocumentUpload", handleOpenUpload);
    return () =>
      window.removeEventListener("openDocumentUpload", handleOpenUpload);
  }, []);

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
  const parameterItemMapping = useMemo(
    () => documentsData?.parameter_item_mapping || {},
    [documentsData],
  );
  const parameterMapping = useMemo(
    () => documentsData?.parameter_mapping || {},
    [documentsData],
  );
  const departmentMapping = useMemo(
    () => documentsData?.department_mapping || {},
    [documentsData],
  );

  // Use server-provided filter options directly (no client-side computation)
  const typeOptions = useMemo(
    () =>
      (documentsData?.type_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.type_options]
  );
  const scenarioOptions = useMemo(
    () =>
      (documentsData?.scenario_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.scenario_options]
  );
  const departmentOptions = useMemo(
    () =>
      (documentsData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [documentsData?.department_options]
  );

  // Compute valid department IDs for upload dialog
  const validDepartmentIds = useMemo(
    () => effectiveDepartmentIds,
    [effectiveDepartmentIds],
  );

  // Filter valid parameter item IDs for edit dialog based on selected departments
  const validParameterItemIdsForEdit = useMemo(() => {
    if (!documentDetail) return [];
    const baseIds = documentDetail.valid_parameter_item_ids || [];
    const selectedDeptIds = documentDetail.department_ids || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of parameter_ids from selected departments
    const deptParameterIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = documentDetail.department_mapping[deptId];
      if (deptData?.parameter_ids && Array.isArray(deptData.parameter_ids)) {
        deptData.parameter_ids.forEach((id) => deptParameterIds.add(id));
      }
    });

    // Filter parameter items: include if their parameter_id is in department parameter IDs
    const parameterItemMapping = documentDetail.parameter_item_mapping;
    return baseIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      return item && deptParameterIds.has(item.parameter_id);
    });
  }, [documentDetail]);

  // Filter valid parameter item IDs for bulk edit dialog based on selected departments
  const validParameterItemIdsForBulk = useMemo(() => {
    if (!bulkDocumentDetail) return [];
    const baseIds = bulkDocumentDetail.valid_parameter_item_ids || [];
    const selectedDeptIds = bulkDepartmentId
      ? [bulkDepartmentId]
      : bulkDocumentDetail.department_ids || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of parameter_ids from selected departments
    const deptParameterIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = bulkDocumentDetail.department_mapping[deptId];
      if (deptData?.parameter_ids && Array.isArray(deptData.parameter_ids)) {
        deptData.parameter_ids.forEach((id) => deptParameterIds.add(id));
      }
    });

    // Filter parameter items: include if their parameter_id is in department parameter IDs
    const parameterItemMapping = bulkDocumentDetail.parameter_item_mapping;
    return baseIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      return item && deptParameterIds.has(item.parameter_id);
    });
  }, [bulkDocumentDetail, bulkDepartmentId]);

  // Track department changes and manage staged selections for single edit mode
  useEffect(() => {
    if (!editingDocument || !documentDetail) return;

    const currentDeptIds = editingDocument.department_ids || [];
    const prevDeptIds = previousDepartmentIdsEdit || [];

    // Skip if no change (initial load or same selection)
    if (
      currentDeptIds.length === prevDeptIds.length &&
      currentDeptIds.every((id: string, idx: number) => id === prevDeptIds[idx])
    ) {
      // Initialize on first load
      if (prevDeptIds.length === 0 && currentDeptIds.length > 0) {
        setPreviousDepartmentIdsEdit(currentDeptIds);
      }
      return;
    }

    // Find departments that were deselected
    const deselectedDepts = prevDeptIds.filter(
      (id: string) => !currentDeptIds.includes(id),
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id: string) => !prevDeptIds.includes(id),
    );

    // Save selections for deselected departments
    if (deselectedDepts.length > 0) {
      const currentParamIds = editingDocument.parameter_item_ids || [];
      setStagedSelectionsEdit((prev: Record<string, StagedSelections>) => {
        const updated = { ...prev };
        deselectedDepts.forEach((deptId: string) => {
          updated[deptId] = {
            parameter_item_ids: [...currentParamIds],
          };
        });
        return updated;
      });
    }

    // Restore selections for newly selected departments
    if (newlySelectedDepts.length > 0) {
      setStagedSelectionsEdit((prev: Record<string, StagedSelections>) => {
        newlySelectedDepts.forEach((deptId: string) => {
          const staged = prev[deptId];
          if (
            staged?.parameter_item_ids &&
            staged.parameter_item_ids.length > 0
          ) {
            const validParamSet = new Set(validParameterItemIdsForEdit);
            const validParams = staged.parameter_item_ids.filter((id) =>
              validParamSet.has(id),
            );
            if (validParams.length > 0) {
              setEditingDocument(
                (prevDoc: (typeof documents)[number] | null) => {
                  if (!prevDoc) return null;
                  const combined = new Set([
                    ...(prevDoc.parameter_item_ids || []),
                    ...validParams,
                  ]);
                  return {
                    ...prevDoc,
                    parameter_item_ids: Array.from(combined),
                  };
                },
              );
            }
          }
        });
        return prev;
      });
    }

    // Update previous department IDs
    setPreviousDepartmentIdsEdit(currentDeptIds);
  }, [
    editingDocument,
    previousDepartmentIdsEdit,
    validParameterItemIdsForEdit,
    documentDetail,
  ]);

  // Track department changes and manage staged selections for bulk edit mode
  useEffect(() => {
    const currentDeptId = bulkDepartmentId;
    const prevDeptId = previousDepartmentIdBulk;

    // Skip if no change (initial load or same selection)
    if (currentDeptId === prevDeptId) {
      // Initialize on first load
      if (prevDeptId === null && currentDeptId !== null) {
        setPreviousDepartmentIdBulk(currentDeptId);
      }
      return;
    }

    // Save selections for deselected department
    if (prevDeptId !== null && currentDeptId !== prevDeptId) {
      setStagedSelectionsBulk((prev: Record<string, StagedSelections>) => {
        const updated = { ...prev };
        updated[prevDeptId] = {
          parameter_item_ids: [...bulkParameterItemIds],
        };
        return updated;
      });
    }

    // Restore selections for newly selected department
    if (currentDeptId !== null && currentDeptId !== prevDeptId) {
      setStagedSelectionsBulk((prev: Record<string, StagedSelections>) => {
        const staged = prev[currentDeptId];
        if (
          staged?.parameter_item_ids &&
          staged.parameter_item_ids.length > 0
        ) {
          const validParamSet = new Set(validParameterItemIdsForBulk);
          const validParams = staged.parameter_item_ids.filter((id) =>
            validParamSet.has(id),
          );
          if (validParams.length > 0) {
            setBulkParameterItemIds((prevParams: string[]) => {
              const combined = new Set([...prevParams, ...validParams]);
              return Array.from(combined);
            });
          }
        }
        return prev;
      });
    }

    // Update previous department ID
    setPreviousDepartmentIdBulk(currentDeptId);
  }, [
    bulkDepartmentId,
    previousDepartmentIdBulk,
    bulkParameterItemIds,
    validParameterItemIdsForBulk,
  ]);

  // Clean up staged selections for departments that are no longer valid (edit mode)
  useEffect(() => {
    if (!documentDetail) return;
    const validDeptIds = new Set(documentDetail.valid_department_ids || []);
    setStagedSelectionsEdit((prev) => {
      const cleaned: Record<string, StagedSelections> = {};
      Object.keys(prev).forEach((deptId) => {
        const staged = prev[deptId];
        if (validDeptIds.has(deptId) && staged) {
          cleaned[deptId] = staged;
        }
      });
      return cleaned;
    });
  }, [documentDetail]);

  // Clean up staged selections for departments that are no longer valid (bulk mode)
  useEffect(() => {
    if (!bulkDocumentDetail) return;
    const validDeptIds = new Set(bulkDocumentDetail.valid_department_ids || []);
    setStagedSelectionsBulk((prev: Record<string, StagedSelections>) => {
      const cleaned: Record<string, StagedSelections> = {};
      Object.keys(prev).forEach((deptId) => {
        const staged = prev[deptId];
        if (validDeptIds.has(deptId) && staged) {
          cleaned[deptId] = staged;
        }
      });
      return cleaned;
    });
  }, [bulkDocumentDetail]);

  // Clear invalid parameter item selections when departments change in edit dialog
  useEffect(() => {
    if (documentDetail && documentDetail.parameter_item_ids) {
      const validSet = new Set(validParameterItemIdsForEdit);
      const filtered = documentDetail.parameter_item_ids.filter((id) =>
        validSet.has(id),
      );
      if (filtered.length !== documentDetail.parameter_item_ids.length) {
        setEditingDocument((prev: (typeof documents)[number] | null) =>
          prev ? { ...prev, parameter_item_ids: filtered } : null,
        );
      }
    }
  }, [documentDetail, validParameterItemIdsForEdit]);

  // Clear invalid parameter item selections when departments change in bulk edit dialog
  useEffect(() => {
    if (bulkParameterItemIds.length > 0) {
      const validSet = new Set(validParameterItemIdsForBulk);
      const filtered = bulkParameterItemIds.filter((id) => validSet.has(id));
      if (filtered.length !== bulkParameterItemIds.length) {
        setBulkParameterItemIds(filtered);
      }
    }
  }, [bulkParameterItemIds, validParameterItemIdsForBulk]);

  // Handle document preview (for table view)
  const handlePreview = useCallback((document: (typeof documents)[number]) => {
    setPreviewDocument(document);
    setShowPreviewDialog(true);
  }, []);

  // Define columns inline using useMemo
  const columns = useMemo<ColumnDef<(typeof documents)[number]>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const name = row.getValue("name") as string;
          return (
            <div className="flex items-center gap-3 max-w-[300px]">
              {/* Document preview */}
              <div
                className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => handlePreview(row.original)}
              >
                <div className="w-full h-full">
                  <DocumentViewer
                    document={{
                      document_id: row.original.document_id,
                      name: row.original.name,
                      type: row.original.type,
                      updatedAt: row.original.updated_at,
                      extension: row.original.extension || "",
                      scenario_ids: row.original.scenario_ids,
                      can_edit: row.original.can_edit,
                      can_delete: row.original.can_delete,
                      active: row.original.active,
                      department_ids: row.original.department_ids || [],
                      file_path: row.original.file_path || "",
                      mime_type: row.original.mime_type || "",
                      parameter_item_ids: row.original.parameter_item_ids,
                    }}
                    bare={true}
                    isFormDocument={false}
                    compact={true}
                  />
                </div>
              </div>
              {/* Document name */}
              <div className="flex-1 min-w-0">
                <span title={name} className="text-sm font-medium">
                  {truncateText(name, 25)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const type = row.getValue("type") as string;
          const typeInfo = typeOptions.find((option) => option.value === type);
          return (
            <Badge variant="outline" className="text-xs">
              {typeInfo?.label || type}
            </Badge>
          );
        },
        filterFn: (row, _id, value) => {
          return value.length === 0 || value.includes(row.getValue("type"));
        },
      },
      {
        accessorKey: "parameter_item_ids",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Parameter Items" />
        ),
        cell: ({ row }) => {
          const itemIds = row.getValue("parameter_item_ids") as string[];
          if (!itemIds.length) {
            return <span className="text-xs text-muted-foreground">None</span>;
          }
          return (
            <div className="max-w-[240px] flex flex-wrap gap-1">
              {itemIds.slice(0, 4).map((id) => {
                const item = parameterItemMapping[id];
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
    [scenarioMapping, parameterItemMapping, handlePreview],
  );

  // Permission checking using server-provided flags
  const canDeleteDocument = useCallback(
    (documentId: string) => {
      const doc = documents.find((d) => d.document_id === documentId);
      return doc?.can_delete ?? false;
    },
    [documents],
  );

  // Handle document selection (for bulk operations in list view only)
  const handleDocumentSelect = useCallback(
    (documentId: string, checked: boolean) => {
      if (checked) {
        setSelectedDocuments((prev) => [...prev, documentId]);
      } else {
        setSelectedDocuments((prev) => prev.filter((id) => id !== documentId));
      }
    },
    [],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedDocuments(documents.map((doc) => doc.document_id));
      } else {
        setSelectedDocuments([]);
      }
    },
    [documents],
  );

  // Handle document edit - fetch detail data on demand
  const handleEdit = useCallback(
    async (document: (typeof documents)[number]) => {
      setEditingDocument({ ...document });
      // Initialize previousDepartmentIdsEdit when opening edit dialog
      setPreviousDepartmentIdsEdit((prev) =>
        prev.length === 0 ? document.department_ids || [] : prev,
      );

      // Fetch document detail on demand
      if (getDocumentDetailAction && effectiveProfile?.id) {
        setIsLoadingDocumentDetail(true);
        try {
          const detail = await getDocumentDetailAction({
            body: {
              documentId: document.document_id,
              profileId: effectiveProfile.id,
            },
          });
          setDocumentDetail(detail);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load document details",
          );
          setDocumentDetail(null);
        } finally {
          setIsLoadingDocumentDetail(false);
        }
      }

      setShowEditDialog(true);
    },
    [getDocumentDetailAction, effectiveProfile?.id],
  );

  // Handle single document delete
  const handleSingleDelete = useCallback(
    (document: (typeof documents)[number]) => {
      setEditingDocument(document);
      setShowDeleteDialog(true);
    },
    [],
  );

  // Add checkbox and actions columns to the columns array
  const columnsWithActions = useMemo(() => {
    const checkboxColumn: ColumnDef<(typeof documents)[number]> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value);
            handleSelectAll(!!value);
          }}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedDocuments.includes(row.original.document_id)}
          onCheckedChange={(value) =>
            handleDocumentSelect(row.original.document_id, !!value)
          }
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    const actionsColumn: ColumnDef<(typeof documents)[number]> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const document = row.original;
        return (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => handlePreview(document)}
              aria-label={`Preview document ${document.name}`}
              data-testid="btn-preview-document"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => handleEdit(document)}
              aria-label={`Edit document ${document.name}`}
              data-testid="btn-edit-document"
            >
              <Edit className="h-3 w-3" />
            </Button>
            {canDeleteDocument(document.document_id) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => handleSingleDelete(document)}
                aria-label={`Delete document ${document.name}`}
                data-testid="btn-delete-document"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    // Filter out the existing select and actions columns and add our custom ones
    const filteredColumns = columns.filter(
      (col) => col.id !== "select" && col.id !== "actions",
    );
    return [checkboxColumn, ...filteredColumns, actionsColumn];
  }, [
    columns,
    selectedDocuments,
    handleDocumentSelect,
    handleSelectAll,
    handleEdit,
    handlePreview,
    handleSingleDelete,
    canDeleteDocument,
  ]);

  // Create table instance
  const table = useReactTable({
    data: documents,
    columns: columnsWithActions,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Switch page size based on view mode
  useEffect(() => {
    if (viewMode === "grid") {
      if (table.getState().pagination.pageSize !== 12) {
        table.setPageSize(12);
        table.setPageIndex(0);
      }
    } else {
      if (table.getState().pagination.pageSize !== 10) {
        table.setPageSize(10);
        table.setPageIndex(0);
      }
    }
  }, [viewMode, table]);

  // Handle bulk document delete (from list view selection)
  const handleBulkDelete = () => {
    if (selectedDocuments.length > 0) {
      setShowDeleteDialog(true);
    }
  };

  // Handle bulk edit - fetch detail data on demand
  const handleBulkEdit = async () => {
    if (selectedDocuments.length === 0) return;

    setBulkType("__keep__");
    setBulkParameterItemIds([]);
    setBulkDepartmentId(null);

    // Fetch bulk document detail on demand
    if (getDocumentDetailBulkAction && effectiveProfile?.id) {
      setIsLoadingBulkDetail(true);
      try {
        const detail = await getDocumentDetailBulkAction({
          body: {
            documentIds: selectedDocuments,
            profileId: effectiveProfile.id,
          },
        });
        setBulkDocumentDetail(detail);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load bulk document details",
        );
        setBulkDocumentDetail(null);
      } finally {
        setIsLoadingBulkDetail(false);
      }
    }

    setShowBulkEditDialog(true);
  };

  // Handle document delete
  const handleDelete = async () => {
    // Check if this is a single document delete or bulk delete
    const isSingleDelete = editingDocument && !selectedDocuments.length;

    if (isSingleDelete) {
      // Single document delete
      if (!editingDocument) return;

      if (!canDeleteDocument(editingDocument.document_id)) {
        toast.error(
          "This document cannot be deleted as it is used in active scenarios",
        );
        setShowDeleteDialog(false);
        setEditingDocument(null);
        return;
      }

      setIsDeleting(true);
      try {
        if (!deleteDocumentAction) return;
        await deleteDocumentAction({
          body: { documentId: editingDocument.document_id },
        });
        router.refresh();
        toast.success("Document deleted successfully");
        setShowDeleteDialog(false);
        setEditingDocument(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete document",
        );
      } finally {
        setIsDeleting(false);
      }
    } else {
      // Bulk delete
      if (!selectedDocuments.length) return;

      // Filter to only deletable documents
      const deletableDocuments = selectedDocuments.filter((documentId) =>
        canDeleteDocument(documentId),
      );

      if (deletableDocuments.length === 0) {
        toast.error("No documents can be deleted");
        setShowDeleteDialog(false);
        return;
      }

      setIsDeleting(true);
      try {
        if (!bulkDeleteDocumentsAction) return;
        // Use bulk delete for efficiency
        await bulkDeleteDocumentsAction({
          body: { documentIds: deletableDocuments },
        });
        router.refresh();

        const nonDeletableCount =
          selectedDocuments.length - deletableDocuments.length;
        const message =
          nonDeletableCount > 0
            ? `${deletableDocuments.length} of ${selectedDocuments.length} document(s) deleted successfully. ${nonDeletableCount} document(s) could not be deleted as they are used in active scenarios.`
            : `${deletableDocuments.length} document(s) deleted successfully`;

        toast.success(message);
        setSelectedDocuments([]);
        setShowDeleteDialog(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete documents",
        );
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Handle document update
  const handleUpdate = async () => {
    if (!editingDocument || !documentDetail) return;

    setIsUpdating(true);
    try {
      if (!updateDocumentAction) return;
      await updateDocumentAction({
        body: {
          documentId: editingDocument.document_id,
          type: editingDocument.type,
          department_id: editingDocument.department_ids?.[0] ?? null,
          parameter_item_ids: editingDocument.parameter_item_ids || [],
        },
      });
      router.refresh();
      toast.success("Document updated successfully");
      setShowEditDialog(false);
      setEditingDocument(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update document",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Execute bulk update
  const handleBulkUpdate = async () => {
    if (selectedDocuments.length === 0 || !bulkDocumentDetail) return;
    setIsBulkUpdating(true);
    try {
      const type =
        bulkType !== "__keep__"
          ? bulkType
          : bulkDocumentDetail.type || "homework";
      const parameter_item_ids =
        bulkParameterItemIds.length > 0
          ? bulkParameterItemIds
          : bulkDocumentDetail.parameter_item_ids;
      const department_id: string | null = bulkDepartmentId
        ? bulkDepartmentId
        : bulkDocumentDetail.department_ids &&
            bulkDocumentDetail.department_ids.length > 0 &&
            bulkDocumentDetail.department_ids[0]
          ? bulkDocumentDetail.department_ids[0]
          : null;

      if (!bulkUpdateDocumentsAction) return;
      await bulkUpdateDocumentsAction({
        body: {
          documentIds: selectedDocuments,
          type,
          department_id,
          parameter_item_ids,
        },
      });
      router.refresh();

      toast.success("Documents updated successfully");
      setShowBulkEditDialog(false);
      setSelectedDocuments([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update documents",
      );
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Render document card for grid view
  const renderDocumentCard = (document: (typeof documents)[number]) => {
    const canDelete = canDeleteDocument(document.document_id);

    // Map API response to DocumentItem format with proper defaults
    const documentItem = {
      document_id: document.document_id,
      name: document.name,
      type: document.type,
      updatedAt: document.updated_at,
      extension: document.extension || "",
      scenario_ids: document.scenario_ids || [],
      can_edit: document.can_edit,
      can_delete: document.can_delete,
      active: document.active,
      department_ids: document.department_ids ?? null,
      file_path: document.file_path || "",
      mime_type: document.mime_type || "",
      parameter_item_ids: document.parameter_item_ids || [],
    };

    // Wrapper functions to convert DocumentItem back to API format for callbacks
    // Since we already have the document in closure, we use it directly instead of the parameter
    const handleEditWrapper = (_doc: typeof documentItem) => {
      handleEdit(document);
    };

    const handlePreviewWrapper = (_doc: typeof documentItem) => {
      handlePreview(document);
    };

    const handleDeleteWrapper = (_doc: typeof documentItem) => {
      handleSingleDelete(document);
    };

    return (
      <DocumentPreviewCard
        key={document.document_id}
        document={documentItem}
        onEdit={handleEditWrapper}
        onPreview={handlePreviewWrapper}
        onDelete={handleDeleteWrapper}
        canDelete={canDelete}
        showActions={true}
      />
    );
  };

  return (
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
                    (table.getColumn("name")?.getFilterValue() as string) ?? ""
                  }
                  onChange={(event) =>
                    table.getColumn("name")?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search documents by name"
                  aria-controls="documents-list"
                />
              </div>
              {table.getColumn("type") && (
                <DataTableFacetedFilter
                  column={table.getColumn("type")!}
                  title="Type"
                  options={typeOptions}
                />
              )}
              {table.getColumn("scenario_ids") && (
                <DataTableFacetedFilter
                  column={table.getColumn("scenario_ids")!}
                  title="Scenarios"
                  options={scenarioOptions}
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
            <div className="flex items-center space-x-2">
              {/* Bulk edit & delete - only show in list view where selection is available */}
              {viewMode === "list" && selectedDocuments.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkEdit}
                    className="h-8"
                    data-testid="btn-bulk-edit"
                    aria-label={`Edit ${selectedDocuments.length} documents`}
                  >
                    <Grid3X3 className="mr-2 h-4 w-4" />
                    Edit {selectedDocuments.length}
                  </Button>
                  {selectedDocuments.filter((documentId) =>
                    canDeleteDocument(documentId),
                  ).length === 0 ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8"
                            disabled={true}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete 0 of {selectedDocuments.length}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>All documents are currently in use</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="h-8"
                      data-testid="btn-bulk-delete"
                      aria-label={`Delete ${selectedDocuments.filter((documentId) =>
                        canDeleteDocument(documentId),
                      ).length} of ${selectedDocuments.length} documents`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete{" "}
                      {
                        selectedDocuments.filter((documentId) =>
                          canDeleteDocument(documentId),
                        ).length
                      }{" "}
                      of {selectedDocuments.length}
                    </Button>
                  )}
                </>
              )}

              {/* View mode toggle - hidden on mobile */}
              {!isMobile && (
                <div className="flex items-center space-x-1 border rounded-md">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 px-3"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 px-3"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {!isMobile && <DataTableViewOptions table={table} />}
            </div>
          </div>

          {/* Content based on view mode */}
          {viewMode === "list" ? (
            <div className="space-y-4">
              <div className="rounded-md border" data-testid="documents-list">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          return (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columnsWithActions.length}
                          className="h-24 text-center"
                        >
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination table={table} />
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                role="grid"
                aria-label="documents grid"
                data-testid="documents-grid"
              >
                {table.getRowModel().rows.length > 0 ? (
                  table
                    .getRowModel()
                    .rows.map((row) => renderDocumentCard(row.original))
                ) : (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No documents match the current filters.
                  </div>
                )}
              </div>
              <DataTablePagination table={table} card={true} />
            </div>
          )}
        </div>
      )}

      {/* Edit Document Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent
          className="sm:max-w-md"
          data-testid="dialog-edit-document"
          aria-labelledby="edit-document-title"
        >
          <DialogHeader>
            <DialogTitle id="edit-document-title">Edit Document</DialogTitle>
            <DialogDescription>
              Update document properties. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          {editingDocument &&
            (isLoadingDocumentDetail ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">
                  Loading document details...
                </div>
              </div>
            ) : documentDetail ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editingDocument.name}
                    onChange={(e) =>
                      setEditingDocument(
                        (prev: (typeof documents)[number] | null) =>
                          prev ? { ...prev, name: e.target.value } : null,
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="active">Document Active</Label>
                  <Switch
                    id="active"
                    checked={editingDocument.active}
                    onCheckedChange={(checked) =>
                      setEditingDocument((prev) =>
                        prev ? { ...prev, active: checked } : null,
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={editingDocument.type}
                    onValueChange={(value) => {
                      // Update in temporary state for submission
                      setEditingDocument(
                        (prev: (typeof documents)[number] | null) =>
                          prev
                            ? { ...prev, type: value as DocumentType }
                            : null,
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentDetail.document_type_options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {typeOptions.find((o) => o.value === option)?.label ||
                            option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department Selection */}
                <div className="flex flex-col gap-2">
                  <Label>Department</Label>
                  <DepartmentPicker
                    mapping={documentDetail.department_mapping}
                    validIds={documentDetail.valid_department_ids}
                    selectedIds={editingDocument.department_ids || []}
                    onSelect={(ids) =>
                      setEditingDocument(
                        (prev: (typeof documents)[number] | null) =>
                          prev ? { ...prev, department_ids: ids } : null,
                      )
                    }
                    multiSelect={true}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Parameter Items</Label>
                  <ParameterItemPicker
                    mapping={documentDetail["parameter_item_mapping"]}
                    selectedIds={editingDocument?.parameter_item_ids || []}
                    onSelect={(ids) =>
                      setEditingDocument(
                        (prev: (typeof documents)[number] | null) =>
                          prev
                            ? { ...prev, parameter_item_ids: ids as string[] }
                            : null,
                      )
                    }
                    {...(createParameterItemAction && {
                      createParameterItemAction,
                    })}
                    validIds={validParameterItemIdsForEdit}
                    parameterId=""
                    parameterName="Parameter Items"
                    allowCreate={false}
                    multiSelect={true}
                    badgesPosition="below"
                    showClearAll={true}
                  />
                </div>
              </div>
            ) : null)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent
          className="sm:max-w-md"
          data-testid="dialog-bulk-edit-document"
          aria-labelledby="bulk-edit-document-title"
        >
          <DialogHeader>
            <DialogTitle id="bulk-edit-document-title">
              Edit {selectedDocuments.length} document
              {selectedDocuments.length > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Choose the fields to update. Leave a field as-is if you do not
              want to change it for all selected documents.
            </DialogDescription>
          </DialogHeader>
          {isLoadingBulkDetail ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                Loading document details...
              </div>
            </div>
          ) : bulkDocumentDetail ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select
                  defaultValue={bulkDocumentDetail.type || "__keep__"}
                  onValueChange={(value) =>
                    setBulkType(value as DocumentType | "__keep__")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Keep existing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep__">Keep existing</SelectItem>
                    {bulkDocumentDetail.document_type_options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {typeOptions.find((o) => o.value === option)?.label ||
                          option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department Selection */}
              <div className="flex flex-col gap-2">
                <Label>Department</Label>
                <DepartmentPicker
                  mapping={bulkDocumentDetail.department_mapping}
                  validIds={bulkDocumentDetail.valid_department_ids}
                  selectedIds={
                    bulkDepartmentId
                      ? [bulkDepartmentId]
                      : bulkDocumentDetail.department_ids || []
                  }
                  onSelect={(ids) => setBulkDepartmentId(ids[0] || null)}
                  multiSelect={false}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Parameter Items</Label>
                <ParameterItemPicker
                  mapping={bulkDocumentDetail.parameter_item_mapping}
                  selectedIds={bulkParameterItemIds}
                  validIds={validParameterItemIdsForBulk}
                  onSelect={setBulkParameterItemIds}
                  parameterId=""
                  parameterName="Parameter Items"
                  allowCreate={false}
                  multiSelect={true}
                  badgesPosition="below"
                  showClearAll={true}
                  {...(createParameterItemAction && {
                    createParameterItemAction,
                  })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkEditDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkUpdate} disabled={isBulkUpdating}>
              {isBulkUpdating ? "Updating..." : "Apply Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          data-testid="dialog-delete-document"
          aria-labelledby="delete-document-title"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-document-title">
              {editingDocument && !selectedDocuments.length
                ? "Delete Document"
                : `Delete Document${selectedDocuments.length > 1 ? "s" : ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingDocument && !selectedDocuments.length ? (
                // Single document delete
                <>
                  Are you sure you want to delete "{editingDocument.name}"?
                  <br />
                  <br />
                  <span className="text-sm text-muted-foreground">
                    This action cannot be undone.
                  </span>
                </>
              ) : (
                // Bulk delete
                <div className="space-y-4">
                  <p>
                    You have selected {selectedDocuments.length} document
                    {selectedDocuments.length > 1 ? "s" : ""}.
                  </p>

                  {(() => {
                    const deletableDocuments = selectedDocuments.filter(
                      (documentId) => canDeleteDocument(documentId),
                    );
                    const nonDeletableDocuments = selectedDocuments.filter(
                      (documentId) => !canDeleteDocument(documentId),
                    );

                    return (
                      <div className="space-y-3">
                        {deletableDocuments.length > 0 && (
                          <div>
                            <p className="font-medium text-green-700 dark:text-green-400">
                              Documents that can be deleted (
                              {deletableDocuments.length}):
                            </p>
                            <div className="mt-1 ml-4 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                              <ul className="text-sm space-y-1">
                                {deletableDocuments.map((documentId) => {
                                  const doc = documents.find(
                                    (d) => d.document_id === documentId,
                                  );
                                  return (
                                    <li
                                      key={documentId}
                                      className="text-green-600 dark:text-green-300"
                                    >
                                      • {doc?.name}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        )}

                        {nonDeletableDocuments.length > 0 && (
                          <div>
                            <p className="font-medium text-red-700 dark:text-red-400">
                              Documents that cannot be deleted (
                              {nonDeletableDocuments.length}):
                            </p>
                            <div className="mt-1 ml-4 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                              <ul className="text-sm space-y-1">
                                {nonDeletableDocuments.map((documentId) => {
                                  const doc = documents.find(
                                    (d) => d.document_id === documentId,
                                  );
                                  return (
                                    <li
                                      key={documentId}
                                      className="text-red-600 dark:text-red-300"
                                    >
                                      • {doc?.name} (cannot delete)
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        )}

                        {deletableDocuments.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Would you like to delete the{" "}
                            {deletableDocuments.length} document
                            {deletableDocuments.length > 1 ? "s" : ""} that can
                            be deleted?
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone.
                  </p>
                </div>
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
                (editingDocument && !selectedDocuments.length
                  ? !canDeleteDocument(editingDocument.document_id)
                  : selectedDocuments.filter((documentId) =>
                      canDeleteDocument(documentId),
                    ).length === 0)
              }
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-delete"
            >
              {isDeleting
                ? "Deleting..."
                : editingDocument && !selectedDocuments.length
                  ? "Delete Document"
                  : `Delete ${selectedDocuments.filter((documentId) => canDeleteDocument(documentId)).length} of ${selectedDocuments.length}`}
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
                  type: previewDocument.type,
                  updatedAt: previewDocument.updated_at,
                  extension: previewDocument.extension || "",
                  scenario_ids: previewDocument.scenario_ids,
                  can_edit: previewDocument.can_edit,
                  can_delete: previewDocument.can_delete,
                  active: previewDocument.active,
                  department_ids: previewDocument.department_ids || [],
                  file_path: previewDocument.file_path || "",
                  mime_type: previewDocument.mime_type || "",
                  parameter_item_ids: previewDocument.parameter_item_ids,
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

      {/* Upload Document Dialog */}
      {uploadDialogOpen && (
        <DocumentUploadDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          departmentMapping={departmentMapping}
          validDepartmentIds={validDepartmentIds}
          parameterItemMapping={parameterItemMapping}
          parameterMapping={parameterMapping}
          validParameterItemIds={Object.keys(parameterItemMapping)}
          {...(finalizeDocumentUploadAction && {
            finalizeDocumentUploadAction,
          })}
        />
      )}
    </div>
  );
}
