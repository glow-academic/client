"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";

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
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Class, Document, DocumentType, Scenario } from "@/types";
import { deleteDocument } from "@/utils/api/documents/delete-document";
import { finalizeDocumentUpload } from "@/utils/api/documents/finalize-document-upload";
import { logError } from "@/utils/logger";
import { createClass } from "@/utils/mutations/classes/create-class";
import { updateClass } from "@/utils/mutations/classes/update-class";
import { updateDocument } from "@/utils/mutations/documents/update-document";
import { getClass } from "@/utils/queries/classes/get-class";
import { getDocumentsByClass } from "@/utils/queries/documents/get-documents-by-class";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import {
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
import { v4 as uuidv4 } from "uuid";

// A new type to represent a document that is either saved or new
type EditableDocument =
  | Document
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      name: string;
      type: DocumentType;
      file: File; // The actual File object
      url: string; // A temporary object URL for local previews
    };

interface FormErrors {
  name?: string;
  classCode?: string;
  year?: string;
  term?: string;
  description?: string;
  documentIds?: string[];
}

interface FormData {
  id?: string;
  name?: string;
  classCode?: string;
  year?: number;
  term?: string;
  description?: string;
  documentIds?: string[];
}

export interface ClassFormProps {
  classId?: string;
}

export default function ClassForm({ classId }: ClassFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const editMode = !!classId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      classCode: "",
      year: new Date().getFullYear(),
      term: "fall",
      description: "",
      documentIds: [],
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();

  // --- MODIFIED STATE MANAGEMENT ---
  const [editedDocuments, setEditedDocuments] = useState<EditableDocument[]>(
    []
  );
  const [originalDocuments, setOriginalDocuments] = useState<
    EditableDocument[]
  >([]);
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]);

  // Document management state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Upload state (simplified since we're not uploading immediately)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: classData, isLoading: isLoadingClass } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId!),
    enabled: editMode,
  });

  // Fetch documents for this class
  const { data: documents, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["documents", classId],
    queryFn: () => getDocumentsByClass([classId!]),
    enabled: editMode,
  });

  // Fetch scenarios to check for impact
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
    enabled: editMode, // Only fetch when in edit mode
  });

  // --- MODIFIED: Initialize or reset the local document state ---
  const resetFormState = useCallback(() => {
    if (documents) {
      setEditedDocuments(documents);
      setOriginalDocuments(documents);
      setDocumentsToDelete([]);
    }
  }, [documents]);

  useEffect(() => {
    // When the fetched documents change, reset the local state
    resetFormState();
  }, [resetFormState]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!editMode || !formData || !originalFormData) return false;

    const current = formData;
    const original = originalFormData;

    // Check basic form fields
    const formFieldsChanged =
      current.name !== original.name ||
      current.classCode !== original.classCode ||
      current.year !== original.year ||
      current.term !== original.term ||
      current.description !== original.description;

    // Check document changes
    const documentsChanged =
      editedDocuments.length !== originalDocuments.length ||
      documentsToDelete.length > 0 ||
      editedDocuments.some((doc, index) => {
        const originalDoc = originalDocuments[index];
        if (!originalDoc) return true;
        if ("isNew" in doc && doc.isNew) return true;
        return doc.type !== originalDoc.type;
      });

    return formFieldsChanged || documentsChanged;
  }, [
    formData,
    originalFormData,
    editedDocuments,
    originalDocuments,
    documentsToDelete,
    editMode,
  ]);

  // Count scenarios affected by this class
  const affectedScenarios = useMemo(() => {
    if (!editMode || !classId) return [];
    return scenarios.filter(
      (scenario: Scenario) => scenario.classId === classId
    );
  }, [scenarios, classId, editMode]);

  const [errors, setErrors] = useState<FormErrors>({});
  // Update form data when initial data changes
  const isLoading = isLoadingClass || isLoadingDocuments;

  useEffect(() => {
    if (classData && editMode) {
      const classFormData = {
        name: classData.name,
        classCode: classData.classCode,
        year: classData.year,
        term: classData.term,
        description: classData.description,
      };
      setFormData(classFormData);
      setOriginalFormData(classFormData); // Set original data for comparison
    } else if (!editMode) {
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
    }
  }, [classData, editMode, initialFormData]);

  // --- MODIFIED: `handleSubmit` orchestrates all uploads and updates ---
  const handleSubmit = async () => {
    const validationErrors: FormErrors = {};
    if (!formData?.name?.trim()) {
      validationErrors.name = "Class name is required";
    }

    if (!formData?.classCode?.trim()) {
      validationErrors.classCode = "Class code is required";
    }

    if (formData?.year && (formData.year < 2020 || formData.year > 2030)) {
      validationErrors.year = "Year must be between 2020 and 2030";
    }

    if (!formData?.description?.trim()) {
      validationErrors.description = "Description is required";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `${editMode ? "Updating" : "Creating"} class...`
    );

    try {
      let finalClassId = classId;

      // --- Step 1: Create the class if it's new, to get a classId ---
      if (!editMode) {
        const newClass = await createClass(formData as Class);
        if (!newClass?.id) throw new Error("Failed to create class.");
        finalClassId = newClass.id;
        toast.success("Class created, now uploading documents...");
      }

      if (!finalClassId) {
        throw new Error("Cannot upload documents without a class ID.");
      }

      // --- Step 2: Handle all document operations ---
      const newFileUploads = editedDocuments.filter(
        (doc) => "isNew" in doc && doc.isNew
      ) as Extract<EditableDocument, { isNew: true }>[];

      // Create upload promises for new files
      const uploadPromises = newFileUploads.map((doc) => {
        return new Promise<void>((resolve, reject) => {
          const fileId = uuidv4();
          const upload = new tus.Upload(doc.file, {
            endpoint: `/api/upload`,
            retryDelays: [0, 3000, 5000],
            metadata: {
              filename: doc.file.name,
              filetype: doc.file.type,
              class: finalClassId!,
              fileId: fileId,
              ...(doc.file.type === "application/zip" && {
                zip: "true",
                autoClassify: "true",
              }),
            },
            onSuccess: async () => {
              try {
                const isCypress =
                  typeof window !== "undefined" && "Cypress" in window;
                await finalizeDocumentUpload(
                  fileId,
                  finalClassId!,
                  doc.file.type === "application/zip",
                  true,
                  undefined,
                  undefined,
                  isCypress
                );
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            onError: (error) => {
              logError(`Failed to upload ${doc.file.name}: `, error);
              reject(error);
            },
          });
          upload.start();
        });
      });

      // Create deletion promises for marked documents
      const deletePromises = documentsToDelete.map((docId) =>
        deleteDocument(docId)
      );

      // Create update promises for modified documents
      const updatePromises = editedDocuments
        .filter((doc) => !("isNew" in doc)) // Only existing documents
        .map((doc) => {
          const originalDoc = documents?.find((d) => d.id === doc.id);
          if (originalDoc && originalDoc.type !== doc.type) {
            return updateDocument(doc.id, { type: doc.type });
          }
          return null;
        })
        .filter((p) => p !== null);

      // Wait for all document operations to complete
      await Promise.all([
        ...uploadPromises,
        ...deletePromises,
        ...updatePromises,
      ]);

      // --- Step 3: Update class details (if in edit mode) ---
      if (editMode) {
        await updateClass(finalClassId, formData as Class);
      }

      toast.dismiss(toastId);
      toast.success(`Class ${editMode ? "updated" : "created"} successfully!`);

      // --- Step 4: Invalidate queries and navigate ---
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", finalClassId] });
      queryClient.invalidateQueries({ queryKey: ["documents", finalClassId] });

      router.push(`/create/classes`);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(
        `Failed to save class: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      logError(`Error saving class:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClick = () => {
    if (editMode && affectedScenarios.length > 0) {
      setShowUpdateDialog(true);
    } else {
      handleSubmit();
    }
  };

  const handleConfirmUpdate = () => {
    setShowUpdateDialog(false);
    handleSubmit();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateClick();
  };

  // --- MODIFIED: `handleFiles` now only stages files locally ---
  const handleFiles = useCallback((files: FileList) => {
    if (!files || files.length === 0) return;

    // Create temporary document objects for each new file
    const newDocs: EditableDocument[] = Array.from(files).map((file) => ({
      isNew: true,
      id: uuidv4(),
      name: file.name,
      file: file,
      type: "lecture", // A sensible default
      url: URL.createObjectURL(file), // URL for local preview
    }));

    setEditedDocuments((prev) => [...prev, ...newDocs]);
    toast.info(`${newDocs.length} file(s) staged. Save the class to upload.`);
  }, []);

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
    if (!isSubmitting) {
      fileInputRef.current?.click();
    }
  }, [isSubmitting]);

  // --- MODIFIED: Deletion logic now handles both new and existing files ---
  const stageDocumentForDeletion = (docId: string) => {
    const docToRemove = editedDocuments.find((d) => d.id === docId);
    if (!docToRemove) return;

    // If it's an existing document, add its ID to the deletion queue
    if (!("isNew" in docToRemove)) {
      setDocumentsToDelete((prev) => [...prev, docId]);
    }

    // Remove the document from the visible UI state
    setEditedDocuments((prev) => prev.filter((d) => d.id !== docId));
    toast.info(`'${docToRemove.name}' will be deleted on save.`);
  };

  const handleDocumentTypeChange = (docId: string, newType: string) => {
    setEditedDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, type: newType as DocumentType } : doc
      )
    );
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
      const tempDoc: Document = {
        id: document.id,
        name: document.name,
        type: document.type,
        filePath: document.url, // Use filePath instead of url
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        classId: classId || "",
        mimeType: document.file.type,
        classified: false,
        fileId: null,
      };
      setSelectedDocument(tempDoc);
    } else {
      setSelectedDocument(document as Document);
    }
    setShowPreviewModal(true);
  };

  // Filter documents from the *edited* state for rendering
  const filteredDocuments = editedDocuments.filter((doc: EditableDocument) => {
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
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Class Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Class Name *</Label>
            {formData?.name !== undefined && !isLoading ? (
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Introduction to Computer Science"
                className={errors.name ? "border-red-500" : ""}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Class Code */}
          <div className="space-y-2">
            <Label htmlFor="classCode">Class Code *</Label>
            {formData?.classCode !== undefined && !isLoading ? (
              <Input
                id="classCode"
                value={formData.classCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    classCode: e.target.value,
                  }))
                }
                placeholder="e.g., CS101"
                className={errors.classCode ? "border-red-500" : ""}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.classCode && (
              <p className="text-sm text-red-500">{errors.classCode}</p>
            )}
          </div>

          {/* Year and Term */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              {formData?.year !== undefined && !isLoading ? (
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      year:
                        parseInt(e.target.value) || new Date().getFullYear(),
                    }))
                  }
                  min="2020"
                  max="2030"
                  className={errors.year ? "border-red-500" : ""}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {errors.year && (
                <p className="text-sm text-red-500">{errors.year}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="term">Term *</Label>
              {formData?.term !== undefined && !isLoading ? (
                <Select
                  value={formData.term || ""}
                  onValueChange={(value: "fall" | "spring" | "summer") =>
                    setFormData((prev) => ({ ...prev, term: value }))
                  }
                >
                  <SelectTrigger
                    className={errors.term ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fall">Fall</SelectItem>
                    <SelectItem value="spring">Spring</SelectItem>
                    <SelectItem value="summer">Summer</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {errors.term && (
                <p className="text-sm text-red-500">{errors.term}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            {formData?.description !== undefined && !isLoading ? (
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
            ) : (
              <Skeleton className="h-20 w-full" />
            )}
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Documents Section - Show in both create and edit modes */}
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
                    data-testid="file-input"
                    multiple
                    onChange={handleFileInputChange}
                    disabled={isSubmitting}
                    accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleClick}
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isSubmitting ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Documents Display Area */}
            {isLoading ? (
              <Skeleton className="h-[200px] rounded-lg" />
            ) : (
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
                      {editedDocuments.length === 0
                        ? "No documents yet"
                        : "No documents match your filters"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {editedDocuments.length === 0
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
                                  data-testid={`delete-doc-${doc.id}`}
                                  onClick={() => stageDocumentForDeletion(doc.id)}
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
                                  <p
                                    className="font-medium truncate"
                                    title={doc.name}
                                  >
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
                                  data-testid={`delete-doc-${doc.id}`}
                                  onClick={() => stageDocumentForDeletion(doc.id)}
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
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex-1 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/create/classes")}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (editMode && !hasChanges)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editMode ? "Updating..." : "Creating..."}
                  </>
                ) : editMode ? (
                  "Update Class"
                ) : (
                  "Create Class"
                )}
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
              <DocumentViewer
                document={selectedDocument}
                bare={true}
                isFormDocument={selectedDocument.filePath?.startsWith("blob:")}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Class</AlertDialogTitle>
            <AlertDialogDescription>
              This class is currently used by {affectedScenarios.length}{" "}
              scenario{affectedScenarios.length !== 1 ? "s" : ""}:
              <ul className="mt-2 list-disc list-inside">
                {affectedScenarios.map((scenario) => (
                  <li key={scenario.id} className="text-sm">
                    {scenario.name}
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-sm font-medium">
                The class also has {editedDocuments.length} document
                {editedDocuments.length !== 1 ? "s" : ""} associated with it.
                Updating this class will affect all scenarios that use it. Are
                you sure you want to proceed?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "Updating..." : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
