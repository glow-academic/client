"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { cn } from "@/lib/utils";
import { Class, Document, DocumentType } from "@/types";
import { deleteDocument } from "@/utils/api/documents/delete-document";
import { finalizeDocumentUpload } from "@/utils/api/documents/finalize-document-upload";
import { processCourse } from "@/utils/api/documents/process-course";
import { logError, logInfo } from "@/utils/logger";
import { createClass } from "@/utils/mutations/classes/create-class";
import { updateClass } from "@/utils/mutations/classes/update-class";
import { updateDocument } from "@/utils/mutations/documents/update-document";
import { getDocumentsByClass } from "@/utils/queries/documents/get-documents-by-class";
import {
  AlertTriangle,
  Brain,
  Eye,
  File,
  FileCode,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  List,
  Loader2,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";

interface FormErrors {
  name?: string;
  classCode?: string;
  year?: string;
  term?: string;
  description?: string;
}

interface ClassFormProps {
  mode: "create" | "edit";
  classId?: string;
  initialData?: Partial<Class>;
  onSuccess?: (classId: string) => void;
}

export default function ClassForm({
  mode,
  classId,
  initialData,
  onSuccess,
}: ClassFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Document management state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(
    null
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Course processing state
  const [showCourseProcessDialog, setShowCourseProcessDialog] = useState(false);
  const [isProcessingCourse, setIsProcessingCourse] = useState(false);

  // Handle course processing
  const handleCourseProcessing = async () => {
    if (!classId) {
      toast.error(
        "Please save the class first before processing course information"
      );
      return;
    }

    try {
      setIsProcessingCourse(true);
      setShowCourseProcessDialog(false);

      const toastId = toast.loading("Processing course information...");

      const result = await processCourse(classId);

      if (!result.success) {
        throw new Error(
          result.message || "Failed to process course information"
        );
      }

      toast.dismiss(toastId);

      if (result.status === "success") {
        toast.success("Course information processed successfully!");

        // Show details of what was updated
        if (result.updates_made && result.updates_made.length > 0) {
          toast.info(`Updated: ${result.updates_made.join(", ")}`);
        }

        // Refresh the class data
        queryClient.invalidateQueries({ queryKey: ["class", classId] });
        queryClient.invalidateQueries({ queryKey: ["classes"] });

        // If there's debug info, log it
        if (result.debug_info) {
          logInfo("Course processing debug info:", {
            debug_info: result.debug_info,
          });
        }
      } else {
        throw new Error(result.message || "Course processing failed");
      }
    } catch (error) {
      toast.error(
        `Failed to process course: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      logError("Course processing error:", error);
    } finally {
      setIsProcessingCourse(false);
    }
  };

  const [formData, setFormData] = useState<Partial<Class>>({
    id: initialData?.id || "",
    name: initialData?.name || "",
    classCode: initialData?.classCode || "",
    year: initialData?.year || new Date().getFullYear(),
    term: initialData?.term || "fall",
    description: initialData?.description || "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch documents for this class
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", classId],
    queryFn: () => getDocumentsByClass([classId!]),
    enabled: classId !== undefined && classId !== null,
  });

  // Update form data when initial data changes
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        classCode: initialData.classCode || "",
        year: initialData.year || new Date().getFullYear(),
        term: initialData.term || "fall",
        description: initialData.description || "",
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = "Class name is required";
    }

    if (!formData.classCode?.trim()) {
      newErrors.classCode = "Class code is required";
    }

    if (formData.year && (formData.year < 2020 || formData.year > 2030)) {
      newErrors.year = "Year must be between 2020 and 2030";
    }

    if (!formData.description?.trim()) {
      newErrors.description = "Description is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      if (mode === "create") {
        result = await createClass(formData as Class);

        queryClient.invalidateQueries({ queryKey: ["classes"] });
        toast.success("Class created successfully!");
        if (onSuccess && result) {
          onSuccess(result.id);
        } else if (result) {
          router.push(`/classes/c/${result.id}`);
        }
      } else {
        if (!classId) throw new Error("Class ID is required for editing");

        result = await updateClass(classId, formData as Class);

        queryClient.invalidateQueries({ queryKey: ["classes"] });
        queryClient.invalidateQueries({ queryKey: ["class", classId] });
        queryClient.invalidateQueries({ queryKey: ["documents", classId] });
        toast.success("Class updated successfully!");
        if (onSuccess) {
          onSuccess(classId);
        }
      }
    } catch (error) {
      toast.error(
        `Failed to ${mode} class: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      logError(`Error ${mode}ing class:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // File upload handling
  const handleFiles = useCallback(
    async (files: FileList) => {
      if (!files || files.length === 0) return;
      if (!classId) {
        if (mode === "create") {
          toast.error(
            "Please create the class first before uploading documents"
          );
        } else {
          toast.error("Please save the class first before uploading documents");
        }
        return;
      }

      const fileArray = Array.from(files);

      try {
        setIsUploading(true);

        // Create initial file upload statuses
        const initialStatuses = fileArray.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          progress: 0,
          status: "uploading" as const,
        }));

        // Show toast for multiple files
        let toastId: string | number = "";
        if (fileArray.length > 1) {
          toastId = toast.loading(`Uploading ${fileArray.length} files...`);
        } else if (fileArray[0]) {
          toastId = toast.loading(`Uploading ${fileArray[0].name}...`);
        }

        const uploadPromises = fileArray.map((file, index) => {
          return new Promise<void>((resolve, reject) => {
            // Generate a unique file ID
            const fileId = initialStatuses[index]?.id;
            if (!fileId) {
              reject(new Error("File ID not found"));
              return;
            }

            const tusMetadata = {
              filename: file.name,
              filetype: file.type,
              class: classId,
              fileId: fileId,
              // Add ZIP support with auto-classification
              ...(file.type === "application/zip" && {
                zip: "true",
                autoClassify: "true",
              }),
            };

            // Create a new tus upload
            const upload = new tus.Upload(file, {
              endpoint: `/api/upload`,
              retryDelays: [0, 3000, 5000, 10000, 20000],
              metadata: tusMetadata,
              onError: (error) => {
                logError(`Failed to upload ${file.name}: `, error);

                toast.error(
                  `Failed to upload ${file.name}: ${error.message || "Unknown error"}`
                );

                reject(error);
              },
              onProgress: (bytesUploaded, bytesTotal) => {
                const percentage = Math.round(
                  (bytesUploaded / bytesTotal) * 100
                );
                logInfo(`${file.name} uploaded ${percentage}%`);
              },
              onSuccess: async () => {
                // Finalize the upload
                try {
                  const response = await finalizeDocumentUpload(
                    fileId,
                    classId,
                    file.type === "application/zip",
                    true
                  );

                  if (!response.success) {
                    throw new Error(
                      response.message || "Failed to finalize upload"
                    );
                  }

                  toast.success(`${file.name} uploaded successfully!`);
                  resolve();
                } catch (error) {
                  logError(`Finalization error for ${file.name}:`, error);

                  toast.error(
                    `Failed to process ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`
                  );

                  reject(error);
                }
              },
            });

            // Start the upload
            upload.start();
          });
        });

        // Wait for all uploads to complete
        try {
          await Promise.allSettled(uploadPromises);

          // Dismiss the loading toast
          toast.dismiss(toastId);

          // Reset form
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["documents", classId] });
        } catch (error) {
          logError("Some uploads failed:", error);
          // Dismiss the loading toast
          toast.dismiss(toastId);
        } finally {
          setIsUploading(false);
        }
      } catch (error) {
        logError("Upload initialization error:", error);
        toast.error(
          `Upload error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        setIsUploading(false);
      }
    },
    [classId, queryClient, mode]
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
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  const handleDeleteDocument = async (documentId: string) => {
    try {
      setIsDeletingDoc(true);

      const result = await deleteDocument(documentId);

      if (!result.success) {
        throw new Error(result.message);
      }

      queryClient.invalidateQueries({ queryKey: ["documents", classId] });
      toast.success("Document deleted successfully");
      setShowDeleteDialog(false);
      setDocumentToDelete(null);
    } catch (error) {
      logError("Delete document error:", error);
      toast.error(
        `Failed to delete document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleDocumentTypeChange = async (
    documentId: string,
    newType: string
  ) => {
    try {
      await updateDocument(documentId, { type: newType as DocumentType });
      queryClient.invalidateQueries({ queryKey: ["documents", classId] });
      toast.success("Document type updated");
    } catch (error) {
      toast.error("Failed to update document type");
      logError("Update error:", error);
    }
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

  const viewDocument = (document: Document) => {
    setSelectedDocument(document);
    setShowPreviewModal(true);
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc: Document) => {
    const matchesSearch = searchQuery
      ? doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesType = typeFilter === "all" ? true : doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div
      className="space-y-6 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-6xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Class Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Class Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Introduction to Computer Science"
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Class Code */}
          <div className="space-y-2">
            <Label htmlFor="classCode">Class Code *</Label>
            <Input
              id="classCode"
              value={formData.classCode}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, classCode: e.target.value }))
              }
              placeholder="e.g., CS101"
              className={errors.classCode ? "border-red-500" : ""}
            />
            {errors.classCode && (
              <p className="text-sm text-red-500">{errors.classCode}</p>
            )}
          </div>

          {/* Year and Term */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    year: parseInt(e.target.value) || new Date().getFullYear(),
                  }))
                }
                min="2020"
                max="2030"
                className={errors.year ? "border-red-500" : ""}
              />
              {errors.year && (
                <p className="text-sm text-red-500">{errors.year}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="term">Term *</Label>
              <Select
                value={formData.term || ""}
                onValueChange={(value: "fall" | "spring" | "summer") =>
                  setFormData((prev) => ({ ...prev, term: value }))
                }
              >
                <SelectTrigger className={errors.term ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fall">Fall</SelectItem>
                  <SelectItem value="spring">Spring</SelectItem>
                  <SelectItem value="summer">Summer</SelectItem>
                </SelectContent>
              </Select>
              {errors.term && (
                <p className="text-sm text-red-500">{errors.term}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe the class objectives, topics covered, and any other relevant information..."
              rows={4}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Documents Section */}
          {
            <div className="space-y-4">
              <Label>Documents</Label>

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
                      multiple
                      onChange={handleFileInputChange}
                      disabled={isUploading}
                      accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="default"
                      onClick={handleClick}
                      disabled={isUploading}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? "Uploading..." : "Upload"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCourseProcessDialog(true)}
                      className="flex items-center gap-2"
                      title="Process Course Information"
                      disabled={isProcessingCourse}
                    >
                      {isProcessingCourse ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Documents Display Area */}
              <div
                className={cn(
                  "min-h-[200px] rounded-lg",
                  documents.length === 0 ? "border-2 border-dashed" : ""
                )}
              >
                {documentsLoading ? (
                  <div className="p-6">
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                          : "space-y-3"
                      }
                    >
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className={
                            viewMode === "grid"
                              ? "aspect-square bg-muted animate-pulse rounded-lg"
                              : "h-16 bg-muted animate-pulse rounded-lg"
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">
                      {documents.length === 0
                        ? "No documents yet"
                        : "No documents match your filters"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {documents.length === 0
                        ? "Drag and drop files below to get started"
                        : "Try adjusting your search or filters"}
                    </p>
                  </div>
                ) : (
                  <div className="p-4">
                    {viewMode === "grid" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredDocuments.map((doc) => {
                          return (
                            <div
                              key={doc.id}
                              className="group relative border rounded-lg hover:shadow-md transition-all"
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
                                    <SelectItem value="project">
                                      🚀 Project
                                    </SelectItem>
                                    <SelectItem value="quiz">
                                      ❓ Quiz
                                    </SelectItem>
                                    <SelectItem value="midterm">
                                      📊 Midterm
                                    </SelectItem>
                                    <SelectItem value="lab">🧪 Lab</SelectItem>
                                    <SelectItem value="lecture">
                                      📚 Lecture
                                    </SelectItem>
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
                                  onClick={() => {
                                    setDocumentToDelete(doc);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Image area */}
                              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative">
                                {getDocumentIcon(doc.name)}

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
                          return (
                            <div
                              key={doc.id}
                              className="flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all"
                            >
                              <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                                {getDocumentIcon(doc.name)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p
                                  className="font-medium truncate"
                                  title={doc.name}
                                >
                                  {doc.name}
                                </p>
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
                                    <SelectItem value="project">
                                      🚀 Project
                                    </SelectItem>
                                    <SelectItem value="quiz">
                                      ❓ Quiz
                                    </SelectItem>
                                    <SelectItem value="midterm">
                                      📊 Midterm
                                    </SelectItem>
                                    <SelectItem value="lab">🧪 Lab</SelectItem>
                                    <SelectItem value="lecture">
                                      📚 Lecture
                                    </SelectItem>
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
                                  onClick={() => {
                                    setDocumentToDelete(doc);
                                    setShowDeleteDialog(true);
                                  }}
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
            </div>
          }

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex-1 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : mode === "create"
                    ? "Create Class"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] overflow-hidden">
            {selectedDocument && (
              <DocumentViewer document={selectedDocument} bare={true} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
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
              disabled={isDeletingDoc}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                documentToDelete && handleDeleteDocument(documentToDelete.id)
              }
              disabled={isDeletingDoc}
            >
              {isDeletingDoc ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Processing Dialog */}
      <Dialog
        open={showCourseProcessDialog}
        onOpenChange={setShowCourseProcessDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Process Course Information
            </DialogTitle>
            <DialogDescription>
              Extract course information from uploaded documents, especially
              syllabus files.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Warning: This will override existing information
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Course processing will analyze your documents (especially
                  syllabus files) and may update the following fields:
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1 ml-2">
                  <li>Class name and code</li>
                  <li>Course description</li>
                  <li>Year and term</li>
                  <li>Course topics and prerequisites</li>
                  <li>Class schedules and events</li>
                </ul>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This will analyze all documents in this class and extract course
              information using AI. Make sure you have uploaded relevant
              documents (especially a syllabus) before processing.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCourseProcessDialog(false)}
              disabled={isProcessingCourse}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCourseProcessing}
              disabled={isProcessingCourse}
            >
              {isProcessingCourse ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                "Process Course"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
