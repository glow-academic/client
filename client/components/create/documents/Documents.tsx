/**
 * Documents.tsx
 * Documents component, used to view and manage documents with enhanced filtering and CRUD operations.
 * @AshokSaravanan222 & @siladiea
 * 07/25/2025
 */

"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
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

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Document as DocumentObject, DocumentType } from "@/types";
import {
  Eye,
  File,
  FileCode,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  List,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { logError, logInfo } from "@/utils/logger";
import { deleteDocument } from "@/utils/mutations/documents/delete-document";
import { updateDocument } from "@/utils/mutations/documents/update-document";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";

// MIME type to extension mapping
const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "image/webp": "WEBP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "application/zip": "ZIP",
  "text/html": "HTML",
  "text/css": "CSS",
  "application/javascript": "JS",
  "text/javascript": "JS",
  "application/json": "JSON",
  "text/xml": "XML",
  "application/xml": "XML",
};

// Document type options with icons
const DOCUMENT_TYPE_OPTIONS = [
  { value: "homework", label: "📝 Homework" },
  { value: "project", label: "🚀 Project" },
  { value: "quiz", label: "❓ Quiz" },
  { value: "midterm", label: "📊 Midterm" },
  { value: "lab", label: "🧪 Lab" },
  { value: "lecture", label: "📚 Lecture" },
  { value: "syllabus", label: "📋 Syllabus" },
];

export default function Documents() {
  const queryClient = useQueryClient();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [scenarioFilter, setScenarioFilter] = useState<string[]>([]);
  const [extensionFilter, setExtensionFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentObject | null>(null);
  const [editingDocument, setEditingDocument] = useState<DocumentObject | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch data
  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  const { data: scenarios = [], isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  // Get file extension from MIME type
  const getFileExtension = (mimeType: string): string => {
    return MIME_TYPE_TO_EXTENSION[mimeType] || "OTHER";
  };

  // Get document icon based on filename
  const getDocumentIcon = (filename: string) => {
    const extension = filename.split(".").pop()?.toLowerCase();

    if (
      ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension || "")
    ) {
      return <ImageIcon className="h-6 w-6 text-blue-500" />;
    } else if (["pdf"].includes(extension || "")) {
      return <FileText className="h-6 w-6 text-red-500" />;
    } else if (["doc", "docx", "txt", "md"].includes(extension || "")) {
      return <File className="h-6 w-6 text-green-500" />;
    } else if (
      ["js", "ts", "py", "java", "c", "cpp", "html", "css"].includes(
        extension || ""
      )
    ) {
      return <FileCode className="h-6 w-6 text-yellow-500" />;
    }

    return <File className="h-6 w-6 text-gray-500" />;
  };

  // Get document type icon
  const getDocumentTypeIcon = (type: string) => {
    const typeInfo = DOCUMENT_TYPE_OPTIONS.find(
      (option) => option.value === type
    );
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

  // Filter documents based on search and filters
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Search filter
      const matchesSearch = searchQuery
        ? doc.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      // Type filter
      const matchesType = typeFilter === "all" ? true : doc.type === typeFilter;

      // Scenario filter
      const matchesScenario =
        scenarioFilter.length === 0
          ? true
          : scenarioFilter.some((scenarioId) =>
              scenarios
                .find((s) => s.id === scenarioId)
                ?.documentIds?.includes(doc.id)
            );

      // Extension filter
      const docExtension = getFileExtension(doc.mimeType);
      const matchesExtension =
        extensionFilter.length === 0
          ? true
          : extensionFilter.includes(docExtension);

      return (
        matchesSearch && matchesType && matchesScenario && matchesExtension
      );
    });
  }, [
    documents,
    searchQuery,
    typeFilter,
    scenarioFilter,
    extensionFilter,
    scenarios,
  ]);

  // Generate filter options
  const scenarioOptions = useMemo(() => {
    return scenarios.map((scenario) => ({
      value: scenario.id,
      label: scenario.name,
    }));
  }, [scenarios]);

  const extensionOptions = useMemo(() => {
    const extensions = new Set<string>();
    documents.forEach((doc) => {
      extensions.add(getFileExtension(doc.mimeType));
    });
    return Array.from(extensions).map((ext) => ({
      value: ext,
      label: ext,
    }));
  }, [documents]);

  // Handle document selection
  const handleDocumentSelect = (documentId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments((prev) => [...prev, documentId]);
    } else {
      setSelectedDocuments((prev) => prev.filter((id) => id !== documentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(filteredDocuments.map((doc) => doc.id));
    } else {
      setSelectedDocuments([]);
    }
  };

  // Handle document preview
  const handlePreview = (document: DocumentObject) => {
    setSelectedDocument(document);
    setShowPreviewModal(true);
  };

  // Handle document edit
  const handleEdit = (document: DocumentObject) => {
    setEditingDocument({ ...document });
    setShowEditDialog(true);
  };

  // Handle document delete
  const handleDelete = async () => {
    if (!selectedDocuments.length) return;

    setIsDeleting(true);
    try {
      for (const documentId of selectedDocuments) {
        await deleteDocument(documentId);
        logInfo("Document deleted:", { id: documentId });
      }

      toast.success(
        `${selectedDocuments.length} document(s) deleted successfully`
      );
      setSelectedDocuments([]);
      setShowDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (error) {
      logError("Error deleting documents:", error);
      toast.error("Failed to delete documents");
    } finally {
      setIsDeleting(false);
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
    <div className="space-y-4">
      {/* Enhanced Header with Filters */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2 flex-wrap">
          <div className="mb-2">
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[150px] lg:w-[250px]"
            />
          </div>

          <div className="flex items-center space-x-2 flex-wrap mb-2">
            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Scenario Filter */}
            <Select
              value={scenarioFilter[0] || "all"}
              onValueChange={(value) =>
                setScenarioFilter(value === "all" ? [] : [value])
              }
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Filter by scenario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scenarios</SelectItem>
                {scenarioOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Extension Filter */}
            <Select
              value={extensionFilter[0] || "all"}
              onValueChange={(value) =>
                setExtensionFilter(value === "all" ? [] : [value])
              }
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Filter by extension" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Extensions</SelectItem>
                {extensionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2 mb-2">
          {/* View Toggle */}
          <div className="flex border rounded-md">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none border-l"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Mass Delete Button */}
          {selectedDocuments.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedDocuments.length})
            </Button>
          )}
        </div>
      </div>

      {/* Documents Display Area */}
      <div
        className={cn(
          "min-h-[200px] rounded-lg",
          filteredDocuments.length === 0 ? "border-2 border-dashed" : ""
        )}
      >
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {documents.length === 0
                ? "No documents yet"
                : "No documents match your filters"}
            </p>
            <p className="text-sm text-muted-foreground">
              {documents.length === 0
                ? "Documents will appear here once uploaded"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <div className="p-4">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredDocuments.map((doc) => {
                  const canDelete = canDeleteDocument(doc.id);
                  const scenariosUsing = getScenariosUsingDocument(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className="group relative border rounded-lg hover:shadow-md transition-all"
                    >
                      {/* Selection checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <Checkbox
                          checked={selectedDocuments.includes(doc.id)}
                          onCheckedChange={(checked) =>
                            handleDocumentSelect(doc.id, checked as boolean)
                          }
                        />
                      </div>

                      {/* Type badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <Badge variant="outline" className="text-xs">
                          {getDocumentTypeIcon(doc.type)}
                        </Badge>
                      </div>

                      {/* Action buttons */}
                      <div className="absolute bottom-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
                          onClick={() => handlePreview(doc)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
                          onClick={() => handleEdit(doc)}
                        >
                          <File className="h-3 w-3" />
                        </Button>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
                            onClick={() => {
                              setSelectedDocuments([doc.id]);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Document preview area */}
                      <div
                        className="aspect-square bg-muted rounded-lg flex items-center justify-center relative cursor-pointer"
                        onClick={() => handlePreview(doc)}
                      >
                        {getDocumentIcon(doc.name)}

                        {/* Status indicators */}
                        <div className="absolute top-1 left-1 flex gap-1">
                          {!doc.active && (
                            <Badge variant="secondary" className="text-xs">
                              INACTIVE
                            </Badge>
                          )}
                          {scenariosUsing.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {scenariosUsing.length} SCENARIO
                              {scenariosUsing.length > 1 ? "S" : ""}
                            </Badge>
                          )}
                        </div>

                        {/* Document name */}
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded max-w-[calc(100%-1rem)] truncate">
                          {doc.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header row for list view */}
                <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                  <div className="w-6">
                    <Checkbox
                      checked={
                        selectedDocuments.length === filteredDocuments.length &&
                        filteredDocuments.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </div>
                  <div className="flex-1 font-medium">Name</div>
                  <div className="w-24 text-center">Type</div>
                  <div className="w-20 text-center">Extension</div>
                  <div className="w-20 text-center">Status</div>
                  <div className="w-24 text-center">Scenarios</div>
                  <div className="w-32 text-center">Actions</div>
                </div>

                {filteredDocuments.map((doc) => {
                  const canDelete = canDeleteDocument(doc.id);
                  const scenariosUsing = getScenariosUsingDocument(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all"
                    >
                      <div className="w-6">
                        <Checkbox
                          checked={selectedDocuments.includes(doc.id)}
                          onCheckedChange={(checked) =>
                            handleDocumentSelect(doc.id, checked as boolean)
                          }
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getDocumentIcon(doc.name)}
                          <p className="font-medium truncate" title={doc.name}>
                            {doc.name}
                          </p>
                        </div>
                      </div>

                      <div className="w-24 text-center">
                        <Badge variant="outline" className="text-xs">
                          {getDocumentTypeIcon(doc.type)}
                        </Badge>
                      </div>

                      <div className="w-20 text-center">
                        <Badge variant="secondary" className="text-xs">
                          {getFileExtension(doc.mimeType)}
                        </Badge>
                      </div>

                      <div className="w-20 text-center">
                        <Badge
                          variant={doc.active ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {doc.active ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                      </div>

                      <div className="w-24 text-center">
                        <Badge variant="outline" className="text-xs">
                          {scenariosUsing.length}
                        </Badge>
                      </div>

                      <div className="w-32 flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(doc)}
                        >
                          <File className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedDocuments([doc.id]);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] overflow-hidden">
            {selectedDocument && (
              <DocumentViewer
                document={selectedDocument}
                bare={true}
                isFormDocument={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
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
              Delete Document{selectedDocuments.length > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDocuments.length === 1 ? (
                <>
                  Are you sure you want to delete "
                  {documents.find((d) => d.id === selectedDocuments[0])?.name}"?
                  {(() => {
                    const doc = documents.find(
                      (d) => d.id === selectedDocuments[0]
                    );
                    const scenariosUsing = doc
                      ? getScenariosUsingDocument(doc.id)
                      : [];
                    if (scenariosUsing.length > 0) {
                      return ` This document is used by ${scenariosUsing.length} scenario${scenariosUsing.length > 1 ? "s" : ""}.`;
                    }
                    return "";
                  })()}
                </>
              ) : (
                `Are you sure you want to delete ${selectedDocuments.length} document${selectedDocuments.length > 1 ? "s" : ""}?`
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
