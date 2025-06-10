/**
 * NewClass.tsx
 * Used to display the new class page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as tus from "tus-js-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Archive, CheckCircle, Loader2 } from "lucide-react";

import { createClass } from "@/utils/mutations/classes/create-class";
import ClassForm from "@/components/common/class/ClassForm";

type ProcessingStep =
  | "idle"
  | "uploading"
  | "extracting"
  | "classifying"
  | "complete";
type CreationMode = "selection" | "manual" | "zip";

interface FileUploadStatus {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

export default function NewClass() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [creationMode, setCreationMode] = useState<CreationMode>("selection");
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedFiles, setExtractedFiles] = useState<string[]>([]);
  const [classifiedDocs, setClassifiedDocs] = useState<any[]>([]);
  const [createdClassId, setCreatedClassId] = useState<string | null>(null);
  const [fileUploads, setFileUploads] = useState<FileUploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleZipUpload = async (file: File) => {
    try {
      setProcessingStep("uploading");
      setIsUploading(true);

      // use the file name as the class name
      const className = file.name.split(".")[0];

      // try to find numeric codes for the class code in the class name
      const classCode = className.match(/\d+/);

      // First create a temporary class for the ZIP upload
      const tempClassResult = await createClass({
        name: className,
        classCode: classCode ? classCode[0] : className,
        year: new Date().getFullYear(),
        term: "fall",
        description: "Make changes to this class description",
      });

      const tempClassId = tempClassResult.id;
      setCreatedClassId(tempClassId);

      // Create file upload status
      const fileUploadStatus: FileUploadStatus = {
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
        status: "uploading",
      };

      setFileUploads([fileUploadStatus]);

      // Show loading toast
      const toastId = toast.loading(`Uploading ${file.name}...`);

      // Get the API URL from environment
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

      // Upload the ZIP file using tus
      await new Promise<void>((resolve, reject) => {
        const tusMetadata = {
          filename: file.name,
          filetype: file.type,
          class: tempClassId,
          fileId: fileUploadStatus.id,
          zip: "true",
          autoClassify: "true",
          autoCourseProcess: "true",
        };

        const upload = new tus.Upload(file, {
          endpoint: `${apiUrl}/documents/tus`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          metadata: tusMetadata,
          onError: (error) => {
            console.error(`Failed to upload ${file.name}: `, error);
            setFileUploads((prev) =>
              prev.map((item) =>
                item.id === fileUploadStatus.id
                  ? {
                      ...item,
                      status: "error",
                      error: error.message || "Unknown error",
                    }
                  : item,
              ),
            );
            toast.dismiss(toastId);
            toast.error(
              `Failed to upload ${file.name}: ${error.message || "Unknown error"}`,
            );
            reject(error);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            setUploadProgress(percentage);
            setFileUploads((prev) =>
              prev.map((item) =>
                item.id === fileUploadStatus.id
                  ? { ...item, progress: percentage }
                  : item,
              ),
            );
          },
          onSuccess: async () => {
            try {
              setProcessingStep("extracting");

              const finalizePayload = {
                fileId: fileUploadStatus.id,
                classId: tempClassId,
                zip: true,
                autoClassify: true,
                autoCourseProcess: true,
              };

              const response = await fetch(`${apiUrl}/documents/tus/finalize`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify(finalizePayload),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                  errorData.message || "Failed to finalize upload",
                );
              }

              setFileUploads((prev) =>
                prev.map((item) =>
                  item.id === fileUploadStatus.id
                    ? { ...item, status: "complete", progress: 100 }
                    : item,
                ),
              );

              toast.dismiss(toastId);
              toast.success(
                `${file.name} uploaded and processed successfully!`,
              );

              setProcessingStep("complete");

              // Route to the status page
              setTimeout(() => {
                router.push(`/classes/new/c/${tempClassId}`);
              }, 1000);

              resolve();
            } catch (error) {
              console.error(`Finalization error for ${file.name}:`, error);
              setFileUploads((prev) =>
                prev.map((item) =>
                  item.id === fileUploadStatus.id
                    ? {
                        ...item,
                        status: "error",
                        error:
                          error instanceof Error
                            ? error.message
                            : "Unknown error",
                      }
                    : item,
                ),
              );
              toast.dismiss(toastId);
              toast.error(
                `Failed to process ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
              reject(error);
            }
          },
        });

        upload.start();
      });
    } catch (error) {
      console.error("ZIP upload error:", error);
      toast.error(
        `Failed to upload ZIP: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setProcessingStep("idle");
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualCreate = () => {
    setCreationMode("manual");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/zip") {
      handleZipUpload(file);
    } else {
      toast.error("Please select a ZIP file");
    }
  };

  const getProcessingMessage = () => {
    switch (processingStep) {
      case "uploading":
        return `Uploading ZIP file... ${uploadProgress}%`;
      case "extracting":
        return "Extracting and processing files from ZIP...";
      case "classifying":
        return "Classifying documents with AI...";
      case "complete":
        return "Processing complete! Redirecting...";
      default:
        return "";
    }
  };

  const getProcessingProgress = () => {
    switch (processingStep) {
      case "uploading":
        return uploadProgress;
      case "extracting":
        return 100;
      case "classifying":
        return 100;
      case "complete":
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen py-4 px-4">
      <div className="w-full">
        {/* Processing Status Bar */}
        {processingStep !== "idle" && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {getProcessingMessage()}
                </p>
                <Progress
                  value={getProcessingProgress()}
                  className="h-2 mt-2"
                />
              </div>
            </div>

            {fileUploads.length > 0 && (
              <div className="text-xs text-blue-700 dark:text-blue-300">
                Processing: {fileUploads[0].name}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {creationMode === "selection" && processingStep === "idle" && (
          <>
            {/* Method Selection Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* ZIP Upload Option */}
              <Card
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="p-8 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Archive className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Upload from ZIP</h3>
                    <p className="text-muted-foreground">
                      Upload a ZIP file containing all your class materials.
                      We'll automatically extract and classify your documents.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </CardContent>
              </Card>

              {/* Manual Creation Option */}
              <Card
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50"
                onClick={handleManualCreate}
              >
                <CardContent className="p-8 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center">
                    <Plus className="h-8 w-8 text-secondary-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Create Manually</h3>
                    <p className="text-muted-foreground">
                      Set up your class first and add documents later. Perfect
                      if you want to organize everything step by step.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Manual Creation Form */}
        {creationMode === "manual" && (
          <ClassForm
            mode="create"
            onSuccess={(classId) => {
              router.push(`/classes/c/${classId}/edit`);
            }}
          />
        )}

        {/* Processing Complete State */}
        {processingStep === "complete" && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">ZIP Uploaded Successfully!</h2>
            <p className="text-muted-foreground">
              Your files are being processed and classified...
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <Button
                onClick={() => router.push(`/classes/new/c/${createdClassId}`)}
              >
                View Processing Status
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
