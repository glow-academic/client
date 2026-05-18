/**
 * Files.tsx
 * Resource component for file selection and upload
 * Handles file upload via dropzone, uses GenericPicker to select existing files
 * Pure UI: data in, IDs out via onChange
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
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

export interface FileResourceItem {
  id?: string | null;
  files_id?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  size?: number | null;
  generated?: boolean | null;
  pending?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
}

export interface FilesProps {
  file_ids?: string[];
  file_resources?: FileResourceItem[];
  show_files?: boolean;
  files?: FileResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  /** Server action to upload a file — receives FormData, returns file_id */
  uploadFileAction?: (formData: FormData) => Promise<{
    success: boolean;
    file_id?: string;
    message?: string;
  }>;
  searchTerm?: string;
  /** Called after upload completes — reports file_id for draft form state */
  onFileUploadComplete?: (fileId: string) => void;
}

export function Files({
  file_ids,
  file_resources: _file_resources,
  show_files = true,
  files,
  disabled = false,
  onChange,
  label = "Files",
  id = "files",
  required = false,
  placeholder = "Select files...",
  description,
  uploadFileAction,
  searchTerm = "",
  onFileUploadComplete,
}: FilesProps) {
  const ids = useMemo(() => file_ids ?? [], [file_ids]);
  const show = show_files ?? true;
  const allFiles = useMemo(() => files ?? [], [files]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(
    () => allFiles.filter((f) => f.pending),
    [allFiles]
  );
  const pendingIds = useMemo(
    () =>
      new Set(
        pendingItems
          .map((f) => f.files_id ?? f.id)
          .filter(Boolean) as string[]
      ),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

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

  // Convert files array to items format for GenericPicker
  const fileItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allFiles
      .filter((f) => (f.files_id ?? f.id) && f.file_path)
      .filter((f) => {
        if (!term) return true;
        const filePath = f.file_path ?? "";
        const fileName = filePath.split("/").pop() || "";
        const mimeType = f.mime_type ?? "";
        return (
          fileName.toLowerCase().includes(term) ||
          filePath.toLowerCase().includes(term) ||
          mimeType.toLowerCase().includes(term)
        );
      })
      .map((f) => ({
        id: (f.files_id ?? f.id)!,
        name: f.file_path!.split("/").pop() || "Unknown file",
        description: f.mime_type || undefined,
      }));
  }, [allFiles, searchTerm]);

  // Check if a file is suggested
  const isSuggested = useCallback(
    (fileId: string) => {
      const file = allFiles.find((f) => (f.files_id ?? f.id) === fileId);
      return file?.suggested === true;
    },
    [allFiles]
  );

  // Handle file upload via server action
  const uploadFile = useCallback(
    async (file: File) => {
      if (!uploadFileAction) {
        toast.error("Upload functionality not available");
        return;
      }

      const tempId = uuidv4();
      const toastId = toast.loading(`Uploading ${file.name}...`, {
        description: `${Math.round((file.size / 1024 / 1024) * 100) / 100} MB`,
        dismissible: true,
      });

      setActiveUploads((prev) =>
        new Map(prev).set(tempId, {
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

        if (!result.success || !result.file_id) {
          throw new Error(result.message || "Upload failed");
        }

        if (onFileUploadComplete) {
          onFileUploadComplete(result.file_id);
        }

        toast.success(`Upload completed: ${file.name}!`, {
          description: "File uploaded successfully",
          id: toastId,
        });

        setActiveUploads((prev) => {
          const newMap = new Map(prev);
          const upload = newMap.get(tempId);
          if (upload) {
            newMap.set(tempId, { ...upload, status: "completed" });
          }
          return newMap;
        });

        setTimeout(() => {
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(tempId);
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
          newMap.delete(tempId);
          return newMap;
        });
      }
    },
    [uploadFileAction, onFileUploadComplete]
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
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
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

      {/* File picker */}
      {fileItems.length > 0 && (
        <GenericPicker
          items={fileItems}
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
                  {isPending && (
                    <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                      Pending
                    </span>
                  )}
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
