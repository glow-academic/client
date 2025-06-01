import React, { useState, useRef } from "react";
import * as tus from "tus-js-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs
import { getClasses } from "@/utils/queries/get-classes";
import { classes as ClassItem } from "@/drizzle/schema";

interface DocumentUploaderProps {
  onUploadComplete?: () => void;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  inline?: boolean;
}

interface FileUploadStatus {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

export default function DocumentUploader({
  onUploadComplete,
  onProgress,
  onError,
  inline = false,
}: DocumentUploaderProps) {
  const [uploadMode, setUploadMode] = useState<"document" | "classList">(
    "document",
  );
  const [selectedProfileType, setSelectedProfileType] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>(""); // Class ID
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [fileUploads, setFileUploads] = useState<FileUploadStatus[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch classes from the API
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadMode === "document") {
      if (!e.target.files || !selectedProfileType || !selectedClass) {
        toast.error(
          "Please select files, profile type, and class for document upload.",
        );
        return;
      }
    } else {
      // uploadMode === 'classList'
      if (!e.target.files || e.target.files.length === 0) {
        toast.error("Please select a CSV file for the class list.");
        return;
      }
      if (e.target.files.length > 1) {
        toast.error("Please upload only one CSV file for the class list.");
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear selection
        return;
      }
      const file = e.target.files[0];
      if (
        !file.name.toLowerCase().endsWith(".csv") &&
        file.type !== "text/csv"
      ) {
        toast.error(
          "Invalid file type. Please upload a CSV file for the class list.",
        );
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear selection
        return;
      }
    }

    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setIsUploading(true);

      // Create initial file upload statuses
      const initialStatuses = files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
        status: "uploading" as const,
      }));

      setFileUploads(initialStatuses);

      // Show toast for multiple files
      let toastId: string | number;
      if (files.length > 1 && uploadMode === "document") {
        toastId = toast.loading(`Uploading ${files.length} files...`);
      } else {
        toastId = toast.loading(`Uploading ${files[0].name}...`);
      }

      // Get the API URL from environment
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

      // Upload each file in parallel
      const uploadPromises = files.map((file, index) => {
        return new Promise<void>((resolve, reject) => {
          // Generate a unique file ID
          const fileId = initialStatuses[index].id;

          const tusMetadata =
            uploadMode === "document"
              ? {
                  filename: file.name,
                  filetype: file.type,
                  profile: selectedProfileType,
                  class: selectedClass, // Using class ID
                  fileId: fileId,
                }
              : {
                  filename: file.name,
                  filetype: file.type, // e.g., 'text/csv'
                  profile: "confused", // Default profile for CSV files
                  class: selectedClass || undefined, // Use undefined instead of empty string
                  uploadType: "classList",
                  fileId: fileId,
                };

          // Create a new tus upload
          const upload = new tus.Upload(file, {
            endpoint: `${apiUrl}/documents/tus`, // Consider if classList needs a different endpoint
            retryDelays: [0, 3000, 5000, 10000, 20000],
            metadata: tusMetadata,
            onError: (error) => {
              console.error(`Failed to upload ${file.name}: `, error);

              // Update file status
              setFileUploads((prev) =>
                prev.map((item) =>
                  item.id === fileId
                    ? {
                        ...item,
                        status: "error" as const,
                        error: error.message || "Unknown error",
                      }
                    : item,
                ),
              );

              toast.error(
                `Failed to upload ${file.name}: ${error.message || "Unknown error"}`,
              );

              // Call onError callback if provided
              if (onError) {
                onError(error);
              }

              reject(error);
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const percentage = Math.round((bytesUploaded / bytesTotal) * 100);

              // Update file status
              setFileUploads((prev) =>
                prev.map((item) =>
                  item.id === fileId ? { ...item, progress: percentage } : item,
                ),
              );

              // Update overall progress
              updateOverallProgress();

              // Call onProgress callback if provided
              if (onProgress) {
                onProgress(percentage);
              }
            },
            onSuccess: async () => {
              // Finalize the upload
              try {
                const finalizePayload =
                  uploadMode === "document"
                    ? {
                        fileId,
                        profile: selectedProfileType,
                        classId: selectedClass, // Using class ID
                      }
                    : {
                        fileId,
                        profile: "confused", // Default profile for CSV files
                        classId: selectedClass || undefined, // Use undefined instead of null for optional field
                        uploadType: "classList",
                      };

                console.log("Finalize payload:", finalizePayload); // Debug log

                const response = await fetch(
                  `${apiUrl}/documents/tus/finalize`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    credentials: "include", // Add credentials
                    body: JSON.stringify(finalizePayload),
                  },
                );

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(
                    errorData.message || "Failed to finalize upload",
                  );
                }

                // Update file status
                setFileUploads((prev) =>
                  prev.map((item) =>
                    item.id === fileId
                      ? { ...item, status: "complete" as const, progress: 100 }
                      : item,
                  ),
                );
                
                if (uploadMode === "document") {
                    toast.success(`${file.name} uploaded successfully!`);
                } else {
                    toast.success(`Class list ${file.name} uploaded successfully!`);
                }
                resolve();
              } catch (error) {
                console.error(`Finalization error for ${file.name}:`, error);

                // Update file status
                setFileUploads((prev) =>
                  prev.map((item) =>
                    item.id === fileId
                      ? {
                          ...item,
                          status: "error" as const,
                          error:
                            error instanceof Error
                              ? error.message
                              : "Unknown error",
                        }
                      : item,
                  ),
                );

                toast.error(
                  `Failed to process ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
                );

                // Call onError callback if provided
                if (onError && error instanceof Error) {
                  onError(error);
                }

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

        // Check if all uploads were successful
        const allSuccessful = fileUploads.every( // Re-check based on latest state
            (f) => fileUploads.find(up => up.id === f.id)?.status === "complete"
        );


        // Show final toast
        if (allSuccessful) {
          if (uploadMode === "document") {
            if (files.length > 1) {
              toast.success(`All ${files.length} files uploaded successfully!`);
            }
            // Single file success already toasted individually
          } else {
            // For classList, individual success toast is already shown.
            // No need for an "All files" toast if it's always one file.
          }
        } else {
          const failedCount = fileUploads.filter( // Re-check based on latest state
            (f) => fileUploads.find(up => up.id === f.id)?.status === "error",
          ).length;
          toast.error(
            `${failedCount} of ${files.length} files failed to upload.`,
          );
        }

        // Reset form
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (uploadMode === "document") {
          setSelectedProfileType(""); 
          setSelectedClass(""); 
        }
        // Consider resetting uploadMode to 'document' if desired
        // setUploadMode('document'); 
        setFileUploads([]);

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        if (uploadMode === "classList") {
          // Invalidate relevant queries for class lists
          queryClient.invalidateQueries({ queryKey: ["users"] });
          queryClient.invalidateQueries({ queryKey: ["classes"] });
          queryClient.invalidateQueries({ queryKey: ["csv-students"] });
        }

        // Call the onUploadComplete callback if provided
        if (onUploadComplete) {
          onUploadComplete();
        }
      } catch (error) {
        console.error("Some uploads failed:", error);
        // Dismiss the loading toast
        toast.dismiss(toastId);
      } finally {
        setIsUploading(false);
        setOverallProgress(0);
        setFileUploads([]);
      }
    } catch (error) {
      console.error("Upload initialization error:", error);
      toast.error(
        `Upload error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsUploading(false);
      setFileUploads([]);

      // Call onError callback if provided
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };

  // Calculate overall progress across all files
  const updateOverallProgress = () => {
    if (fileUploads.length === 0) return;

    const totalProgress = fileUploads.reduce(
      (sum, file) => sum + file.progress,
      0,
    );
    const overallPercent = Math.round(totalProgress / fileUploads.length);

    setOverallProgress(overallPercent);

    // Update toast every 10% to avoid too many updates for multiple files
    if (overallPercent % 10 === 0 || overallPercent === 100) {
      toast.loading(`Uploading files... ${overallPercent}%`);
    }
  };

  const uploaderFormContent = (
    <>
      <Tabs
        value={uploadMode}
        onValueChange={(value) => {
          setUploadMode(value as "document" | "classList");
          if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Clear file input on mode change
          }
          setFileUploads([]); // Clear any previous upload previews
          setOverallProgress(0); // Reset progress
          // Reset form fields when switching modes
          setSelectedProfileType("");
          setSelectedClass("");
        }}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="classList">Class List (CSV)</TabsTrigger>
        </TabsList>
      </Tabs>

      {uploadMode === "document" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="profile-type">Student Profile Type</Label>
            <Select
              value={selectedProfileType}
              onValueChange={(value) => setSelectedProfileType(value)}
              disabled={isUploading}
            >
              <SelectTrigger id="profile-type">
                <SelectValue placeholder="Select profile type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aggressive">Aggressive</SelectItem>
                <SelectItem value="happy">Happy</SelectItem>
                <SelectItem value="confused">Confused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-type">Class</Label>
            <Select
              value={selectedClass}
              onValueChange={(value) => setSelectedClass(value)}
              disabled={isUploading || classesLoading}
            >
              <SelectTrigger id="class-type">
                <SelectValue
                  placeholder={
                    classesLoading ? "Loading classes..." : "Select class"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="no_classes" disabled>
                    No classes available
                  </SelectItem>
                ) : (
                  classes.map((cls: typeof ClassItem.$inferSelect) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.classCode}
                      {inline ? "" : ` - ${cls.name}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {uploadMode === "classList" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="class-type-csv">Class (Optional)</Label>
            <Select
              value={selectedClass}
              onValueChange={(value) => setSelectedClass(value)}
              disabled={isUploading || classesLoading}
            >
              <SelectTrigger id="class-type-csv">
                <SelectValue
                  placeholder={
                    classesLoading ? "Loading classes..." : "Select class (optional)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="no_classes" disabled>
                    No classes available
                  </SelectItem>
                ) : (
                  classes.map((cls: typeof ClassItem.$inferSelect) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.classCode}
                      {inline ? "" : ` - ${cls.name}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!selectedClass && (
              <p className="text-sm text-muted-foreground mt-1">
                Leave unselected to upload without associating to a specific class
              </p>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="document-file">
          {uploadMode === "document"
            ? "Document File(s)"
            : "Class List File (CSV)"}
        </Label>
        <Input
          id="document-file"
          ref={fileInputRef}
          type="file"
          multiple={uploadMode === "document"}
          onChange={handleFileUpload}
          disabled={
            isUploading ||
            (uploadMode === "document"
              ? !selectedProfileType || !selectedClass
              : false) // CSV upload doesn't require class selection
          }
          accept={
            uploadMode === "document"
              ? "application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              : ".csv,text/csv"
          }
          className="cursor-pointer"
        />
        {uploadMode === "document" &&
          (!selectedProfileType || !selectedClass) && (
            <p className="text-sm text-muted-foreground mt-1">
              Please select a student profile type and class first for document
              upload.
            </p>
          )}
        {uploadMode === "classList" && (
          <p className="text-sm text-muted-foreground mt-1">
            Select a single CSV file containing the class list.
          </p>
        )}
      </div>

      {isUploading && fileUploads.length > 0 && !onProgress && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              Overall Progress
            </span>
            <span className="text-sm font-medium">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />

          {/* Individual file progress */}
          <div className="mt-4 space-y-3">
            {fileUploads.map((file) => (
              <div key={file.id} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="truncate max-w-[250px]" title={file.name}>
                    {file.name}
                  </span>
                  <span
                    className={
                      file.status === "complete"
                        ? "text-green-500"
                        : file.status === "error"
                          ? "text-red-500"
                          : ""
                    }
                  >
                    {file.status === "complete"
                      ? "Complete"
                      : file.status === "error"
                        ? "Failed"
                        : `${file.progress}%`}
                  </span>
                </div>
                <Progress
                  value={file.progress}
                  className={`h-1 ${
                    file.status === "complete"
                      ? "bg-green-100"
                      : file.status === "error"
                        ? "bg-red-100"
                        : ""
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // If inline, render just the form controls without card wrapper
  if (inline) {
    return <div className="space-y-4">{uploaderFormContent}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Content</CardTitle>
        <CardDescription>
          {uploadMode === "document"
            ? "Upload documents for different student profiles and classes."
            : "Upload a CSV file containing class list information."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{uploaderFormContent}</CardContent>
    </Card>
  );
}
