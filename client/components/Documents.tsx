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
import { toast } from "sonner";
import Image from "next/image";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

// Icons
import {
  Filter,
  Upload,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  FileCode,
  MoreVertical,
  Trash2,
  Eye,
  Search,
  X,
  Plus,
} from "lucide-react";

import DocumentViewer from "@/components/DocumentViewer";
import DocumentUploader from "@/components/DocumentUploader";

// Document interface from schema
type ChatProfile = 'aggressive' | 'happy' | 'confused';

interface DocumentItem {
  id: string;
  name: string;
  filePath: string;
  mimeType: string;
  profile: ChatProfile;
  createdAt: string;
}

interface ClassItem {
  id: string;
  name: string;
  classCode: string;
  description: string;
  createdAt: string;
}

// View modes
type ViewMode = "grid" | "list";
// Upload states
type UploadState = "idle" | "uploading" | "complete" | "error";

export default function Documents() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Query client for mutations
  const queryClient = useQueryClient();

  // Fetch documents and classes
  const { data: documents = [], isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments()
  });

  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses()
  });

  // Derived profiles from schema - static as per database enum
  const profileOptions: {value: ChatProfile, label: string}[] = [
    { value: 'aggressive', label: 'Aggressive' },
    { value: 'happy', label: 'Happy' },
    { value: 'confused', label: 'Confused' }
  ];

  // Create class options from fetched classes
  const classOptions = classes.map((cls: ClassItem) => ({
    value: cls.id,
    label: `${cls.name} (${cls.classCode})`
  }));

  // Filtered documents
  const filteredDocuments = documents.filter((doc: DocumentItem) => {
    // Apply search filter
    const matchesSearch = searchQuery
      ? doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    // Apply profile filter
    const matchesProfile = profileFilter === "all" ? true : doc.profile === profileFilter;

    // For now, we're not filtering by class since documents don't have a class field
    // This would need to be implemented if you add class associations to documents

    return matchesSearch && matchesProfile;
  });

  const isLoading = isDocumentsLoading || isClassesLoading;

  // Handle upload complete
  const handleUploadComplete = () => {
    setUploadState("complete");
    setUploadProgress(100);
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

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string) => {
    try {
      // Show confirmation dialog
      if (!window.confirm("Are you sure you want to delete this document?")) {
        return;
      }

      toast.loading("Deleting document...");

      // Call API to delete document
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/id/${documentId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      
      toast.dismiss();
      toast.success("Document deleted successfully");
    } catch (error) {
      toast.dismiss();
      toast.error(
        `Failed to delete document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Get document type icon
  const getDocumentIcon = (filename: string) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension || "")) {
      return <ImageIcon className="h-10 w-10 text-blue-500" />;
    } else if (["pdf"].includes(extension || "")) {
      return <FileText className="h-10 w-10 text-red-500" />;
    } else if (["doc", "docx", "txt", "md"].includes(extension || "")) {
      return <File className="h-10 w-10 text-green-500" />;
    } else if (["js", "ts", "py", "java", "c", "cpp", "html", "css"].includes(extension || "")) {
      return <FileCode className="h-10 w-10 text-yellow-500" />;
    }
    
    return <File className="h-10 w-10 text-gray-500" />;
  };

  // Get profile color
  const getProfileColor = (profile: string) => {
    switch (profile.toLowerCase()) {
      case "aggressive":
        return "bg-red-500";
      case "happy":
        return "bg-green-500";
      case "confused":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setProfileFilter("all");
    setClassFilter("all");
  };

  // View document preview
  const viewDocument = (document: DocumentItem) => {
    setSelectedDocument(document);
    setShowPreviewModal(true);
  };

  return (
    <div className="space-y-4">
      {/* Simplified Toolbar - similar to data-table-toolbar */}
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
          
          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Profile Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Profiles</SelectItem>
              {profileOptions.map((profile) => (
                <SelectItem key={profile.value} value={profile.value}>
                  {profile.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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
          
          {(searchQuery || profileFilter !== "all" || classFilter !== "all") && (
            <Button variant="ghost" className="h-9 px-2" onClick={resetFilters}>
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
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
          
          <Button 
            onClick={() => setShowUploadModal(true)}
            size="sm"
            className="h-9"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Document count */}
      <div className="text-sm text-muted-foreground mb-2">
        Showing {filteredDocuments.length} of {documents.length} documents
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
            variant="outline" 
            onClick={() => setShowUploadModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      ) : (
        <>
          {/* Grid View */}
          <TabsContent value="grid" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredDocuments.map((doc: DocumentItem) => (
                <div
                  key={doc.id}
                  className="opacity-100 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md"
                >
                  <Card className="overflow-hidden h-full flex flex-col cursor-pointer" onClick={() => viewDocument(doc)}>
                    <div className="relative h-40 bg-muted flex items-center justify-center">
                      {getDocumentIcon(doc.name)}
                      <div className="absolute top-2 left-2">
                        <div 
                          className={`h-3 w-3 rounded-full ${getProfileColor(doc.profile)}`} 
                          title={`${doc.profile.charAt(0).toUpperCase() + doc.profile.slice(1)} Profile`} 
                        />
                      </div>
                    </div>
                    <CardContent className="p-4 flex-grow">
                      <h3 className="font-medium line-clamp-1" title={doc.name}>
                        {doc.name}
                      </h3>
                      <div className="flex mt-2 items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {doc.profile}
                        </Badge>
                      </div>
                    </CardContent>
                    <CardFooter className="p-3 pt-0 flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="mt-0">
            <div className="border rounded-md overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-3 px-4 text-left font-medium">Document</th>
                    <th className="py-3 px-4 text-left font-medium">Profile</th>
                    <th className="py-3 px-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc: DocumentItem) => (
                    <tr 
                      key={doc.id} 
                      className="border-b hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => viewDocument(doc)}
                    >
                      <td className="py-3 px-4 flex items-center gap-3">
                        {getDocumentIcon(doc.name)}
                        <span className="font-medium">{doc.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${getProfileColor(doc.profile)}`} />
                          <span className="capitalize">{doc.profile}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DocumentUploader 
              onUploadComplete={handleUploadComplete}
              onProgress={handleUploadProgress}
              onError={handleUploadError}
              inline
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Upload complete!
              </div>
            )}
            
            {uploadState === "error" && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-md text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
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
            {selectedDocument && (
              <DocumentViewer profile={selectedDocument.profile} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}