/**
 * Documents.tsx
 * Documents component, used to view and manage documents with enhanced filtering and CRUD operations.
 * @AshokSaravanan222 & @siladiea
 * 07/25/2025
 */

"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useLogger } from "@/lib/api/v2/hooks/logs";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { DocumentPreviewCard } from "@/components/common/documents/DocumentPreviewCard";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentType } from "@/lib/api/v2/schemas/base";
import { UploadCloud } from "lucide-react";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import ParameterItemPicker from "@/components/common/scenario/ParameterItemPicker";
import { useProfile } from "@/contexts/profile-context";
import {
  useBulkDeleteDocuments,
  useBulkUpdateDocuments,
  useDeleteDocument,
  useDocumentDetail,
  useDocumentDetailBulk,
  useDocumentsList,
  useUpdateDocument,
} from "@/lib/api/v2/hooks/documents";
import type { DocumentItem } from "@/lib/api/v2/schemas/documents";
import { DocumentsDataTable } from "./DocumentsDataTable";
import { DocumentUploadDialog } from "./DocumentUploadDialog";

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export default function Documents() {
  const { effectiveProfile, effectiveDepartmentIds } = useProfile();
  const log = useLogger();

  // Mutation hooks
  const deleteDocumentMutation = useDeleteDocument();
  const bulkDeleteDocumentsMutation = useBulkDeleteDocuments();
  const updateDocumentMutation = useUpdateDocument();
  const bulkUpdateDocumentsMutation = useBulkUpdateDocuments();

  // State management
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(
    null
  );
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkType, setBulkType] = useState<DocumentType | "__keep__">(
    "__keep__"
  );
  const [bulkParameterItemIds, setBulkParameterItemIds] = useState<string[]>(
    []
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

  // V2 API: Build filters
  const filters = useMemo(
    () => ({
      profileId: effectiveProfile?.id || "",
    }),
    [effectiveProfile?.id]
  );

  // V2 API: Fetch documents list
  const { data: documentsData, isLoading } = useDocumentsList(filters);

  // Extract data from V2 response
  const documents = useMemo(
    () => documentsData?.documents || [],
    [documentsData]
  );
  const scenarioMapping = useMemo(
    () => documentsData?.scenario_mapping || {},
    [documentsData]
  );
  const parameterItemMapping = useMemo(
    () => documentsData?.parameter_item_mapping || {},
    [documentsData]
  );
  const parameterMapping = useMemo(
    () => documentsData?.parameter_mapping || {},
    [documentsData]
  );
  const departmentMapping = useMemo(
    () => documentsData?.department_mapping || {},
    [documentsData]
  );

  // Compute valid department IDs for upload dialog
  const validDepartmentIds = useMemo(
    () => effectiveDepartmentIds,
    [effectiveDepartmentIds]
  );

  // V2 API: Fetch single document detail for editing
  const { data: documentDetail } = useDocumentDetail(
    editingDocument?.document_id || "",
    effectiveProfile?.id || "",
    !!editingDocument && !!effectiveProfile?.id
  );

  // V2 API: Fetch bulk document detail for bulk editing
  const { data: bulkDocumentDetail } = useDocumentDetailBulk(
    selectedDocuments,
    effectiveProfile?.id || "",
    showBulkEditDialog && selectedDocuments.length > 0 && !!effectiveProfile?.id
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
      currentDeptIds.every((id, idx) => id === prevDeptIds[idx])
    ) {
      // Initialize on first load
      if (prevDeptIds.length === 0 && currentDeptIds.length > 0) {
        setPreviousDepartmentIdsEdit(currentDeptIds);
      }
      return;
    }

    // Find departments that were deselected
    const deselectedDepts = prevDeptIds.filter(
      (id) => !currentDeptIds.includes(id)
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id)
    );

    // Save selections for deselected departments
    if (deselectedDepts.length > 0) {
      const currentParamIds = editingDocument.parameter_item_ids || [];
      setStagedSelectionsEdit((prev) => {
        const updated = { ...prev };
        deselectedDepts.forEach((deptId) => {
          updated[deptId] = {
            parameter_item_ids: [...currentParamIds],
          };
        });
        return updated;
      });
    }

    // Restore selections for newly selected departments
    if (newlySelectedDepts.length > 0) {
      setStagedSelectionsEdit((prev) => {
        newlySelectedDepts.forEach((deptId) => {
          const staged = prev[deptId];
          if (
            staged?.parameter_item_ids &&
            staged.parameter_item_ids.length > 0
          ) {
            const validParamSet = new Set(validParameterItemIdsForEdit);
            const validParams = staged.parameter_item_ids.filter((id) =>
              validParamSet.has(id)
            );
            if (validParams.length > 0) {
              setEditingDocument((prevDoc) => {
                if (!prevDoc) return null;
                const combined = new Set([
                  ...(prevDoc.parameter_item_ids || []),
                  ...validParams,
                ]);
                return {
                  ...prevDoc,
                  parameter_item_ids: Array.from(combined),
                };
              });
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
      setStagedSelectionsBulk((prev) => {
        const updated = { ...prev };
        updated[prevDeptId] = {
          parameter_item_ids: [...bulkParameterItemIds],
        };
        return updated;
      });
    }

    // Restore selections for newly selected department
    if (currentDeptId !== null && currentDeptId !== prevDeptId) {
      setStagedSelectionsBulk((prev) => {
        const staged = prev[currentDeptId];
        if (
          staged?.parameter_item_ids &&
          staged.parameter_item_ids.length > 0
        ) {
          const validParamSet = new Set(validParameterItemIdsForBulk);
          const validParams = staged.parameter_item_ids.filter((id) =>
            validParamSet.has(id)
          );
          if (validParams.length > 0) {
            setBulkParameterItemIds((prevParams) => {
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
    setStagedSelectionsBulk((prev) => {
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
        validSet.has(id)
      );
      if (filtered.length !== documentDetail.parameter_item_ids.length) {
        setEditingDocument((prev) =>
          prev ? { ...prev, parameter_item_ids: filtered } : null
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

  // Filter options
  const typeOptions = useMemo(
    () => [
      { value: "homework", label: "📚 Homework" },
      { value: "project", label: "🎯 Project" },
      { value: "quiz", label: "❓ Quiz" },
      { value: "midterm", label: "📝 Midterm" },
      { value: "lab", label: "🧪 Lab" },
      { value: "lecture", label: "📖 Lecture" },
      { value: "syllabus", label: "📋 Syllabus" },
    ],
    []
  );

  const scenarioOptions = useMemo(
    () =>
      Object.entries(scenarioMapping).map(([id, item]) => ({
        value: id,
        label: item.name,
      })),
    [scenarioMapping]
  );

  // Build department options from mapping
  const documentsDepartmentMapping = useMemo(
    () =>
      (documentsData?.department_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [documentsData?.department_mapping]
  );

  const departmentOptions = useMemo(() => {
    return Object.entries(documentsDepartmentMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [documentsDepartmentMapping]);

  const extensionOptions = useMemo(() => {
    const extensions = new Set(documents.map((d) => d.extension));
    return Array.from(extensions).map((ext) => ({
      value: ext,
      label: ext.toUpperCase(),
    }));
  }, [documents]);

  // Handle document preview (for table view)
  const handlePreview = useCallback((document: DocumentItem) => {
    setPreviewDocument(document);
    setShowPreviewDialog(true);
  }, []);

  // Define columns inline using useMemo
  const columns = useMemo<ColumnDef<DocumentItem>[]>(
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
                      updatedAt: row.original.updatedAt,
                      extension: row.original.extension,
                      scenario_ids: row.original.scenario_ids,
                      can_edit: row.original.can_edit,
                      can_delete: row.original.can_delete,
                      active: row.original.active,
                      department_ids: row.original.department_ids,
                      file_path: row.original.file_path,
                      mime_type: row.original.mime_type,
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
                const name = scenarioMapping[id]?.name || id;
                return (
                  <Badge key={id} variant="outline" className="text-xs">
                    {truncateText(name, 15)}
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
        accessorFn: (row: DocumentItem) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "extension",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Extension" />
        ),
        cell: ({ row }) => {
          const extension = row.getValue("extension") as string;
          return (
            <Badge variant="secondary" className="text-xs">
              {extension.toUpperCase()}
            </Badge>
          );
        },
        filterFn: (row, _id, value) => {
          return (
            value.length === 0 || value.includes(row.getValue("extension"))
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Updated" />
        ),
        cell: ({ row }) => {
          const date = new Date(row.getValue("updatedAt"));
          const active = row.original.active;
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
    [scenarioMapping, parameterItemMapping, typeOptions, handlePreview]
  );

  // Permission checking using server-provided flags
  const canDeleteDocument = useCallback(
    (documentId: string) => {
      const doc = documents.find((d) => d.document_id === documentId);
      return doc?.can_delete ?? false;
    },
    [documents]
  );

  // Handle document selection (for bulk operations in list view only)
  const handleDocumentSelect = (documentId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments((prev) => [...prev, documentId]);
    } else {
      setSelectedDocuments((prev) => prev.filter((id) => id !== documentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(documents.map((doc) => doc.document_id));
    } else {
      setSelectedDocuments([]);
    }
  };

  // Handle document edit
  const handleEdit = (document: DocumentItem) => {
    setEditingDocument({ ...document });
    // Initialize previousDepartmentIdsEdit when opening edit dialog
    setPreviousDepartmentIdsEdit((prev) =>
      prev.length === 0 ? document.department_ids || [] : prev
    );
    setShowEditDialog(true);
  };

  // Handle single document delete
  const handleSingleDelete = (document: DocumentItem) => {
    setEditingDocument(document);
    setShowDeleteDialog(true);
  };

  // Handle bulk document delete (from list view selection)
  const handleBulkDelete = () => {
    if (selectedDocuments.length > 0) {
      setShowDeleteDialog(true);
    }
  };

  // Handle bulk edit
  const handleBulkEdit = () => {
    if (selectedDocuments.length > 0) {
      setBulkType("__keep__");
      setBulkParameterItemIds([]);
      setBulkDepartmentId(null);
      setShowBulkEditDialog(true);
    }
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
          "This document cannot be deleted as it is used in active scenarios"
        );
        setShowDeleteDialog(false);
        setEditingDocument(null);
        return;
      }

      setIsDeleting(true);
      try {
        await deleteDocumentMutation.mutateAsync({
          documentId: editingDocument.document_id,
        });
        await log.info("document.delete.success", {
          message: "Document deleted",
          subject: {
            entityType: "document",
            entityId: editingDocument.document_id,
          },
          context: { component: "Documents", function: "handleDelete" },
        });
        toast.success("Document deleted successfully");
        setShowDeleteDialog(false);
        setEditingDocument(null);
      } catch (error) {
        await log.error("document.delete.failed", {
          message: "Error deleting document",
          subject: {
            entityType: "document",
            entityId: editingDocument.document_id,
          },
          context: { component: "Documents", function: "handleDelete" },
          error,
        });
        toast.error("Failed to delete document");
      } finally {
        setIsDeleting(false);
      }
    } else {
      // Bulk delete
      if (!selectedDocuments.length) return;

      // Filter to only deletable documents
      const deletableDocuments = selectedDocuments.filter((documentId) =>
        canDeleteDocument(documentId)
      );

      if (deletableDocuments.length === 0) {
        toast.error("No documents can be deleted");
        setShowDeleteDialog(false);
        return;
      }

      setIsDeleting(true);
      try {
        // Use bulk delete for efficiency
        await bulkDeleteDocumentsMutation.mutateAsync({
          documentIds: deletableDocuments,
        });

        // Log success for each document
        for (const documentId of deletableDocuments) {
          await log.info("document.delete.success", {
            message: "Document deleted",
            subject: { entityType: "document", entityId: documentId },
            context: { component: "Documents", function: "handleDelete.bulk" },
          });
        }

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
        await log.error("document.delete_many.failed", {
          message: "Error deleting documents",
          subject: { entityType: "document" },
          context: { component: "Documents", function: "handleDelete.bulk" },
          error,
        });
        toast.error("Failed to delete documents");
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
      await updateDocumentMutation.mutateAsync({
        documentId: editingDocument.document_id,
        type: documentDetail.type,
        department_ids: documentDetail.department_ids,
        parameter_item_ids: documentDetail.parameter_item_ids,
      });

      toast.success("Document updated successfully");
      setShowEditDialog(false);
      setEditingDocument(null);
    } catch (error) {
      await log.error("document.update.failed", {
        message: "Error updating document",
        subject: {
          entityType: "document",
          entityId: editingDocument.document_id,
        },
        context: { component: "Documents", function: "handleUpdate" },
        error,
      });
      toast.error("Failed to update document");
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
      const department_ids = bulkDepartmentId
        ? [bulkDepartmentId]
        : bulkDocumentDetail.department_ids || null;

      await bulkUpdateDocumentsMutation.mutateAsync({
        documentIds: selectedDocuments,
        type,
        department_ids,
        parameter_item_ids,
      });

      toast.success("Documents updated successfully");
      setShowBulkEditDialog(false);
      setSelectedDocuments([]);
    } catch (error) {
      await log.error("document.update_many.failed", {
        message: "Error bulk updating documents",
        subject: { entityType: "document" },
        context: {
          component: "Documents",
          function: "handleBulkUpdate",
          count: selectedDocuments.length,
        },
        error,
      });
      toast.error("Failed to update documents");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Render document card for grid view
  const renderDocumentCard = (document: DocumentItem) => {
    const canDelete = canDeleteDocument(document.document_id);

    return (
      <DocumentPreviewCard
        key={document.document_id}
        document={document}
        onEdit={handleEdit}
        onPreview={handlePreview}
        onDelete={handleSingleDelete}
        canDelete={canDelete}
        showActions={true}
      />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

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
        <DocumentsDataTable
          columns={columns}
          data={documents}
          scenarioMapping={scenarioMapping}
          parameterItemMapping={parameterItemMapping}
          typeOptions={typeOptions}
          scenarioOptions={scenarioOptions}
          extensionOptions={extensionOptions}
          departmentOptions={departmentOptions}
          renderDocumentCard={renderDocumentCard}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onEdit={handleEdit}
          onPreview={handlePreview}
          onDelete={handleSingleDelete}
          canDelete={canDeleteDocument}
          selectedDocuments={selectedDocuments}
          onDocumentSelect={handleDocumentSelect}
          onSelectAll={handleSelectAll}
          onBulkDelete={handleBulkDelete}
          onBulkEdit={handleBulkEdit}
        />
      )}

      {/* Edit Document Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document properties. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          {editingDocument && documentDetail && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editingDocument.name}
                  onChange={(e) =>
                    setEditingDocument((prev) =>
                      prev ? { ...prev, name: e.target.value } : null
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
                      prev ? { ...prev, active: checked } : null
                    )
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  defaultValue={documentDetail.type}
                  onValueChange={(value) => {
                    // Update in temporary state for submission
                    setEditingDocument((prev) =>
                      prev ? { ...prev, type: value as DocumentType } : null
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
                  selectedIds={documentDetail.department_ids || []}
                  onSelect={(ids) =>
                    setEditingDocument((prev) =>
                      prev ? { ...prev, department_ids: ids } : null
                    )
                  }
                  multiSelect={true}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Parameter Items</Label>
                <ParameterItemPicker
                  mapping={documentDetail["parameter_item_mapping"]}
                  selectedIds={documentDetail.parameter_item_ids}
                  onSelect={(ids) =>
                    setEditingDocument((prev) =>
                      prev
                        ? { ...prev, parameter_item_ids: ids as string[] }
                        : null
                    )
                  }
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating || updateDocumentMutation.isPending}
            >
              {isUpdating || updateDocumentMutation.isPending
                ? "Updating..."
                : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedDocuments.length} document
              {selectedDocuments.length > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Choose the fields to update. Leave a field as-is if you do not
              want to change it for all selected documents.
            </DialogDescription>
          </DialogHeader>
          {bulkDocumentDetail && (
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
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkEditDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={isBulkUpdating || updateDocumentMutation.isPending}
            >
              {isBulkUpdating || updateDocumentMutation.isPending
                ? "Updating..."
                : "Apply Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
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
                      (documentId) => canDeleteDocument(documentId)
                    );
                    const nonDeletableDocuments = selectedDocuments.filter(
                      (documentId) => !canDeleteDocument(documentId)
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
                                    (d) => d.document_id === documentId
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
                                    (d) => d.document_id === documentId
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
              disabled={isDeleting || deleteDocumentMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                isDeleting ||
                deleteDocumentMutation.isPending ||
                (editingDocument && !selectedDocuments.length
                  ? !canDeleteDocument(editingDocument.document_id)
                  : selectedDocuments.filter((documentId) =>
                      canDeleteDocument(documentId)
                    ).length === 0)
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting || deleteDocumentMutation.isPending
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
                  updatedAt: previewDocument.updatedAt,
                  extension: previewDocument.extension,
                  scenario_ids: previewDocument.scenario_ids,
                  can_edit: previewDocument.can_edit,
                  can_delete: previewDocument.can_delete,
                  active: previewDocument.active,
                  department_ids: previewDocument.department_ids,
                  file_path: previewDocument.file_path,
                  mime_type: previewDocument.mime_type,
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
        />
      )}
    </div>
  );
}
