/**
 * ContextDocuments.tsx
 * Context documents component with CRUD operations
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import {
  Dialog,
  DialogContent,
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
  Save,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { logError, logInfo } from "@/utils/logger";
import { createDocuments } from "@/utils/mutations/documents/create-documents";
import { deleteDocument } from "@/utils/mutations/documents/delete-document";
import { updateDocument } from "@/utils/mutations/documents/update-document";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";

// A new type to represent a document that is either saved or new
type EditableDocument =
  | DocumentObject
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      name: string;
      type: DocumentType;
      file: File; // The actual File object
      url: string; // A temporary object URL for local previews
      filePath: string;
      mimeType: string;
      classified: boolean;
      fileId: string | null;
      active: boolean;
    };

export default function ContextDocuments() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Document management state
  const [documents, setDocuments] = useState<EditableDocument[]>([]);
  const [originalDocuments, setOriginalDocuments] = useState<
    EditableDocument[]
  >([]);
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentObject | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  const { data: fetchedDocuments = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  // Initialize data when fetched
  useState(() => {
    if (fetchedDocuments.length > 0 && documents.length === 0) {
      const editableData = fetchedDocuments.map((item) => ({ ...item }));
      setDocuments(editableData);
      setOriginalDocuments(editableData);
      setHasChanges(false);
    }
  });

  // --- MODIFIED: `handleFiles` now only stages files locally ---
  const handleFiles = useCallback(
    (files: FileList) => {
      if (!files || files.length === 0) return;

      // Create temporary document objects for each new file
      const newDocs: EditableDocument[] = Array.from(files).map((file) => ({
        isNew: true,
        id: uuidv4(),
        name: file.name,
        file: file,
        type: "lecture", // A sensible default
        url: URL.createObjectURL(file), // URL for local preview
        filePath: URL.createObjectURL(file),
        mimeType: file.type,
        classified: false,
        fileId: null,
        active: true,
      }));

      setDocuments([...documents, ...newDocs]);
      setHasChanges(true);
      toast.info(`${newDocs.length} file(s) staged. Save to upload.`);
    },
    [documents]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    if (!isSaving) {
      fileInputRef.current?.click();
    }
  }, [isSaving]);

  // --- MODIFIED: Deletion logic now handles both new and existing files ---
  const handleDeleteClick = (docId: string, name: string) => {
    setDeleteItem({ id: docId, name });
    setShowDeleteDialog(true);
  };

  const handleDelete = () => {
    if (!deleteItem) return;

    const docToRemove = documents.find((d) => d.id === deleteItem.id);
    if (!docToRemove) return;

    // If it's an existing document, add its ID to the deletion queue
    if (!("isNew" in docToRemove)) {
      setDocumentsToDelete([...documentsToDelete, deleteItem.id]);
    }

    // Remove the document from the visible UI state
    setDocuments(documents.filter((d) => d.id !== deleteItem.id));
    setHasChanges(true);
    setShowDeleteDialog(false);
    setDeleteItem(null);
    toast.success("Document removed. Remember to save changes.");
  };

  const handleDocumentTypeChange = (docId: string, newType: string) => {
    setDocuments(
      documents.map((doc) =>
        doc.id === docId ? { ...doc, type: newType as DocumentType } : doc
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Separate new items from existing items
      const newItems = documents.filter(
        (item): item is EditableDocument & { isNew: true } =>
          "isNew" in item && item.isNew
      );
      const existingItems = documents.filter(
        (item): item is DocumentObject => !("isNew" in item)
      );

      // Create new items (Note: This is simplified - in reality you'd need file upload logic)
      if (newItems.length > 0) {
        const newItemsData = newItems.map((item) => ({
          name: item.name,
          type: item.type,
          filePath: `/uploads/${item.name}`, // Simplified path
          mimeType: item.mimeType,
          classified: item.classified,
          fileId: item.fileId,
          active: item.active,
        }));
        await createDocuments(newItemsData);
        logInfo("Created new documents:", { count: newItems.length });
      }

      // Update existing items
      for (const item of existingItems) {
        const original = originalDocuments.find(
          (orig): orig is DocumentObject =>
            !("isNew" in orig) && orig.id === item.id
        );
        if (
          original &&
          (original.name !== item.name ||
            original.type !== item.type ||
            original.active !== item.active)
        ) {
          await updateDocument(item.id, {
            name: item.name,
            type: item.type,
            active: item.active,
          });
          logInfo("Updated document:", { id: item.id, name: item.name });
        }
      }

      // Delete removed items
      for (const id of documentsToDelete) {
        await deleteDocument(id);
        logInfo("Deleted document:", { id });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Changes saved successfully");
      setHasChanges(false);
      setDocumentsToDelete([]);
    } catch (error) {
      logError("Error saving documents:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDocuments([...originalDocuments]);
    setDocumentsToDelete([]);
    setHasChanges(false);
    toast.info("Changes cancelled");
  };

  const getDocumentTypeInfo = (type: string) => {
    const typeMap: Record<
      string,
      { label: string; icon: string; color: string }
    > = {
      homework: { label: "📝 Homework", icon: "📝", color: "bg-blue-500" },
      project: { label: "🚀 Project", icon: "🚀", color: "bg-purple-500" },
      quiz: { label: "❓ Quiz", icon: "❓", color: "bg-yellow-500" },
      midterm: { label: "📊 Midterm", icon: "📊", color: "bg-red-500" },
      lab: { label: "🧪 Lab", icon: "🧪", color: "bg-green-500" },
      lecture: { label: "📚 Lecture", icon: "📚", color: "bg-indigo-500" },
      syllabus: { label: "📋 Syllabus", icon: "📋", color: "bg-gray-500" },
    };
    return typeMap[type] || { label: type, icon: "📄", color: "bg-gray-500" };
  };

  const getDocumentTypeIcon = (type: string) => {
    const typeInfo = getDocumentTypeInfo(type);
    return typeInfo.icon;
  };

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

  const viewDocument = (document: EditableDocument) => {
    // For new documents, create a temporary document object for the viewer
    if ("isNew" in document && document.isNew) {
      const tempDoc: DocumentObject = {
        id: document.id,
        name: document.name,
        type: document.type,
        filePath: document.url, // Use filePath instead of url
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mimeType: document.file.type,
        classified: false,
        fileId: null,
        active: true,
      };
      setSelectedDocument(tempDoc);
    } else {
      setSelectedDocument(document as DocumentObject);
    }
    setShowPreviewModal(true);
  };

  // Filter documents from the *edited* state for rendering
  const filteredDocuments = documents.filter((doc: EditableDocument) => {
    const matchesSearch = searchQuery
      ? doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesType = typeFilter === "all" ? true : doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

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
    <div
      className="space-y-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenario Documents</h1>
          <p className="text-muted-foreground">
            Manage documents for scenario contexts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/management/context")}
          >
            <X className="h-4 w-4 mr-2" />
            Back
          </Button>
          {hasChanges && (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Left side - Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 w-64"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="homework">📝 Homework</SelectItem>
              <SelectItem value="project">🚀 Project</SelectItem>
              <SelectItem value="quiz">❓ Quiz</SelectItem>
              <SelectItem value="midterm">📊 Midterm</SelectItem>
              <SelectItem value="lab">🧪 Lab</SelectItem>
              <SelectItem value="lecture">📚 Lecture</SelectItem>
              <SelectItem value="syllabus">📋 Syllabus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Right side - View Toggle */}
        <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              data-testid="file-input"
              multiple
              onChange={handleFileInputChange}
              disabled={isSaving}
              accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
              className="hidden"
            />
            <Button
              type="button"
              variant="default"
              onClick={handleClick}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isSaving ? "Uploading..." : "Upload"}
            </Button>
          </div>
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
                ? "Drag and drop files here or click Upload to get started"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <div className="p-4">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredDocuments.map((doc) => {
                  const isNewDoc = "isNew" in doc && doc.isNew;
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "group relative border rounded-lg hover:shadow-md transition-all",
                        isNewDoc && "border-blue-300 bg-blue-50/50"
                      )}
                    >
                      {/* Type selector in top left */}
                      <div className="absolute top-2 left-2 z-10">
                        <Select
                          value={doc.type}
                          onValueChange={(value) =>
                            handleDocumentTypeChange(doc.id, value)
                          }
                        >
                          <SelectTrigger
                            className="text-xs bg-white/90 backdrop-blur-sm border-0 shadow-sm justify-center"
                            size="sm"
                          >
                            <span className="text-sm">
                              {getDocumentTypeIcon(doc.type)}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="homework">
                              📝 Homework
                            </SelectItem>
                            <SelectItem value="project">🚀 Project</SelectItem>
                            <SelectItem value="quiz">❓ Quiz</SelectItem>
                            <SelectItem value="midterm">📊 Midterm</SelectItem>
                            <SelectItem value="lab">🧪 Lab</SelectItem>
                            <SelectItem value="lecture">📚 Lecture</SelectItem>
                            <SelectItem value="syllabus">
                              📋 Syllabus
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Action buttons in top right */}
                      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
                          onClick={() => viewDocument(doc)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
                          data-testid={`delete-doc-${doc.id}`}
                          onClick={() => handleDeleteClick(doc.id, doc.name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Image area */}
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative">
                        {getDocumentIcon(doc.name)}
                        {isNewDoc && (
                          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded text-[10px]">
                            NEW
                          </div>
                        )}

                        {/* Title in bottom right of image */}
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded max-w-[calc(100%-1rem)] truncate">
                          {doc.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((doc) => {
                  const isNewDoc = "isNew" in doc && doc.isNew;
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all",
                        isNewDoc && "border-blue-300 bg-blue-50/50"
                      )}
                    >
                      <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                        {getDocumentIcon(doc.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          {isNewDoc && (
                            <span className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                              NEW
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={doc.type}
                          onValueChange={(value) =>
                            handleDocumentTypeChange(doc.id, value)
                          }
                        >
                          <SelectTrigger className="w-40 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="homework">
                              📝 Homework
                            </SelectItem>
                            <SelectItem value="project">🚀 Project</SelectItem>
                            <SelectItem value="quiz">❓ Quiz</SelectItem>
                            <SelectItem value="midterm">📊 Midterm</SelectItem>
                            <SelectItem value="lab">🧪 Lab</SelectItem>
                            <SelectItem value="lecture">📚 Lecture</SelectItem>
                            <SelectItem value="syllabus">
                              📋 Syllabus
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => viewDocument(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          data-testid={`delete-doc-${doc.id}`}
                          onClick={() => handleDeleteClick(doc.id, doc.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                isFormDocument={selectedDocument.filePath?.startsWith("blob:")}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
