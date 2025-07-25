/**
 * Documents.tsx
 * Documents component, used to view and manage documents with enhanced filtering and CRUD operations.
 * @AshokSaravanan222 & @siladiea
 * 07/25/2025
 */

"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Document as DocumentObject, DocumentType } from "@/types";
import { Edit, Trash2, UploadCloud } from "lucide-react";

import { useDocumentColumns } from "@/hooks/use-document-columns";
import { logError, logInfo } from "@/utils/logger";
import { deleteDocument } from "@/utils/mutations/documents/delete-document";
import { updateDocument } from "@/utils/mutations/documents/update-document";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { DocumentsDataTable } from "./DocumentsDataTable";

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export default function Documents() {
  const queryClient = useQueryClient();

  // State management
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentObject | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch data with optimized caching
  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: scenarios = [], isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Get table columns and filter options
  const { columns, typeOptions, scenarioOptions, extensionOptions } =
    useDocumentColumns();

  // Get document type icon
  const getDocumentTypeIcon = (type: string) => {
    const typeInfo = typeOptions.find((option) => option.value === type);
    return typeInfo?.label.split(" ")[0] || "📄";
  };

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
        await deleteDocument(editingDocument.id);
        logInfo("Document deleted:", { id: editingDocument.id });
        toast.success("Document deleted successfully");
        setShowDeleteDialog(false);
        setEditingDocument(null);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch (error) {
        logError("Error deleting document:", error);
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
        for (const documentId of deletableDocuments) {
          await deleteDocument(documentId);
          logInfo("Document deleted:", { id: documentId });
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
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch (error) {
        logError("Error deleting documents:", error);
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
      await updateDocument(editingDocument.id, {
        name: editingDocument.name,
        type: editingDocument.type,
        active: editingDocument.active,
      });

      toast.success("Document updated successfully");
      setShowEditDialog(false);
      setEditingDocument(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (error) {
      logError("Error updating document:", error);
      toast.error("Failed to update document");
    } finally {
      setIsUpdating(false);
    }
  };

  // Render document card for grid view
  const renderDocumentCard = (document: DocumentObject) => {
    const canDelete = canDeleteDocument(document.id);

    return (
      <div
        key={document.id}
        className="group relative border rounded-lg hover:shadow-md transition-all bg-white"
      >
        {/* Action buttons - moved to top right */}
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
            onClick={() => handleEdit(document)}
          >
            <Edit className="h-3 w-3" />
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
              onClick={() => handleSingleDelete(document)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Document preview area */}
        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
          {/* Document preview */}
          <div className="w-full h-full">
            <DocumentViewer
              document={document}
              bare={true}
              isFormDocument={false}
            />
          </div>

          {/* Status indicators */}
          <div className="absolute top-1 left-1 flex gap-1">
            {!document.active && (
              <Badge variant="secondary" className="text-xs">
                INACTIVE
              </Badge>
            )}
          </div>

          {/* Document name */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded max-w-[calc(100%-1rem)]">
            <span title={document.name}>{truncateText(document.name, 25)}</span>
          </div>

          {/* Type badge - moved to bottom right */}
          <div className="absolute bottom-2 right-2 z-10">
            <Badge variant="outline" className="text-xs">
              {getDocumentTypeIcon(document.type)}
            </Badge>
          </div>
        </div>
      </div>
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
          onDelete={handleSingleDelete}
          canDelete={canDeleteDocument}
          selectedDocuments={selectedDocuments}
          onDocumentSelect={handleDocumentSelect}
          onSelectAll={handleSelectAll}
          onBulkDelete={handleBulkDelete}
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
              <div>
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

              <div>
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

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={editingDocument.active}
                  onCheckedChange={(checked) =>
                    setEditingDocument((prev) =>
                      prev ? { ...prev, active: checked } : null
                    )
                  }
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
          )}
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
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                isDeleting ||
                (editingDocument && !selectedDocuments.length
                  ? !canDeleteDocument(editingDocument.id)
                  : selectedDocuments.filter((documentId) =>
                      canDeleteDocument(documentId)
                    ).length === 0)
              }
              className="bg-red-600 hover:bg-red-700 text-white"
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
    </div>
  );
}
