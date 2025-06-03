/**
 * Documents.tsx
 * Used to display documents for classes and profiles
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocuments } from "@/utils/queries/get-documents";
import { getClasses } from "@/utils/queries/get-classes";
import { getProfiles } from "@/utils/queries/get-profiles";
import { toast } from "sonner";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

// Icons
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  FileCode,
  Trash2,
  Search,
  X,
  Plus,
} from "lucide-react";

import DocumentViewer from "@/components/DocumentViewer";
import DocumentUploader from "@/components/DocumentUploader";
import { getProfileConfig } from "@/utils/profiles";
import DocumentDropzone from "@/components/DocumentDropzone";

import {
  documents as DocumentItem,
  classes as ClassItem,
} from "@/drizzle/schema";

// View modes
type ViewMode = "grid" | "list";
// Upload states
type UploadState = "idle" | "uploading" | "complete" | "error";
// Document types enum
export type DocumentTypeEnum = 'homework' | 'project' | 'quiz' | 'midterm' | 'lab';

// Define a document type for our component
type DocumentType = typeof DocumentItem.$inferSelect;

interface DocumentsProps {
  classId?: string; // Optional class filter
}

export default function Documents({ classId }: DocumentsProps) {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>(classId || "all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(
    null,
  );
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentType | null>(
    null,
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Query client for mutations
  const queryClient = useQueryClient();

  // Fetch documents and classes
  const { data: documents = [], isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      try {
        const docs = await getDocuments();
        // Filter out any mock/system documents if needed
        // For now, show all documents but we could add a filter here
        return docs;
      } catch (error) {
        console.error("Error fetching documents:", error);
        return [];
      }
    },
  });

  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Fetch profiles dynamically
  const { data: profiles = [], isLoading: isProfilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
  });

  // Create profile options from fetched profiles
  const profileOptions = profiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
  }));

  // Create class options from fetched classes
  const classOptions = classes.map((cls: typeof ClassItem.$inferSelect) => ({
    value: cls.id,
    label: `${cls.classCode}`,
  }));

  // Document type options
  const typeOptions = [
    { value: "homework", label: "📝 Homework", icon: "📝" },
    { value: "project", label: "🚀 Project", icon: "🚀" },
    { value: "quiz", label: "❓ Quiz", icon: "❓" },
    { value: "midterm", label: "📊 Midterm", icon: "📊" },
    { value: "lab", label: "🧪 Lab", icon: "🧪" },
  ];

  // Filtered documents
  const filteredDocuments = documents.filter((doc: DocumentType) => {
    // Apply search filter
    const matchesSearch = searchQuery
      ? doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    // Apply class filter
    const matchesClass =
      classFilter === "all" ? true : doc.classId === classFilter;

    // Apply type filter
    const matchesType =
      typeFilter === "all" ? true : doc.type === typeFilter;

    return matchesSearch && matchesClass && matchesType;
  });

  const isLoading = isDocumentsLoading || isClassesLoading || isProfilesLoading;

  // Handle upload complete
  const handleUploadComplete = () => {
    setUploadState("complete");
    setUploadProgress(100);
    
    // Invalidate queries to refresh documents list
    queryClient.invalidateQueries({ queryKey: ["documents"] });

    // Reset state after a delay
    setTimeout(() => {
      setShowUploadModal(false);
      setUploadState("idle");
      setUploadProgress(0);
    }, 1500);
  };

  // Handle upload progress
  const handleUploadProgress = (progress: number) => {
    setUploadState("uploading");
    setUploadProgress(progress);
  };

  // Handle upload error
  const handleUploadError = (error: Error) => {
    setUploadState("error");
    toast.error(`Upload failed: ${error.message}`);
  };

  // Handle document deletion with proper error handling
  const handleDeleteDocument = async (documentId: string) => {
    try {
      setIsDeleting(true);
      toast.loading("Deleting document...");

      // First, check if there are any quizzes that reference this document
      const checkResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/references`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (checkResponse.ok) {
        const { references } = await checkResponse.json();

        // If there are quizzes referencing this document, ask for confirmation
        if (references?.quizzes?.length > 0) {
          const confirmed = window.confirm(
            `This document is referenced by ${references.quizzes.length} quiz(es). Deleting it will remove the document reference from these quizzes. Continue?`
          );

          if (!confirmed) {
            toast.dismiss();
            toast.info("Document deletion canceled");
            setIsDeleting(false);
            setShowDeleteDialog(false);
            return;
          }

          // User confirmed, proceed with deletion including the force option
          toast.loading("Deleting document and updating references...");
        }
      }

      // Call API to delete document
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/id/${documentId}?force=true`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to delete document: ${response.status} ${response.statusText}`,
        );
      }

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] }); // Also refresh quizzes which might have been updated

      toast.dismiss();
      toast.success("Document deleted successfully");
      setShowDeleteDialog(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error("Delete document error:", error);
      toast.dismiss();
      toast.error(
        `Failed to delete document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Get document type icon and info
  const getDocumentTypeInfo = (type: string) => {
    const typeInfo = typeOptions.find(t => t.value === type);
    return typeInfo || { value: type, label: type, icon: "📄" };
  };

  // Enhanced document icon function
  const getDocumentIcon = (filename: string, docType?: string) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    const typeInfo = getDocumentTypeInfo(docType || "homework");

    // Create a combined icon with type indicator
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension || "")) {
      return (
        <div className="relative">
          <ImageIcon className="h-10 w-10 text-blue-500" />
          <div className="absolute -top-1 -right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs border">
            {typeInfo.icon}
          </div>
        </div>
      );
    } else if (["pdf"].includes(extension || "")) {
      return (
        <div className="relative">
          <FileText className="h-10 w-10 text-red-500" />
          <div className="absolute -top-1 -right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs border">
            {typeInfo.icon}
          </div>
        </div>
      );
    } else if (["csv"].includes(extension || "")) {
      return (
        <div className="relative">
          <FileCode className="h-10 w-10 text-orange-500" />
          <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            📊
          </div>
        </div>
      );
    } else if (["doc", "docx", "txt", "md"].includes(extension || "")) {
      return (
        <div className="relative">
          <File className="h-10 w-10 text-green-500" />
          <div className="absolute -top-1 -right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs border">
            {typeInfo.icon}
          </div>
        </div>
      );
    } else if (
      ["js", "ts", "py", "java", "c", "cpp", "html", "css"].includes(
        extension || "",
      )
    ) {
      return (
        <div className="relative">
          <FileCode className="h-10 w-10 text-yellow-500" />
          <div className="absolute -top-1 -right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs border">
            {typeInfo.icon}
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <File className="h-10 w-10 text-gray-500" />
        <div className="absolute -top-1 -right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs border">
          {typeInfo.icon}
        </div>
      </div>
    );
  };

  // Get profile color based on document type
  const getProfileColor = (docType?: string) => {
    switch (docType) {
      case "homework": return "bg-blue-500";
      case "project": return "bg-purple-500";
      case "quiz": return "bg-yellow-500";
      case "midterm": return "bg-red-500";
      case "lab": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setProfileFilter("all");
    setTypeFilter("all");
    if (!classId) { // Only reset class filter if not locked to a specific class
      setClassFilter("all");
    }
  };

  // View document preview
  const viewDocument = (document: DocumentType) => {
    setSelectedDocument(document);
    setShowPreviewModal(true);
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-grow max-w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Document Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {typeOptions.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Only show class filter if not locked to a specific class */}
          {!classId && (
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((cls) => (
                  <SelectItem key={cls.value} value={cls.value}>
                    {cls.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(searchQuery ||
            profileFilter !== "all" ||
            typeFilter !== "all" ||
            (!classId && classFilter !== "all")) && (
            <Button variant="ghost" className="h-9 px-2" onClick={resetFilters}>
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
          >
            <TabsList className="grid w-[72px] grid-cols-2 h-9">
              <TabsTrigger value="grid" className="p-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </TabsTrigger>
              <TabsTrigger value="list" className="p-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Documents display */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="h-40 bg-muted animate-pulse" />
              <CardContent className="p-4">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-4 w-1/2 bg-muted animate-pulse rounded mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed">
          <File className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No documents found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {documents.length > 0
              ? "Try adjusting your filters or search query"
              : "Upload a document to get started"}
          </p>
          <Button
            className="mt-4"
            variant="default"
            onClick={() => setShowUploadModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredDocuments.map((doc) => {
                // Find the class for this document
                const docClass = classes.find(
                  (cls: typeof ClassItem.$inferSelect) =>
                    cls.id === doc.classId,
                );
                const typeInfo = getDocumentTypeInfo(doc.type);

                return (
                  <div
                    key={doc.id}
                    className="opacity-100 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md rounded-xl"
                  >
                    <Card
                      className="overflow-hidden aspect-square flex flex-col cursor-pointer p-0 m-0 gap-0 group"
                      onClick={() => viewDocument(doc)}
                    >
                      <div className="relative flex-1 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                        {getDocumentIcon(doc.name, doc.type)}
                        <div className="absolute top-2 left-2 group">
                          <div
                            className={`h-3 w-3 rounded-full ${getProfileColor(doc.type)}`}
                          />
                          <Badge
                            variant="secondary"
                            className="absolute left-0 top-5 scale-0 group-hover:scale-100 transition-all origin-top-left capitalize"
                          >
                            {typeInfo.label}
                          </Badge>
                        </div>
                        {docClass && (
                          <Badge
                            variant="outline"
                            className="absolute bottom-2 right-2 bg-white/80 dark:bg-black/50"
                          >
                            {docClass.classCode}
                          </Badge>
                        )}
                      </div>
                      <div className="p-2 text-center border-t">
                        <h3
                          className="text-xs font-medium line-clamp-1"
                          title={doc.name}
                        >
                          {doc.name}
                        </h3>
                        <div className="absolute top-2 right-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full bg-background/80 hover:bg-background/90 text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocumentToDelete(doc);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-3 px-4 text-left font-medium">
                      Document
                    </th>
                    <th className="py-3 px-4 text-left font-medium">Type</th>
                    {!classId && (
                      <th className="py-3 px-4 text-left font-medium">Class</th>
                    )}
                    <th className="py-3 px-4 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => {
                    // Find the class for this document
                    const docClass = classes.find(
                      (cls: typeof ClassItem.$inferSelect) =>
                        cls.id === doc.classId,
                    );
                    const typeInfo = getDocumentTypeInfo(doc.type);

                    return (
                      <tr
                        key={doc.id}
                        className="border-b hover:bg-muted/20 transition-colors cursor-pointer group"
                        onClick={() => viewDocument(doc)}
                      >
                        <td className="py-3 px-4 flex items-center gap-3">
                          {getDocumentIcon(doc.name, doc.type)}
                          <span className="font-medium">{doc.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-3 w-3 rounded-full ${getProfileColor(doc.type)}`}
                            />
                            <Badge variant="secondary" className="capitalize">
                              {typeInfo.label}
                            </Badge>
                          </div>
                        </td>
                        {!classId && (
                          <td className="py-3 px-4">
                            {docClass && (
                              <Badge variant="outline">
                                {docClass.classCode}
                              </Badge>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocumentToDelete(doc);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Document Upload Dropzone - Always show at bottom when documents exist */}
          <div className="border-t pt-6">
            <DocumentDropzone 
              classId={classId || ""}
              onUploadComplete={handleUploadComplete}
              onProgress={handleUploadProgress}
              onError={handleUploadError}
            />
          </div>
        </div>
      )}

      {/* Document count */}
      <div className="text-sm text-muted-foreground mt-4">
        Showing {filteredDocuments.length} of {documents.length} documents
        {classId && " for this class"}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Content</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DocumentUploader
              onUploadComplete={handleUploadComplete}
              onProgress={handleUploadProgress}
              onError={handleUploadError}
              inline
              defaultClassId={classId} // Pass the class ID if available
            />

            {uploadState === "uploading" && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {uploadState === "complete" && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-md text-sm flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Upload complete!
              </div>
            )}

            {uploadState === "error" && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-md text-sm flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Upload failed. Please try again.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] overflow-hidden">
            {selectedDocument && <DocumentViewer document={selectedDocument} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Are you sure you want to delete{" "}
              <strong>{documentToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                documentToDelete && handleDeleteDocument(documentToDelete.id)
              }
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
