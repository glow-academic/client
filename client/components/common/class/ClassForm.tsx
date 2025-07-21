"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import ClassDocuments from "@/components/common/class/ClassDocuments";
import ClassStaff from "@/components/common/class/ClassStaff";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Class,
  Document,
  DocumentType,
  Profile,
  ProfileRole,
  Scenario,
} from "@/types";
import { deleteDocument } from "@/utils/api/documents/delete-document";
import { finalizeDocumentUpload } from "@/utils/api/documents/finalize-document-upload";
import { logError } from "@/utils/logger";
import { createClass } from "@/utils/mutations/classes/create-class";
import { updateClass } from "@/utils/mutations/classes/update-class";
import { updateDocument } from "@/utils/mutations/documents/update-document";
import { createProfile } from "@/utils/mutations/profiles/create-profile";
import { getClass } from "@/utils/queries/classes/get-class";
import { getAllDepartments } from "@/utils/queries/departments/get-all-departments";
import { getDocumentsByClass } from "@/utils/queries/documents/get-documents-by-class";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { getProfilesByClass } from "@/utils/auth/get-profiles-by-class";

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

// A new type to represent a profile that is either saved or new
type EditableProfile =
  | Profile
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      firstName: string;
      lastName: string;
      alias: string;
      role: ProfileRole;
    };

interface FormErrors {
  name?: string;
  classCode?: string;
  year?: string;
  term?: string;
  description?: string;
  documentIds?: string[];
  departmentId?: string;
  profileIds?: string[];
}

interface FormData {
  id?: string;
  name?: string;
  classCode?: string;
  year?: number;
  term?: string;
  description?: string;
  departmentId?: string;
  documentIds?: string[];
  profileIds?: string[];
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
      departmentId: "",
      documentIds: [],
      profileIds: [],
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

  // Profile management state
  const [editedProfiles, setEditedProfiles] = useState<EditableProfile[]>([]);
  const [originalProfiles, setOriginalProfiles] = useState<EditableProfile[]>(
    []
  );
  const [profilesToDelete, setProfilesToDelete] = useState<string[]>([]);

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

  // Fetch profiles for this class
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles", classId],
    queryFn: () => getProfilesByClass(classId!),
    enabled: editMode,
  });

  // Fetch scenarios to check for impact
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
    enabled: editMode, // Only fetch when in edit mode
  });

  // Fetch departments for the department selector
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getAllDepartments(),
  });

  // --- MODIFIED: Initialize or reset the local document and profile state ---
  const resetFormState = useCallback(() => {
    if (documents) {
      setEditedDocuments(documents);
      setOriginalDocuments(documents);
      setDocumentsToDelete([]);
    }
    if (profiles) {
      setEditedProfiles(profiles);
      setOriginalProfiles(profiles);
      setProfilesToDelete([]);
    }
  }, [documents, profiles]);

  useEffect(() => {
    // When the fetched documents or profiles change, reset the local state
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
      current.description !== original.description ||
      current.departmentId !== original.departmentId;

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

    // Check profile changes
    const profilesChanged =
      editedProfiles.length !== originalProfiles.length ||
      profilesToDelete.length > 0 ||
      editedProfiles.some((profile, index) => {
        const originalProfile = originalProfiles[index];
        if (!originalProfile) return true;
        if ("isNew" in profile && profile.isNew) return true;
        return profile.role !== originalProfile.role;
      });

    return formFieldsChanged || documentsChanged || profilesChanged;
  }, [
    formData,
    originalFormData,
    editedDocuments,
    originalDocuments,
    documentsToDelete,
    editedProfiles,
    originalProfiles,
    profilesToDelete,
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
  const isLoading = isLoadingClass || isLoadingDocuments || isLoadingProfiles;

  useEffect(() => {
    if (classData && editMode) {
      const classFormData = {
        name: classData.name,
        classCode: classData.classCode,
        departmentId: classData.departmentId,
        year: classData.year,
        term: classData.term,
        description: classData.description,
        profileIds: classData.profileIds,
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

    if (!formData?.departmentId?.trim()) {
      validationErrors.departmentId = "Department is required";
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
        toast.success(
          "Class created, now uploading documents and managing profiles..."
        );
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

      // --- Step 3: Handle all profile operations ---
      const newProfileUploads = editedProfiles.filter(
        (profile) => "isNew" in profile && profile.isNew
      ) as Extract<EditableProfile, { isNew: true }>[];

      // Create profile promises for new profiles
      const createProfilePromises = newProfileUploads.map((profile) =>
        createProfile({
          firstName: profile.firstName,
          lastName: profile.lastName,
          alias: profile.alias,
          role: profile.role,
        })
      );

      // Wait for all document and profile operations to complete
      await Promise.all([
        ...uploadPromises,
        ...deletePromises,
        ...updatePromises,
        ...createProfilePromises,
      ]);

      // --- Step 4: Update class details (if in edit mode) ---
      if (editMode) {
        await updateClass(finalClassId, formData as Class);
      }

      toast.dismiss(toastId);
      toast.success(`Class ${editMode ? "updated" : "created"} successfully!`);

      // --- Step 5: Invalidate queries and navigate ---
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", finalClassId] });
      queryClient.invalidateQueries({ queryKey: ["documents", finalClassId] });
      queryClient.invalidateQueries({ queryKey: ["profiles", finalClassId] });

      router.push(`/classes`);
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

          {/* Department and Class Code */}
          <div className="flex items-center gap-4 w-auto">
            <div className="space-y-2 flex-shrink-0">
              <Label htmlFor="department">Department *</Label>
              {formData?.departmentId !== undefined && !isLoading ? (
                <Select
                  value={formData.departmentId || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, departmentId: value }))
                  }
                >
                  <SelectTrigger
                    className={errors.departmentId ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name} ({department.departmentCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {errors.departmentId && (
                <p className="text-sm text-red-500">{errors.departmentId}</p>
              )}
            </div>

            <div
              className={`space-y-2 ${formData?.classCode !== undefined && !isLoading ? "pb-2" : ""}`}
              style={{ minWidth: 120 }}
            >
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
                  placeholder="e.g., 101"
                  className={errors.classCode ? "border-red-500" : ""}
                  style={{ width: 100 }}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {errors.classCode && (
                <p className="text-sm text-red-500">{errors.classCode}</p>
              )}
            </div>
          </div>

          {/* Term and Year */}
          <div className="flex items-center gap-4 w-auto">
            <div className="space-y-2 flex-shrink-0">
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

            <div
              className={`space-y-2 ${formData?.year !== undefined && !isLoading ? "pb-2" : ""}`}
              style={{ minWidth: 120 }}
            >
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
                  style={{ width: 100 }}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {errors.year && (
                <p className="text-sm text-red-500">{errors.year}</p>
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

          {/* Documents Section */}
          <ClassDocuments
            classId={classId}
            documents={editedDocuments}
            setDocuments={setEditedDocuments}
            documentsToDelete={documentsToDelete}
            setDocumentsToDelete={setDocumentsToDelete}
            isLoading={isLoading}
            isSubmitting={isSubmitting}
          />

          {/* Staff Section */}
          <ClassStaff
            profiles={editedProfiles}
            setProfiles={setEditedProfiles}
            profilesToDelete={profilesToDelete}
            setProfilesToDelete={setProfilesToDelete}
            isLoading={isLoading}
            isSubmitting={isSubmitting}
          />

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex-1 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/classes")}
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
