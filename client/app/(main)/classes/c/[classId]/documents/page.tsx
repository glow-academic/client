"use client";

import React, { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getClass } from "@/utils/queries/get-class";
import { getDocuments } from "@/utils/queries/get-documents";
import { toast } from "sonner";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Icons
import {
  FileText,
  Image as ImageIcon,
  File,
  FileCode,
  Trash2,
  Search,
  X,
  Plus,
  Upload,
  FolderOpen,
  Grid3X3,
  List,
  Filter,
  SortAsc,
  SortDesc,
  Archive,
  Wand2,
  RefreshCw,
  Download,
  Eye,
  MoreHorizontal,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

import DocumentViewer from "@/components/DocumentViewer";
import DocumentUploader from "@/components/DocumentUploader";
import DocumentDropzone from "@/components/DocumentDropzone";

import {
  documents as DocumentItem,
} from "@/drizzle/schema";

// Types
type ViewMode = "grid" | "list";
type SortField = "name" | "type" | "createdAt";
type SortOrder = "asc" | "desc";
type UploadState = "idle" | "uploading" | "complete" | "error";
type DocumentType = typeof DocumentItem.$inferSelect;

interface DocumentsPageProps {
  params: Promise<{ classId: string }>;
}

export default function DocumentsPage({ params }: DocumentsPageProps) {
  const { classId } = use(params);
  const router = useRouter();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentType | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);

  // Query client for mutations
  const queryClient = useQueryClient();

  // Fetch class data
  const { data: classDataArray, isLoading: isClassLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
    enabled: !!classId,
  });

  const classData = React.useMemo(() => {
    return Array.isArray(classDataArray) ? classDataArray[0] : classDataArray;
  }, [classDataArray]);

  // Fetch documents
  const { data: allDocuments = [], isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      try {
        const docs = await getDocuments();
        return docs;
      } catch (error) {
        console.error("Error fetching documents:", error);
        return [];
      }
    },
  });

  // Filter documents for this class
  const classDocuments = React.useMemo(() => {
    return allDocuments.filter(doc => doc.classId === classId);
  }, [allDocuments, classId]);

  // Document type options
  const typeOptions = [
    { value: "homework", label: "📝 Homework", icon: "📝" },
    { value: "project", label: "🚀 Project", icon: "🚀" },
    { value: "quiz", label: "❓ Quiz", icon: "❓" },
    { value: "midterm", label: "📊 Midterm", icon: "📊" },
    { value: "lab", label: "🧪 Lab", icon: "🧪" },
    { value: "lecture", label: "📚 Lecture", icon: "📚" },
    { value: "syllabus", label: "📋 Syllabus", icon: "📋" },
  ];

  // Filter and sort documents
  const filteredAndSortedDocuments = React.useMemo(() => {
    let filtered = classDocuments.filter((doc) => {
      const matchesSearch = searchQuery
        ? doc.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesType = typeFilter === "all" ? true : doc.type === typeFilter;
      return matchesSearch && matchesType;
    });

    // Sort documents
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [classDocuments, searchQuery, typeFilter, sortField, sortOrder]);

  // Document type statistics
  const typeStats = React.useMemo(() => {
    const stats = typeOptions.reduce((acc, type) => {
      acc[type.value] = classDocuments.filter(doc => doc.type === type.value).length;
      return acc;
    }, {} as Record<string, number>);
    return stats;
  }, [classDocuments, typeOptions]);

  // Helper functions
  const getDocumentIcon = (filename: string, type: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (type === "lecture") return <FileText className="h-8 w-8 text-blue-500" />;
    if (type === "syllabus") return <FileText className="h-8 w-8 text-purple-500" />;
    if (type === "homework") return <FileText className="h-8 w-8 text-green-500" />;
    if (type === "project") return <FileCode className="h-8 w-8 text-orange-500" />;
    if (type === "quiz" || type === "midterm") return <FileText className="h-8 w-8 text-red-500" />;
    if (type === "lab") return <FileCode className="h-8 w-8 text-cyan-500" />;
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension || '')) {
      return <ImageIcon className="h-8 w-8 text-green-500" />;
    }
    
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const getDocumentTypeInfo = (type: string) => {
    return typeOptions.find(option => option.value === type) || { value: type, label: type, icon: "📄" };
  };

  const getProfileColor = (type: string) => {
    const colors = {
      homework: "bg-green-500",
      project: "bg-orange-500", 
      quiz: "bg-red-500",
      midterm: "bg-red-600",
      lab: "bg-cyan-500",
      lecture: "bg-blue-500",
      syllabus: "bg-purple-500",
    };
    return colors[type as keyof typeof colors] || "bg-gray-500";
  };

  // Handle upload complete
  const handleUploadComplete = () => {
    setUploadState("complete");
    setUploadProgress(100);
    
    queryClient.invalidateQueries({ queryKey: ["documents"] });

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

  // Handle document classification
  const handleClassifyDocuments = async () => {
    if (!classId) return;

    setIsClassifying(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/classify?class_id=${classId}`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to classify documents");
      }

      const result = await response.json();
      
      if (result.status === "success") {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } else {
        toast.error(result.message || "Classification failed");
      }
    } catch (error) {
      console.error("Classification error:", error);
      toast.error("Failed to classify documents");
    } finally {
      setIsClassifying(false);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/id/${documentId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      toast.success("Document deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowDeleteDialog(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setSortField("name");
    setSortOrder("asc");
  };

  // View document preview
  const viewDocument = (document: DocumentType) => {
    setSelectedDocument(document);
    setShowPreviewModal(true);
  };

  if (isClassLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Class Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The requested class could not be found.
          </p>
        </div>
      </div>
    );
  }

      return (
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/classes/c/${classId}`)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
            </div>
            <p className="text-lg text-muted-foreground ml-11">
              {classData.classCode} - {classData.name}
            </p>
            <p className="text-sm text-muted-foreground ml-11">
              {classDocuments.length} documents • {filteredAndSortedDocuments.length} shown
            </p>
          </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleClassifyDocuments}
            disabled={isClassifying || classDocuments.length === 0}
            variant="outline"
            size="sm"
          >
            {isClassifying ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            {isClassifying ? "Classifying..." : "Auto-Classify"}
          </Button>
          <Button onClick={() => setShowUploadModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Upload Documents
          </Button>
        </div>
      </div>

      {/* Document Type Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document Overview</CardTitle>
          <CardDescription>Distribution of documents by type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {typeOptions.map((type) => (
              <div
                key={type.value}
                className="flex flex-col items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setTypeFilter(typeFilter === type.value ? "all" : type.value)}
              >
                <span className="text-2xl mb-1">{type.icon}</span>
                <span className="text-sm font-medium">{type.label.replace(/^\S+\s/, "")}</span>
                <Badge variant={typeFilter === type.value ? "default" : "secondary"} className="mt-1">
                  {typeStats[type.value] || 0}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Search */}
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

              {/* Type Filter */}
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

              {/* Sort */}
              <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="createdAt">Date</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>

              {/* Reset Filters */}
              {(searchQuery || typeFilter !== "all" || sortField !== "name" || sortOrder !== "asc") && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Tabs
                value={viewMode}
                onValueChange={(value) => setViewMode(value as ViewMode)}
              >
                <TabsList className="grid w-[72px] grid-cols-2 h-9">
                  <TabsTrigger value="grid" className="p-1.5">
                    <Grid3X3 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list" className="p-1.5">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Display */}
      {isDocumentsLoading ? (
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
      ) : filteredAndSortedDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {classDocuments.length === 0 ? "No documents yet" : "No documents found"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {classDocuments.length === 0
                ? "Upload documents to get started with this class"
                : "Try adjusting your filters or search query"}
            </p>
            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Upload Documents
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredAndSortedDocuments.map((doc) => {
                const typeInfo = getDocumentTypeInfo(doc.type);

                return (
                  <Card
                    key={doc.id}
                    className="overflow-hidden aspect-square flex flex-col cursor-pointer group hover:shadow-md transition-all duration-200"
                    onClick={() => viewDocument(doc)}
                  >
                    <div className="relative flex-1 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                      {getDocumentIcon(doc.name, doc.type)}
                      <div className="absolute top-2 left-2">
                        <div className={`h-3 w-3 rounded-full ${getProfileColor(doc.type)}`} />
                      </div>
                      <Badge
                        variant="secondary"
                        className="absolute bottom-2 right-2 bg-white/80 dark:bg-black/50 text-xs"
                      >
                        {typeInfo.icon}
                      </Badge>
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
                    <div className="p-3 text-center border-t">
                      <h3 className="text-xs font-medium line-clamp-2" title={doc.name}>
                        {doc.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        {doc.type}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="py-3 px-4 text-left font-medium">Document</th>
                      <th className="py-3 px-4 text-left font-medium">Type</th>
                      <th className="py-3 px-4 text-left font-medium">Created</th>
                      <th className="py-3 px-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedDocuments.map((doc) => {
                      const typeInfo = getDocumentTypeInfo(doc.type);

                      return (
                        <tr
                          key={doc.id}
                          className="border-b hover:bg-muted/20 transition-colors cursor-pointer group"
                          onClick={() => viewDocument(doc)}
                        >
                          <td className="py-3 px-4 flex items-center gap-3">
                            {getDocumentIcon(doc.name, doc.type)}
                            <div>
                              <span className="font-medium">{doc.name}</span>
                              <p className="text-xs text-muted-foreground">
                                {(doc as any).mimeType || "Unknown type"}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`h-3 w-3 rounded-full ${getProfileColor(doc.type)}`} />
                              <Badge variant="secondary" className="capitalize">
                                {typeInfo.label.replace(/^\S+\s/, "")}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  viewDocument(doc);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocumentToDelete(doc);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Upload Dropzone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload More Documents</CardTitle>
              <CardDescription>
                Drag and drop files here, or click to browse. Supports ZIP files for bulk upload with auto-classification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentDropzone 
                classId={classId}
                onUploadComplete={handleUploadComplete}
                onProgress={handleUploadProgress}
                onError={handleUploadError}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DocumentUploader
              onUploadComplete={handleUploadComplete}
              onProgress={handleUploadProgress}
              onError={handleUploadError}
              inline
              defaultClassId={classId}
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
