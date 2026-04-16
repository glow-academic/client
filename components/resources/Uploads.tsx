/**
 * Uploads.tsx
 * Resource component for file uploads
 * Handles file upload via dropzone, creates files_resource entries
 * Uses GenericPicker to select existing uploads
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

type FlushResult = { files_id: string | null } | void;

type CreateDraftUploadsIn = {
  body: {
    agent_id?: string;
    upload_id: string;
    mcp?: boolean;
    tool_id?: string;
  };
};
type CreateDraftUploadsOut = { files_id?: string | null };

export interface UploadResourceItem {
  files_id?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  upload_id?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
  suggested?: boolean | null;
}

export interface UploadsProps {
  upload_ids?: string[]; // Current files_resource IDs (standardized prop name)
  upload_resources?: UploadResourceItem[]; // Selected upload resources
  show_uploads?: boolean; // Whether to show this resource picker
  upload_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  uploads?: UploadResourceItem[]; // All available uploads from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update upload_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createUploadsAction?:
    | ((input: CreateDraftUploadsIn) => Promise<CreateDraftUploadsOut>)
    | undefined;
  /** Artifact-scoped base path for upload/download URLs (e.g., "/document") */
  uploadBasePath?: string;
  /** Server action to upload a file — receives FormData, returns upload_id */
  uploadFileAction?: (formData: FormData) => Promise<{
    success: boolean;
    upload_id?: string;
    message?: string;
  }>;
  searchTerm?: string;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
  /** Called after TUS finalize when autosave is enabled — reports upload_id for server-side chain creation */
  onFileUploadComplete?: (uploadId: string) => void;
}

export function Uploads({
  upload_ids,
  upload_resources,
  show_uploads = true,
  upload_suggestions,
  uploads,
  disabled = false,
  onChange,
  label = "Files",
  id = "uploads",
  required = false,
  placeholder = "Select files...",
  description,
  group_id,
  create_tool_id,
  createUploadsAction,
  uploadBasePath: _uploadBasePath,
  uploadFileAction,
  searchTerm = "",
  isAutosaveEnabled = true,
  registerFlush,
  onFileUploadComplete,
}: UploadsProps) {
  const ids = useMemo(() => upload_ids ?? [], [upload_ids]);
  const show = show_uploads ?? true;
  const allUploads = useMemo(() => uploads ?? [], [uploads]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(
    () => allUploads.filter((u) => u.pending),
    [allUploads]
  );
  const pendingIds = useMemo(
    () =>
      new Set(
        pendingItems
          .map((u) => u.files_id ?? u.upload_id)
          .filter(Boolean) as string[]
      ),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

  const suggestionsList = useMemo(
    () => upload_suggestions ?? [],
    [upload_suggestions]
  );

  // File upload state
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

  // Track which upload IDs have already had resources created
  const createdUploadIdsRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<FlushResult>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<FlushResult> => {
    // For Uploads, the flush returns the last created upload ID
    // File uploads happen immediately, so just return the latest ID if available
    if (!group_id) {
      return;
    }
    const lastId: string | null = ids.length > 0 ? (ids[ids.length - 1] ?? null) : null;
    return { files_id: lastId };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Initialize createdUploadIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdUploadIdsRef.current.add(id));
  }, [ids]);

  // Convert uploads array to items format for GenericPicker
  const uploadItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allUploads
      .filter((u) => u.files_id && u.file_path)
      .filter((u) => {
        if (!term) return true;
        const filePath = u.file_path ?? "";
        const fileName = filePath.split("/").pop() || "";
        const mimeType = u.mime_type ?? "";
        const uploadId = u.upload_id ?? "";
        return (
          fileName.toLowerCase().includes(term) ||
          filePath.toLowerCase().includes(term) ||
          mimeType.toLowerCase().includes(term) ||
          uploadId.toLowerCase().includes(term)
        );
      })
      .map((u) => ({
        id: u.files_id!,
        name: u.file_path!.split("/").pop() || "Unknown file",
        description: u.mime_type || undefined,
      }));
  }, [allUploads, searchTerm]);

  // Check if an upload is suggested (from suggestions list or suggested field on resource)
  const isSuggested = useCallback(
    (uploadsId: string) => {
      if (suggestionsList.includes(uploadsId)) return true;
      const upload = allUploads.find((u) => u.files_id === uploadsId);
      return upload?.suggested === true;
    },
    [suggestionsList, allUploads]
  );

  // Handle file upload via server action
  const uploadFile = useCallback(
    async (file: File) => {
      if (
        !uploadFileAction ||
        (!isAutosaveEnabled && (!createUploadsAction || !group_id))
      ) {
        toast.error("Upload functionality not available");
        return;
      }

      const fileId = uuidv4();
      const toastId = toast.loading(`Uploading ${file.name}...`, {
        description: `${Math.round((file.size / 1024 / 1024) * 100) / 100} MB`,
        dismissible: true,
      });

      setActiveUploads((prev) =>
        new Map(prev).set(fileId, {
          file,
          progress: 0,
          toastId: toastId as string,
          status: "uploading",
        })
      );

      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadFileAction(formData);

        if (!result.success || !result.upload_id) {
          throw new Error(result.message || "Upload failed");
        }

        const databaseUploadId = result.upload_id;

        if (isAutosaveEnabled && onFileUploadComplete) {
          onFileUploadComplete(databaseUploadId);
        } else if (createUploadsAction) {
          const createResult = (await createUploadsAction({
            body: {
              agent_id: "",
              upload_id: databaseUploadId,
              mcp: false,
              ...(create_tool_id ? { tool_id: create_tool_id } : {}),
            },
          })) as CreateDraftUploadsOut;

          if (!createResult.files_id) {
            throw new Error("Failed to create files resource");
          }

          const uploadsResourceId = createResult.files_id;
          createdUploadIdsRef.current.add(uploadsResourceId);
          onChange([...ids, uploadsResourceId]);
        }

        toast.success(`Upload completed: ${file.name}!`, {
          description: "File uploaded successfully",
          id: toastId,
        });

        setActiveUploads((prev) => {
          const newMap = new Map(prev);
          const upload = newMap.get(fileId);
          if (upload) {
            newMap.set(fileId, { ...upload, status: "completed" });
          }
          return newMap;
        });

        setTimeout(() => {
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
          });
        }, 2000);
      } catch (error) {
        toast.error(`Upload failed: ${file.name}`, {
          description:
            error instanceof Error ? error.message : "An error occurred",
          id: toastId,
        });
        setActiveUploads((prev) => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }
    },
    [
      uploadFileAction,
      createUploadsAction,
      group_id,
      ids,
      onChange,
      create_tool_id,
      isAutosaveEnabled,
      onFileUploadComplete,
    ]
  );

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        acceptedFiles.forEach((file) => {
          uploadFile(file);
        });
      }
    },
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
      "application/zip": [".zip"],
      "text/html": [".html"],
    },
    multiple: true,
    disabled: disabled || activeUploads.size > 0,
  });

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdUploadIdsRef.current.has(id)
      );

      // Create resources for newly selected uploads (if needed)
      // Note: If uploads_resource already exists, we can just use it
      // This is mainly for backward compatibility or manual selection
      if (
        newlySelected.length > 0 &&
        createUploadsAction &&
        group_id
      ) {
        // For existing uploads, we might need to create resources
        // But typically they should already exist
        // Just update selection
        onChange(selectedIds);
      } else {
        onChange(selectedIds);
      }
    },
    [ids, createUploadsAction, group_id, onChange]
  );

  // Accept pending — pending items are already in selection, no-op
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
  }, []);

  // Reject pending — remove pending IDs from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  if (!show) {
    return null;
  }

  const hasActiveUploads = activeUploads.size > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label
            htmlFor={id}
            className={cn(
              required &&
                "after:content-['*'] after:ml-0.5 after:text-destructive"
            )}
          >
            {label}
          </Label>
          {description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground text-sm cursor-help">
                    (i)
                  </span>
                </TooltipTrigger>
                <TooltipContent>{description}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>

      {/* File upload dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed",
          hasActiveUploads && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop files here"
            : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Images, Word, Text, HTML, ZIP
        </p>
      </div>

      {/* Active uploads progress */}
      {activeUploads.size > 0 && (
        <div className="space-y-2">
          {Array.from(activeUploads.values()).map((upload) => (
            <div
              key={upload.toastId}
              className="flex items-center gap-2 p-2 bg-muted rounded"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {upload.file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {upload.progress}%
                  </span>
                </div>
                {upload.status === "finalizing" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Finalizing...
                  </p>
                )}
              </div>
              {upload.status === "completed" && (
                <Check className="h-4 w-4 text-green-500" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload picker */}
      {uploadItems.length > 0 && (
        <GenericPicker
          items={uploadItems}
          selectedIds={ids}
          onSelect={handleSelect}
          multiSelect={true}
          getId={(item) => item.id}
          getLabel={(item) => item.name}
          getSearchText={(item) =>
            `${item.name} ${item.description ?? ""}`.trim()
          }
          renderItem={(item, isSelected) => {
            const isPending = pendingIds.has(item.id);
            return (
              <div
                className={cn(
                  "flex items-center justify-between w-full",
                  isSelected && !isPending && "ring-2 ring-primary bg-accent",
                  isPending && "ring-2 ring-success bg-success/10"
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Pending badge */}
                  {isPending && (
                    <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                      Pending
                    </span>
                  )}
                  {/* Suggested dot — only when not selected and not pending */}
                  {isSuggested(item.id) && !isSelected && !isPending && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top">Suggested</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
                {/* Check icon — only when selected and not pending */}
                {isSelected && !isPending && (
                  <Check className="ml-auto flex-shrink-0 h-4 w-4 opacity-100" />
                )}
              </div>
            );
          }}
          placeholder={placeholder}
          disabled={disabled || hasActiveUploads}
          hideSelectedChips={false}
          showClearAll={true}
        />
      )}
    </div>
  );
}
