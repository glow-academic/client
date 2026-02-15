/**
 * Uploads.tsx
 * Resource component for file uploads
 * Handles file upload via dropzone, creates uploads_resource entries
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import { inferMimeFromName } from "@/utils/mime-map";
import { Check, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

type FlushResult = { uploads_id: string | null } | void;

type CreateDraftUploadsIn = InputOf<"/api/v4/resources/uploads", "post">;
type CreateDraftUploadsOut = OutputOf<"/api/v4/resources/uploads", "post">;

// Derive resource item type from the GET endpoint response
type UploadGetResponse = OutputOf<"/api/v4/resources/uploads/get", "post">;
export type UploadResourceItem = NonNullable<UploadGetResponse["items"]>[number];

export interface UploadsProps {
  upload_ids?: string[]; // Current uploads_resource IDs (standardized prop name)
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
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  finalizeUploadAction?: (uploadId: string) => Promise<{
    success: boolean;
    upload_id?: string;
    message?: string;
  }>;
  searchTerm?: string;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
  // AI diff view props
  aiUploadResources?: Array<{ id?: string | null; file_path?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  onGenerate,
  isGenerating: _isGenerating = false,
  showAiGenerate = false,
  finalizeUploadAction,
  searchTerm = "",
  isAutosaveEnabled: _isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props (deprecated — kept for interface compat)
  aiUploadResources: _aiUploadResources,
  onAccept: _onAccept,
  onReject: _onReject,
}: UploadsProps) {
  const ids = useMemo(() => upload_ids ?? [], [upload_ids]);
  const show = show_uploads ?? true;
  const allUploads = useMemo(() => uploads ?? [], [uploads]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<{
    id: string | null;
    file_path: string | null;
  }>({
    resourceType: "uploads",
    groupId: group_id,
    extractSuggestion: (data) => {
      const id = data["id"] as string | null | undefined;
      const file_path = data["file_path"] as string | null | undefined;
      if (!id) return null;
      return { id, file_path: file_path ?? null };
    },
    accumulate: true,
  });
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
    // Return the most recently added ID, or null if no uploads
    const lastId = ids.length > 0 ? ids[ids.length - 1] : null;
    return { uploads_id: lastId };
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
      .filter((u) => u.uploads_id && u.file_path)
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
        id: u.uploads_id!,
        name: u.file_path!.split("/").pop() || "Unknown file",
        description: u.mime_type || undefined,
      }));
  }, [allUploads, searchTerm]);

  // Check if an upload is suggested
  const isSuggested = useCallback(
    (uploadsId: string) => suggestionsList.includes(uploadsId),
    [suggestionsList]
  );

  // Handle file upload
  const uploadFile = useCallback(
    async (file: File) => {
      if (!finalizeUploadAction || !createUploadsAction || !group_id) {
        toast.error("Upload functionality not available");
        return;
      }

      const fileId = uuidv4();
      const toastId = toast.loading(`Preparing upload: ${file.name}`, {
        description: "0% complete",
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

      let tusUploadInstance: tus.Upload | null = null;
      try {
        tusUploadInstance = new tus.Upload(file, {
          endpoint: `/api/resources/uploads/upload`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          metadata: {
            filename: file.name,
            filetype: file.type || inferMimeFromName(file.name),
            fileId: fileId,
          },
          onError: (error) => {
            toast.error(`Upload failed: ${file.name}`, {
              description: error.message || "An error occurred during upload",
              id: toastId,
            });
            setActiveUploads((prev) => {
              const newMap = new Map(prev);
              newMap.delete(fileId);
              return newMap;
            });
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
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

            try {
              const uploadUrl = tusUploadInstance?.url || "";
              const tusUploadIdMatch = uploadUrl.match(/\/upload\/([^\/]+)/);
              if (!tusUploadIdMatch || !tusUploadIdMatch[1]) {
                throw new Error("Failed to extract upload ID from upload URL");
              }
              const tusUploadId = tusUploadIdMatch[1];

              // Finalize upload to get database upload_id
              const finalizeResult = await finalizeUploadAction(tusUploadId);

              if (!finalizeResult.success || !finalizeResult.upload_id) {
                throw new Error(
                  finalizeResult.message || "Failed to finalize upload"
                );
              }

              const databaseUploadId = finalizeResult.upload_id;

              // Create uploads_resource entry
              // Note: agent_id is deprecated, server now routes via tool_id
              const createResult = await createUploadsAction({
                body: {
                  agent_id: "",
                  group_id: group_id,
                  upload_id: databaseUploadId,
                  mcp: false,
                },
              });

              if (!createResult.uploads_id) {
                throw new Error("Failed to create uploads resource");
              }

              const uploadsResourceId = createResult.uploads_id;
              createdUploadIdsRef.current.add(uploadsResourceId);

              // Add to selection
              onChange([...ids, uploadsResourceId]);

              toast.success(`Upload completed: ${file.name}!`, {
                description: "File uploaded successfully",
                id: toastId,
              });

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

              // Remove completed upload from state after delay
              setTimeout(() => {
                setActiveUploads((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(fileId);
                  return newMap;
                });
              }, 2000);
            } catch (error) {
              toast.error(`Upload processing failed: ${file.name}`, {
                description:
                  error instanceof Error
                    ? error.message
                    : "Failed to process uploaded file",
                id: toastId,
              });
              setActiveUploads((prev) => {
                const newMap = new Map(prev);
                newMap.delete(fileId);
                return newMap;
              });
            }
          },
        });

        await tusUploadInstance.start();
      } catch {
        toast.error(`Upload failed: ${file.name}`, {
          description: "An error occurred during upload",
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
      finalizeUploadAction,
      createUploadsAction,
      group_id,
      ids,
      onChange,
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

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;

  // Accept AI suggestion - add AI-suggested uploads to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((u) => u.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    acceptAi();
  }, [aiSuggestions, ids, onChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

  const hasGenerated = useMemo(() => {
    return upload_resources?.some((u) => u.generated) ?? false;
  }, [upload_resources]);

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
          {onGenerate && showAiGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                    className="h-8 w-8 p-0"
                  >
                    {aiIsGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{hasGenerated ? "Regenerate files with AI" : "Generate files with AI"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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

      {/* AI-suggested uploads preview */}
      {showDiff && aiSuggestions.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Files</p>
          <div className="space-y-2">
            {aiSuggestions.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.file_path?.split("/").pop() || item.file_path || ""}
              </div>
            ))}
          </div>
        </div>
      )}

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
          renderItem={(item, isSelected) => (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isSuggested(item.id) && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                    Suggested
                  </span>
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
              <Check
                className={cn(
                  "ml-auto flex-shrink-0 h-4 w-4",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          )}
          placeholder={placeholder}
          disabled={disabled || hasActiveUploads}
          hideSelectedChips={false}
          showClearAll={true}
        />
      )}
    </div>
  );
}
