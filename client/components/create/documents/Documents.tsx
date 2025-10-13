/**
 * Documents.tsx
 * Documents component, used to view and manage documents with enhanced filtering and CRUD operations.
 * @AshokSaravanan222 & @siladiea
 * 07/25/2025
 */

"use client";
import { useCallback, useState } from "react";
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

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { DocumentPreviewCard } from "@/components/common/documents/DocumentPreviewCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Document as DocumentObject, DocumentType } from "@/types";
import { documents as documentsTable } from "@/utils/drizzle/schema";
import { UploadCloud } from "lucide-react";

import { DepartmentSelector } from "@/components/common/forms/DepartmentSelector";
import TagSelector from "@/components/common/tags/TagSelector";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { useDocumentColumns } from "@/hooks/use-document-columns";
import { useDepartments as useDepartmentsHook } from "@/lib/api/v1/hooks/departments";
import {
  useDeleteDocument,
  useDeleteDocuments,
  useDocumentsByDepartmentIdBatch,
  useUpdateDocument,
  useUpdateDocuments,
} from "@/lib/api/v1/hooks/documents";
import { useScenariosByDepartmentIdBatch } from "@/lib/api/v1/hooks/scenarios";
import { log } from "@/utils/logger";
import { DocumentsDataTable } from "./DocumentsDataTable";

export default function Documents() {
  const { effectiveProfile } = useProfile();

  // Mutation hooks
  const deleteDocumentMutation = useDeleteDocument();
  const deleteDocumentsMutation = useDeleteDocuments();
  const updateDocumentMutation = useUpdateDocument();
  const updateDocumentsMutation = useUpdateDocuments();

  // State management
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentObject | null>(
    null
  );
  const [previewDocument, setPreviewDocument] = useState<DocumentObject | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkType, setBulkType] = useState<DocumentType | "__keep__">(
    "__keep__"
  );
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkDepartmentId, setBulkDepartmentId] = useState<string | null>(null);
  const { effectiveDepartmentIds } = useDepartments();

  const { data: documents = [], isLoading: isLoadingDocuments } =
    useDocumentsByDepartmentIdBatch(effectiveDepartmentIds);
  const { data: scenarios = [], isLoading: isLoadingScenarios } =
    useScenariosByDepartmentIdBatch(effectiveDepartmentIds);
  const { data: departments = [] } = useDepartmentsHook();

  // Check if document can be deleted (not used by active scenarios)
  const canDeleteDocument = useCallback(
    (documentId: string) => {
      const activeScenarios = scenarios.filter((scenario) => scenario.active);
      return !activeScenarios.some((scenario) =>
        scenario.documentIds?.includes(documentId)
      );
    },
    [scenarios]
  );

  // Get scenarios that use this document
  const getScenariosUsingDocument = useCallback(
    (documentId: string) => {
      return scenarios.filter((scenario) =>
        scenario.documentIds?.includes(documentId)
      );
    },
    [scenarios]
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
      setSelectedDocuments(documents.map((doc) => doc.id));
    } else {
      setSelectedDocuments([]);
    }
  };

  // Handle document edit
  const handleEdit = (document: DocumentObject) => {
    setEditingDocument({ ...document });
    setShowEditDialog(true);
  };

  // Handle document preview (for table view)
  const handlePreview = (document: DocumentObject) => {
    setPreviewDocument(document);
    setShowPreviewDialog(true);
  };

  // Get table columns and filter options
  const { columns, typeOptions, scenarioOptions, extensionOptions } =
    useDocumentColumns(handlePreview);

  // Handle single document delete
  const handleSingleDelete = (document: DocumentObject) => {
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
      // Pre-populate with intersection of tags across selected documents
      const selectedDocs = documents.filter((doc) =>
        selectedDocuments.includes(doc.id)
      );
      if (selectedDocs.length > 0) {
        // Note: Document tags removed - tags are now managed via simulation_tags → simulation_tag_documents
        // Documents don't have a direct tags property anymore
        setBulkTags([]);
      } else {
        setBulkTags([]);
      }
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

      if (!canDeleteDocument(editingDocument.id)) {
        toast.error(
          "This document cannot be deleted as it is used in active scenarios"
        );
        setShowDeleteDialog(false);
        setEditingDocument(null);
        return;
      }

      setIsDeleting(true);
      try {
        await deleteDocumentMutation.mutateAsync(editingDocument.id);
        await log.info("document.delete.success", {
          message: "Document deleted",
          subject: { entityType: "document", entityId: editingDocument.id },
          context: { component: "Documents", function: "handleDelete" },
        });
        toast.success("Document deleted successfully");
        setShowDeleteDialog(false);
        setEditingDocument(null);
      } catch (error) {
        await log.error("document.delete.failed", {
          message: "Error deleting document",
          subject: { entityType: "document", entityId: editingDocument.id },
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
        await deleteDocumentsMutation.mutateAsync({ ids: deletableDocuments });

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
    if (!editingDocument) return;

    setIsUpdating(true);
    try {
      await updateDocumentMutation.mutateAsync({
        id: editingDocument.id,
        name: editingDocument.name,
        type: editingDocument.type,
        // Note: tags removed - documents don't have tags property
        active: editingDocument.active,
        updatedAt: new Date().toISOString(),
      });

      toast.success("Document updated successfully");
      setShowEditDialog(false);
      setEditingDocument(null);
    } catch (error) {
      await log.error("document.update.failed", {
        message: "Error updating document",
        subject: { entityType: "document", entityId: editingDocument.id },
        context: { component: "Documents", function: "handleUpdate" },
        error,
      });
      toast.error("Failed to update document");
    } finally {
      setIsUpdating(false);
    }
  };

  // Execute bulk update
  type DocumentInsert = typeof documentsTable.$inferInsert;

  const handleBulkUpdate = async () => {
    if (selectedDocuments.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const updates: Partial<DocumentInsert> = {
        updatedAt: new Date().toISOString(),
      };
      if (bulkType !== "__keep__") updates.type = bulkType;
      // Note: tags removed - documents don't have tags property anymore
      if (bulkDepartmentId) updates.departmentId = bulkDepartmentId;

      if (Object.keys(updates).length > 0) {
        // Use bulk update for efficiency
        await updateDocumentsMutation.mutateAsync({
          updates: selectedDocuments.map(
            (id) =>
              ({
                id,
                ...updates,
              }) as { id: string } & Partial<DocumentInsert>
          ),
        });
      }
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
  const renderDocumentCard = (document: DocumentObject) => {
    const canDelete = canDeleteDocument(document.id);

    return (
      <DocumentPreviewCard
        key={document.id}
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
  if (isLoadingDocuments || isLoadingScenarios) {
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
          typeOptions={typeOptions}
          scenarioOptions={scenarioOptions}
          extensionOptions={extensionOptions}
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
          {editingDocument && (
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
                  value={editingDocument.type}
                  onValueChange={(value) =>
                    setEditingDocument((prev) =>
                      prev ? { ...prev, type: value as DocumentType } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                {/* Note: Tags functionality removed - documents don't have direct tags
                    Tags are now managed via simulation_tags → simulation_tag_documents */}
              </div>

              {/* Department Selection - Only for superadmin */}
              {effectiveProfile?.role === "superadmin" && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <DepartmentSelector
                    departments={departments.map((dept) => ({
                      id: dept.id,
                      title: dept.title as string,
                      ...(dept.description && {
                        description: dept.description,
                      }),
                    }))}
                    selectedDepartment={
                      editingDocument.departmentId
                        ? (() => {
                            const dept = departments.find(
                              (d) => d.id === editingDocument.departmentId
                            );
                            return dept
                              ? {
                                  id: dept.id,
                                  title: dept.title as string,
                                  ...(dept.description && {
                                    description: dept.description,
                                  }),
                                }
                              : null;
                          })()
                        : null
                    }
                    onSelect={(department) =>
                      setEditingDocument((prev) =>
                        prev
                          ? { ...prev, departmentId: department?.id || "" }
                          : null
                      )
                    }
                    placeholder="Select department"
                  />
                </div>
              )}
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
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select
                value={bulkType}
                onValueChange={(value) =>
                  setBulkType(value as DocumentType | "__keep__")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keep existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">Keep existing</SelectItem>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tags</Label>
              <TagSelector
                value={bulkTags}
                onChange={setBulkTags}
                knownTags={Array.from(
                  new Set(documents.flatMap((d) => d.tags ?? []))
                )}
                badgesPosition="below"
                showClearAll
              />
            </div>

            {/* Department Selection - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <DepartmentSelector
                  departments={departments.map((dept) => ({
                    id: dept.id,
                    title: dept.title as string,
                    ...(dept.description && { description: dept.description }),
                  }))}
                  selectedDepartment={
                    bulkDepartmentId
                      ? (() => {
                          const dept = departments.find(
                            (d) => d.id === bulkDepartmentId
                          );
                          return dept
                            ? {
                                id: dept.id,
                                title: dept.title as string,
                                ...(dept.description && {
                                  description: dept.description,
                                }),
                              }
                            : null;
                        })()
                      : null
                  }
                  onSelect={(department) =>
                    setBulkDepartmentId(department?.id || null)
                  }
                  placeholder="Select department"
                />
              </div>
            )}
          </div>
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
                  {(() => {
                    const scenariosUsing = getScenariosUsingDocument(
                      editingDocument.id
                    );
                    if (scenariosUsing.length > 0) {
                      return ` This document is used by ${scenariosUsing.length} scenario${scenariosUsing.length > 1 ? "s" : ""}.`;
                    }
                    return "";
                  })()}
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
                                    (d) => d.id === documentId
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
                                    (d) => d.id === documentId
                                  );
                                  const scenariosUsing = doc
                                    ? getScenariosUsingDocument(doc.id)
                                    : [];
                                  return (
                                    <li
                                      key={documentId}
                                      className="text-red-600 dark:text-red-300"
                                    >
                                      • {doc?.name} (used in{" "}
                                      {scenariosUsing.length} scenario
                                      {scenariosUsing.length > 1 ? "s" : ""})
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
                  ? !canDeleteDocument(editingDocument.id)
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
                document={previewDocument}
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
  );
}
