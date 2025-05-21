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
import { getClasses } from "@/utils/queries/get-classes";
import {
  classes as ClassItem,
  chatProfile as ChatProfile,
} from "@/drizzle/schema";

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
    if (!e.target.files || !selectedProfileType || !selectedClass) {
      toast.error("Please select files, profile type, and class");
      return;
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
      if (files.length > 1) {
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

          // Create a new tus upload
          const upload = new tus.Upload(file, {
            endpoint: `${apiUrl}/documents/tus`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            metadata: {
              filename: file.name,
              filetype: file.type,
              profile: selectedProfileType,
              class: selectedClass, // Using class ID
              fileId: fileId,
            },
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
                const response = await fetch(
                  `${apiUrl}/documents/tus/finalize`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      fileId,
                      profile: selectedProfileType,
                      classId: selectedClass, // Using class ID
                    }),
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

                toast.success(`${file.name} uploaded successfully!`);
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
        const allSuccessful = fileUploads.every(
          (file) => file.status === "complete",
        );

        // Show final toast
        if (allSuccessful) {
          if (files.length > 1) {
            toast.success(`All ${files.length} files uploaded successfully!`);
          }
        } else {
          const failedCount = fileUploads.filter(
            (file) => file.status === "error",
          ).length;
          toast.error(
            `${failedCount} of ${files.length} files failed to upload.`,
          );
        }

        // Reset form
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setSelectedProfileType(""); // Reset profile type
        setSelectedClass(""); // Reset class
        setFileUploads([]);

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["documents"] });

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
        // Dismiss any remaining loading toasts
        toast.dismiss();
      }
    } catch (error) {
      console.error("Upload initialization error:", error);
      toast.error(
        `Upload error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsUploading(false);

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

  // If inline, render just the form controls without card wrapper
  if (inline) {
    return (
      <div className="space-y-4">
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
                <SelectItem value="loading" disabled>
                  No classes available
                </SelectItem>
              ) : (
                classes.map((cls: typeof ClassItem.$inferSelect) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.classCode}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="document-file">Document Files</Label>
          <Input
            id="document-file"
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={!selectedProfileType || !selectedClass || isUploading}
            accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="cursor-pointer"
          />
          {(!selectedProfileType || !selectedClass) && (
            <p className="text-sm text-muted-foreground mt-1">
              Please select a student profile type and class first
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
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
        <CardDescription>
          Upload multiple documents for different student profiles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                <SelectItem value="loading" disabled>
                  No classes available
                </SelectItem>
              ) : (
                classes.map((cls: typeof ClassItem.$inferSelect) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.classCode} - {cls.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="document-file">Document Files</Label>
          <Input
            id="document-file"
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={!selectedProfileType || !selectedClass || isUploading}
            accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="cursor-pointer"
          />
          {(!selectedProfileType || !selectedClass) && (
            <p className="text-sm text-muted-foreground mt-1">
              Please select a student profile type and class first
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
      </CardContent>
    </Card>
  );
}
