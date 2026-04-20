/**
 * Videos.tsx
 * Resource component for video selection
 * Redesigned to match ContentSection interface-first pattern with video picker and preview
 * Pure UI: data in, IDs out via onChange. Parent owns creation.
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
import { Check, Loader2, Upload, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

export interface VideoResourceItem {
  video_id?: string | null;
  name?: string | null;
  length_seconds?: number | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface VideoItem {
  id: string;
  name: string;
  description?: string;
  length_seconds?: number;
}

export interface VideosProps {
  video_ids?: string[]; // Current video artifact IDs (standardized prop name)
  video_resources?: VideoResourceItem[]; // Selected video resources
  show_videos?: boolean; // Whether to show this resource picker
  videos_required?: boolean; // Whether this resource is required
  videos?: VideoResourceItem[]; // All available videos from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update video_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  onVideoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Upload handler
  videoInputRef?: React.RefObject<HTMLInputElement>; // Ref for file input
  isUploadingVideo?: boolean; // Whether video is currently uploading
  /** Artifact-scoped base path for upload/download URLs (e.g., "/scenario") */
  uploadBasePath?: string;
  /** Server action to upload a file — receives FormData, returns upload_id */
  uploadFileAction?: (formData: FormData) => Promise<{
    success: boolean;
    upload_id?: string;
    message?: string;
  }>;
  /** Report uploaded video values upward (unified draft pattern — parent owns creation)
   *  Called after TUS upload + finalize with the creation parameters.
   *  TODO: Server-side DraftVideoValue needs upload_id field for file-backed videos. */
  onVideoUploadValue?: (video: { name: string; description: string; upload_id: string; length_seconds: number }) => void;
}

export function Videos({
  video_ids,
  video_resources: _video_resources,
  show_videos = false,
  videos_required,
  videos,
  disabled = false,
  onChange,
  label = "Videos",
  id = "videos",
  required = false,
  placeholder = "Select video...",
  description: _description,
  onVideoUpload,
  videoInputRef,
  isUploadingVideo = false,
  uploadBasePath,
  uploadFileAction,
  onVideoUploadValue,
}: VideosProps) {
  const ids = useMemo(() => video_ids ?? [], [video_ids]);
  const show = show_videos ?? false;
  const allVideos = useMemo(() => videos ?? [], [videos]);

  // Internal state for selected video (single select for videos)
  // API returns video_id, not id
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    name: string;
    length_seconds: number;
  } | null>(() => {
    if (ids.length > 0 && allVideos.length > 0) {
      const video = allVideos.find((v) => v.video_id === ids[0]);
      const videoId = video?.video_id;
      if (video && videoId && video.name && video.length_seconds !== null && video.length_seconds !== undefined) {
        return { id: videoId, name: video.name, length_seconds: video.length_seconds };
      }
    }
    return null;
  });

  // Sync selectedVideo when ids change
  useEffect(() => {
    if (ids.length > 0 && allVideos.length > 0) {
      const video = allVideos.find((v) => v.video_id === ids[0]);
      const videoId = video?.video_id;
      if (video && videoId && video.name && video.length_seconds !== null && video.length_seconds !== undefined) {
        setSelectedVideo({ id: videoId, name: video.name, length_seconds: video.length_seconds });
      }
    } else if (ids.length === 0) {
      setSelectedVideo(null);
    }
  }, [ids, allVideos]);

  // Create internal file input ref (must be before any early returns — rules of hooks)
  const internalVideoInputRef = useRef<HTMLInputElement>(null);

  // TUS upload state
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

  // Build video mapping for GenericPicker (matching ContentSection pattern)
  // API returns video_id, not id
  const videoMapping = useMemo(() => {
    const mapping: Record<string, VideoItem> = {};
    allVideos.forEach((v) => {
      const videoId = v.video_id;
      if (videoId && v.name && v.length_seconds !== null && v.length_seconds !== undefined) {
        mapping[videoId] = {
          id: videoId,
          name: v.name,
          length_seconds: v.length_seconds,
        };
      }
    });
    return mapping;
  }, [allVideos]);

  const handleVideoSelect = useCallback(
    (selectedIds: string[]) => {
      const videoId = selectedIds[0] || null;
      if (videoId) {
        onChange([videoId]);
      } else {
        onChange([]);
      }
    },
    [onChange]
  );

  // Upload function via server action
  const uploadFile = useCallback(
    async (file: File) => {
      if (!uploadFileAction) {
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

        // Report upload value upward for unified draft pattern
        onVideoUploadValue?.({ name: file.name, description: "", upload_id: databaseUploadId, length_seconds: 0 });

        toast.success(`Upload completed: ${file.name}!`, {
          description: "Video uploaded successfully",
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

        // Remove completed upload from state after delay
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
      onVideoUploadValue,
    ]
  );

  // Internal upload handler for when uploadFileAction is provided
  const handleInternalUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        // Only upload the first file for videos (single select)
        uploadFile(files[0]);
      }
      // Reset input
      e.target.value = "";
    },
    [uploadFile]
  );

  // Pending state: items with pending=true from the API
  const pendingItems = useMemo(
    () => allVideos.filter((v) => v.pending === true),
    [allVideos]
  );
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((v) => v.video_id).filter(Boolean) as string[]),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in selection, no-op
  const handleAccept = useCallback(() => {
    // no-op: pending items already in selection
  }, []);

  // Reject pending — remove pending IDs from selection
  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, pendingIds]);

  // Don't render if show_videos is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  const effectiveVideoInputRef = videoInputRef || internalVideoInputRef;

  return (
    <div className="space-y-2">
      {/* Label, Generate Button, Picker */}
      <div className="flex items-end justify-between gap-2">
        {label ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={id} className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
              {(required || videos_required) && (
                <span className="text-destructive">*</span>
              )}
            </Label>
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
        ) : (
          <span />
        )}
        <GenericPicker
          items={videoMapping}
          itemIds={Object.keys(videoMapping)}
          selectedIds={selectedVideo ? [selectedVideo.id] : []}
          onSelect={handleVideoSelect}
          getId={(item) => {
            const vidItem = item as VideoItem;
            return vidItem.id;
          }}
          getLabel={(item) => {
            const vidItem = item as VideoItem;
            if (vidItem.length_seconds !== undefined) {
              return `${vidItem.name} (${Math.floor(vidItem.length_seconds / 60)}:${String(vidItem.length_seconds % 60).padStart(2, "0")})`;
            }
            return vidItem.name;
          }}
          getSearchText={(item) => {
            const vidItem = item as VideoItem;
            return vidItem.name;
          }}
          renderButton={(selectedItems) => {
            if (selectedItems.length === 0) {
              return placeholder;
            }
            const selectedVideoItem = selectedItems[0] as VideoItem;
            return selectedVideoItem?.name || placeholder;
          }}
          renderItem={(item, isSelected) => {
            const vidItem = item as VideoItem;
            return (
              <div className="flex flex-col items-start py-3 w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-medium">{vidItem.name}</span>
                  </div>
                  {vidItem.length_seconds !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(vidItem.length_seconds / 60)}:
                      {String(vidItem.length_seconds % 60).padStart(2, "0")}
                    </span>
                  )}
                </div>
              </div>
            );
          }}
          disabled={disabled}
          multiSelect={false}
          hideSelectedChips={true}
          buttonClassName="h-8 justify-between"
          compact={true}
          groupHeading="Videos"
          placeholder={placeholder}
          clearActionLabel="No Video"
        />
      </div>

      {/* Video Preview Container (matching ContentSection pattern) */}
      <div className="relative border rounded-lg overflow-hidden min-h-[400px] flex-1 bg-black flex items-center justify-center">
        {/* Upload progress overlay */}
        {activeUploads.size > 0 && (
          <div className="absolute inset-0 bg-black/80 z-10 flex flex-col items-center justify-center">
            {Array.from(activeUploads.values()).map((upload) => (
              <div key={upload.toastId} className="text-center text-white px-4 w-full max-w-xs">
                <Loader2 className="h-12 w-12 mb-4 mx-auto animate-spin" />
                <p className="text-sm font-medium mb-2 truncate">{upload.file.name}</p>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
                <p className="text-sm text-white/70">
                  {upload.status === "finalizing" ? "Finalizing..." : `${upload.progress}%`}
                </p>
              </div>
            ))}
          </div>
        )}

        {selectedVideo ? (
          selectedVideo.id ? (
            <video
              src={`/api/system/video/${selectedVideo.id}`}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/70">
              <Video className="h-12 w-12 mb-2" />
              <p className="text-sm">Video upload not available</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-white/70">
            <Video className="h-12 w-12 mb-2" />
            <p className="text-sm">No video selected</p>
            {/* Upload button when no video selected */}
            {(onVideoUpload || uploadFileAction) && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => effectiveVideoInputRef.current?.click()}
                disabled={disabled || isUploadingVideo || activeUploads.size > 0}
                className="mt-4"
              >
                {activeUploads.size > 0 ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Video
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      {(onVideoUpload || uploadFileAction) && (
        <input
          ref={effectiveVideoInputRef}
          type="file"
          accept="video/*"
          onChange={uploadFileAction ? handleInternalUpload : onVideoUpload}
          disabled={isUploadingVideo || disabled || activeUploads.size > 0}
          className="hidden"
        />
      )}
    </div>
  );
}
