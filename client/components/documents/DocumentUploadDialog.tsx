/**
 * DocumentUploadDialog.tsx
 * Document upload dialog with all upload logic
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import UploadClassificationDialog from "@/components/documents/UploadClassificationDialog";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { inferMimeFromName } from "@/utils/mime-map";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

type ParameterItemMappingItem = {
  name: string;
  description: string;
};

type ParameterMappingItem = {
  name: string;
  description: string;
};

interface DocumentUploadDialogProps {
  open: boolean;
  onClose: () => void;
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
  parameterItemMapping: Record<string, ParameterItemMappingItem>;
  parameterMapping: Record<string, ParameterMappingItem>;
  validParameterItemIds: string[];
}

export function DocumentUploadDialog({
  open,
  onClose,
  departmentMapping,
  validDepartmentIds,
  parameterItemMapping,
  parameterMapping,
  validParameterItemIds,
}: DocumentUploadDialogProps) {
  const { effectiveProfile } = useProfile();
  const queryClient = useQueryClient();
  const finalizeMutation = useMutation({
    mutationFn: async (req: {
      uploadId: string;
      fileId: string;
      zip?: boolean;
      autoClassify?: boolean;
      csv?: boolean;
      test?: boolean;
      profileId?: string;
      departmentIds?: string[] | null;
      parameterItemIds?: string[];
    }) =>
      api.post("/documents/upload/finalize", {
        body: {
          uploadId: "", // Will be derived from fileId on server
          fileId: req.fileId,
          zip: req.zip || false,
          autoClassify: req.autoClassify || false,
          csv: req.csv || false,
          test: req.test || false,
          profileId: req.profileId || null,
          departmentIds: req.departmentIds || null,
          parameterItemIds: req.parameterItemIds || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.documents.all });
    },
  });
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

  // Auto-trigger file input when dialog opens
  useEffect(() => {
    if (open && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [open]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setPendingFiles(Array.from(files));
      setShowUploadDialog(true);
    } else {
      // User cancelled file selection, close the dialog
      onClose();
    }
  };

  const uploadFile = async (
    file: File,
    classification?: {
      type: string;
      parameterItemIds: string[];
      departmentIds?: string[];
    }
  ) => {
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
              uploadId: "", // Server will find by fileId
              fileId,
              zip: isZipFile,
              autoClassify: shouldAutoClassify,
              profileId: effectiveProfile?.id || "",
              departmentIds: classification?.departmentIds || null,
              parameterItemIds: classification?.parameterItemIds || [],
            });

            if (result.success) {
              const isZipFile = file.name.toLowerCase().endsWith(".zip");
              const classificationSuccess =
                result.documents?.some((doc) => doc["classification_result"]) ??
                false;
              const description = isZipFile
                ? `Extracted ${result.documents?.length || 0} documents${classificationSuccess ? " and auto-classified" : ""}`
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
          } catch {
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
    } catch {
      toast.error(`Upload failed: ${file.name}`, {
        description: "An error occurred during upload",
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
            onClose();
          }}
          onConfirm={async (perFile, defaultsForZip) => {
            setShowUploadDialog(false);
            // Kick off uploads with provided classifications
            for (const file of pendingFiles) {
              // Fire without awaiting to allow parallel uploads
              (async () => {
                // Get classification for this file (or use ZIP defaults)
                const classification = perFile[file.name] || defaultsForZip;
                await uploadFile(file, classification);
              })();
            }
            // Clear state so user can add the same docs again if needed
            setPendingFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            onClose();
          }}
          onAddFiles={(files) => {
            setPendingFiles((prev) => [...prev, ...files]);
          }}
          onRemoveFile={(fileName) =>
            setPendingFiles((prev) => prev.filter((f) => f.name !== fileName))
          }
          departmentMapping={departmentMapping}
          validDepartmentIds={validDepartmentIds}
          parameterItemMapping={Object.fromEntries(
            Object.entries(parameterItemMapping).map(([key, value]) => [
              key,
              { name: value.name, description: value.description },
            ])
          )}
          parameterMapping={Object.fromEntries(
            Object.entries(parameterMapping).map(([key, value]) => [
              key,
              { name: value.name, description: value.description },
            ])
          )}
          validParameterItemIds={validParameterItemIds}
        />
      )}
    </>
  );
}
