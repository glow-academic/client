/**
 * DocumentUploadButton.tsx
 * Self-contained document upload button with all upload logic
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import UploadClassificationDialog from "@/components/common/documents/UploadClassificationDialog";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { useFinalizeDocumentUpload } from "@/lib/api/v2/hooks/documents";
import { log } from "@/utils/logger";
import { inferMimeFromName } from "@/utils/mime-map";
import { Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

interface DocumentUploadButtonProps {
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
}

export function DocumentUploadButton({
  departmentMapping,
  validDepartmentIds,
}: DocumentUploadButtonProps) {
  const { effectiveProfile } = useProfile();
  const finalizeMutation = useFinalizeDocumentUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [activeUploads, setActiveUploads] = useState<
    Map<
      string,
      {
        file: File;
        progress: number;
        toastId: string;
        status: "uploading" | "finalizing" | "completed" | "error";
      }
    >
  >(new Map());

  // Listen for upload:remove-file events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { fileName: string };
      setPendingFiles((prev) => prev.filter((f) => f.name !== detail.fileName));
    };
    window.addEventListener("upload:remove-file", handler);
    return () => window.removeEventListener("upload:remove-file", handler);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setPendingFiles(Array.from(files));
      setShowUploadDialog(true);
    }
  };

  const uploadFile = async (file: File) => {
    // Create a unique file ID for this upload
    const fileId = uuidv4();

    // Show progress toast for this specific file
    const toastId = toast.loading(`Preparing upload: ${file.name}`, {
      description: "0% complete",
      dismissible: true,
    });

    // Add to active uploads
    setActiveUploads((prev) =>
      new Map(prev).set(fileId, {
        file,
        progress: 0,
        toastId: toastId as string,
        status: "uploading",
      })
    );

    try {
      // Create TUS upload
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const upload = new tus.Upload(file, {
        endpoint: `${appPrefix}/api/v2/documents/upload`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          // if browser didn't set a type, use our inference
          filetype: file.type || inferMimeFromName(file.name),
          fileId: fileId,
        },
        onError: (error) => {
          log.error("upload.tus.failed", {
            message: "Upload failed",
            error,
            context: {
              component: "DocumentUploadButton",
              function: "uploadFile",
            },
          });
          toast.error(`Upload failed: ${file.name}`, {
            description: error.message || "An error occurred during upload",
            id: toastId,
          });

          // Remove from active uploads
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
          });
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);

          // Update progress for this specific upload
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            const upload = newMap.get(fileId);
            if (upload) {
              newMap.set(fileId, {
                ...upload,
                progress,
              });
            }
            return newMap;
          });

          toast.loading(`Uploading ${file.name}... ${progress}%`, {
            description: `${Math.round((bytesUploaded / 1024 / 1024) * 100) / 100} MB / ${Math.round((bytesTotal / 1024 / 1024) * 100) / 100} MB`,
            id: toastId,
            dismissible: true,
          });
        },
        onSuccess: async () => {
          // Update status to finalizing
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            const upload = newMap.get(fileId);
            if (upload) {
              newMap.set(fileId, {
                ...upload,
                status: "finalizing",
              });
            }
            return newMap;
          });

          // Finalize the upload after TUS upload completes
          try {
            // Check if this is a ZIP file
            const isZipFile = file.name.toLowerCase().endsWith(".zip");

            // Auto-classify ZIP files by default
            const shouldAutoClassify = isZipFile;

            // Call finalize using mutation hook
            const result = await finalizeMutation.mutateAsync({
              fileId,
              zip: isZipFile,
              autoClassify: shouldAutoClassify,
              profile_id: effectiveProfile?.id,
            });

            if (result.success) {
              const isZipFile = file.name.toLowerCase().endsWith(".zip");
              const classificationSuccess =
                result.classification_result &&
                "success" in result.classification_result
                  ? result.classification_result.success
                  : false;
              const description = isZipFile
                ? `Extracted ${result.extracted_count || 0} documents${classificationSuccess ? " and auto-classified" : ""}`
                : "File uploaded and processed successfully";

              toast.success(`Upload completed: ${file.name}!`, {
                description,
                id: toastId,
              });

              // Update status to completed
              setActiveUploads((prev) => {
                const newMap = new Map(prev);
                const upload = newMap.get(fileId);
                if (upload) {
                  newMap.set(fileId, {
                    ...upload,
                    status: "completed",
                  });
                }
                return newMap;
              });

              // Remove from active uploads after a delay to show completion
              setTimeout(() => {
                setActiveUploads((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(fileId);
                  return newMap;
                });
              }, 2000);
            } else {
              toast.error(`Upload processing failed: ${file.name}`, {
                description:
                  result.message || "Failed to process uploaded file",
                id: toastId,
              });

              // Remove from active uploads
              setActiveUploads((prev) => {
                const newMap = new Map(prev);
                newMap.delete(fileId);
                return newMap;
              });
            }
          } catch (finalizeError) {
            log.error("upload.finalize.failed", {
              message: "Finalization failed",
              error: finalizeError,
              context: { component: "DocumentUploadButton" },
            });
            toast.error(`Upload processing failed: ${file.name}`, {
              description: "Failed to process uploaded file",
              id: toastId,
            });

            // Remove from active uploads
            setActiveUploads((prev) => {
              const newMap = new Map(prev);
              newMap.delete(fileId);
              return newMap;
            });
          }

          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        },
      });

      // Start the upload
      await upload.start();
    } catch (error) {
      log.error("upload.error", {
        message: "Upload error",
        error,
        context: { component: "DocumentUploadButton" },
      });
      toast.error(`Upload failed: ${file.name}`, {
        description:
          error instanceof Error
            ? error.message
            : "An error occurred during upload",
        id: toastId,
      });

      // Remove from active uploads
      setActiveUploads((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
    }
  };

  const handleUploadClick = () => {
    if (activeUploads.size === 0) {
      fileInputRef.current?.click();
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        disabled={activeUploads.size > 0}
        accept={[
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "application/zip",
          "text/html",
          // Extensions for source files & common texty formats
          ".java,.py,.c,.h,.cpp,.hpp,.cc,.cs,.js,.jsx,.ts,.tsx,.mjs,.cjs,.html,.css,.scss,.md,.json,.yml,.yaml,.xml,.sh,.bash,.zsh,.rb,.go,.rs,.kt,.swift,.m,.mm,.sql,.ipynb",
        ].join(",")}
        className="hidden"
      />
      <Button
        onClick={handleUploadClick}
        size="sm"
        disabled={activeUploads.size > 0}
      >
        <Upload className="h-4 w-4 mr-2" />
        {activeUploads.size > 0 ? "Uploading..." : "Upload Document(s)"}
      </Button>

      {/* Upload classification dialog */}
      {showUploadDialog && (
        <UploadClassificationDialog
          open={showUploadDialog}
          files={pendingFiles}
          onClose={() => {
            setShowUploadDialog(false);
            // Clear dialog local state and allow reselection of same files later
            setPendingFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onConfirm={async () => {
            setShowUploadDialog(false);
            // Kick off uploads with provided classifications
            for (const file of pendingFiles) {
              // Fire without awaiting to allow parallel uploads
              (async () => {
                await uploadFile(file);
              })();
            }
            // Clear state so user can add the same docs again if needed
            setPendingFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onAddFiles={(files) => {
            setPendingFiles((prev) => [...prev, ...files]);
          }}
          onRemoveFile={(fileName) =>
            setPendingFiles((prev) => prev.filter((f) => f.name !== fileName))
          }
          departmentMapping={departmentMapping}
          validDepartmentIds={validDepartmentIds}
        />
      )}
    </>
  );
}
