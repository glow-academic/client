import React, { useState, useRef, useCallback } from "react";
import * as tus from "tus-js-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Add document type enum
export type DocumentTypeEnum = 'homework' | 'project' | 'quiz' | 'midterm' | 'lab';

interface DocumentDropzoneProps {
  classId: string;
  onUploadComplete?: () => void;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

interface FileUploadStatus {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

export default function DocumentDropzone({
  classId,
  onUploadComplete,
  onProgress,
  onError,
}: DocumentDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileUploads, setFileUploads] = useState<FileUploadStatus[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [selectedType, setSelectedType] = useState<DocumentTypeEnum>("homework");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFiles = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;

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

      setFileUploads(initialStatuses);

      // Show toast for multiple files
      let toastId: string | number;
      if (fileArray.length > 1) {
        toastId = toast.loading(`Uploading ${fileArray.length} files...`);
      } else {
        toastId = toast.loading(`Uploading ${fileArray[0].name}...`);
      }

      // Get the API URL from environment
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

      // Upload each file in parallel
      const uploadPromises = fileArray.map((file, index) => {
        return new Promise<void>((resolve, reject) => {
          // Generate a unique file ID
          const fileId = initialStatuses[index].id;

          const tusMetadata = {
            filename: file.name,
            filetype: file.type,
            class: classId,
            fileId: fileId,
            documentType: selectedType,
          };

          // Create a new tus upload
          const upload = new tus.Upload(file, {
            endpoint: `${apiUrl}/documents/tus`,
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
                const finalizePayload = {
                  fileId,
                  classId: classId,
                };

                const response = await fetch(
                  `${apiUrl}/documents/tus/finalize`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    credentials: "include",
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
          (f) => fileUploads.find(up => up.id === f.id)?.status === "complete"
        );

        // Show final toast
        if (allSuccessful) {
          if (fileArray.length > 1) {
            toast.success(`All ${fileArray.length} files uploaded successfully!`);
          }
        } else {
          const failedCount = fileUploads.filter(
            (f) => fileUploads.find(up => up.id === f.id)?.status === "error",
          ).length;
          toast.error(
            `${failedCount} of ${fileArray.length} files failed to upload.`,
          );
        }

        // Reset form
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
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
  }, [classId, selectedType, onUploadComplete, onProgress, onError, queryClient]);

  // Calculate overall progress across all files
  const updateOverallProgress = () => {
    if (fileUploads.length === 0) return;

    const totalProgress = fileUploads.reduce(
      (sum, file) => sum + file.progress,
      0,
    );
    const overallPercent = Math.round(totalProgress / fileUploads.length);

    setOverallProgress(overallPercent);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  const removeFile = useCallback((fileId: string) => {
    setFileUploads((prev) => prev.filter((file) => file.id !== fileId));
  }, []);

  return (
    <div className="space-y-4">
      {/* Document Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="dropzone-document-type">Document Type</Label>
        <Select
          value={selectedType}
          onValueChange={(value) => setSelectedType(value as DocumentTypeEnum)}
          disabled={isUploading}
        >
          <SelectTrigger id="dropzone-document-type">
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="homework">📝 Homework</SelectItem>
            <SelectItem value="project">🚀 Project</SelectItem>
            <SelectItem value="quiz">❓ Quiz</SelectItem>
            <SelectItem value="midterm">📊 Midterm</SelectItem>
            <SelectItem value="lab">🧪 Lab</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dropzone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          isUploading && "pointer-events-none opacity-50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          disabled={isUploading}
          accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-2">
          <Upload className={cn(
            "h-10 w-10",
            isDragOver ? "text-primary" : "text-muted-foreground"
          )} />
          <div>
            <p className="text-lg font-medium">
              {isDragOver ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse files
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Supports PDF, images, Word documents, and text files
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && fileUploads.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />

          {/* Individual file progress */}
          <div className="space-y-2">
            {fileUploads.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs",
                        file.status === "complete"
                          ? "text-green-600"
                          : file.status === "error"
                            ? "text-red-600"
                            : "text-muted-foreground"
                      )}>
                        {file.status === "complete"
                          ? "Complete"
                          : file.status === "error"
                            ? "Failed"
                            : `${file.progress}%`}
                      </span>
                      {file.status === "error" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeFile(file.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={file.progress}
                    className={cn(
                      "h-1",
                      file.status === "complete" && "bg-green-100",
                      file.status === "error" && "bg-red-100"
                    )}
                  />
                  {file.error && (
                    <p className="text-xs text-red-600 mt-1">{file.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 