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
  /** Artifact-scoped upload function (e.g. ``uploadScenarioVideo``).
   *  Caller hands us a File, we hand back the canonical resource id.
   *  Mirrors the ``uploadImage`` contract in Images.tsx — the upload
   *  writes the full server-side chain and the parent just selects
   *  the returned ``video_id``. */
  uploadVideo?: (file: File) => Promise<{ video_id: string; upload_id: string }>;
  /** BFF base URL for video downloads; the <video> tag builds
   *  ``${downloadBaseUrl}/${videoId}``. Defaults to ``/api/system/video``. */
  downloadBaseUrl?: string;
  /** Report newly uploaded video id upward so the parent can append it
   *  to its selected ``video_ids``. */
  onVideoUploaded?: (video_id: string) => void;
  /** Per-field pending lifecycle (multi-select). See ParameterFields.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
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
  uploadVideo,
  downloadBaseUrl = "/api/system/video",
  onVideoUploaded,
  onAcceptPending,
  onRejectPending,
}: VideosProps) {
  const ids = useMemo(() => video_ids ?? [], [video_ids]);
  const show = show_videos ?? false;
  const allVideos = useMemo(() => videos ?? [], [videos]);

  // Internal state for selected video (single select for videos).
  // API returns video_id, not id. ``length_seconds`` is optional — the
  // ``/scenario/get`` response doesn't currently populate it, so
  // requiring it here would leave ``selectedVideo`` permanently null
  // after a pick → render falls through to the empty/upload state and
  // the user sees "nothing happens" after selecting a video.
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    name: string;
    length_seconds?: number;
  } | null>(() => {
    if (ids.length > 0 && allVideos.length > 0) {
      const video = allVideos.find((v) => v.video_id === ids[0]);
      const videoId = video?.video_id;
      if (video && videoId && video.name) {
        return {
          id: videoId,
          name: video.name,
          length_seconds:
            video.length_seconds === null || video.length_seconds === undefined
              ? undefined
              : video.length_seconds,
        };
      }
    }
    return null;
  });

  // Sync selectedVideo when ids change
  useEffect(() => {
    if (ids.length > 0 && allVideos.length > 0) {
      const video = allVideos.find((v) => v.video_id === ids[0]);
      const videoId = video?.video_id;
      if (video && videoId && video.name) {
        setSelectedVideo({
          id: videoId,
          name: video.name,
          length_seconds:
            video.length_seconds === null || video.length_seconds === undefined
              ? undefined
              : video.length_seconds,
        });
      }
    } else if (ids.length === 0) {
      setSelectedVideo(null);
    }
  }, [ids, allVideos]);

  const videoInputRef = useRef<HTMLInputElement>(null);

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
  // API returns video_id, not id. ``length_seconds`` was previously
  // required to add a row to the mapping — that hid every video the
  // ``/scenario/get`` response doesn't populate ``length_seconds`` for
  // (today: all of them, including LLM-generated ones). The picker
  // doesn't really need duration to function, and the label renderer
  // below already handles missing/zero length_seconds. So map every
  // video with an id + name, and let the label show duration only
  // when we actually have it.
  const videoMapping = useMemo(() => {
    const mapping: Record<string, VideoItem> = {};
    allVideos.forEach((v) => {
      const videoId = v.video_id;
      if (videoId && v.name) {
        mapping[videoId] = {
          id: videoId,
          name: v.name,
          length_seconds:
            v.length_seconds === null || v.length_seconds === undefined
              ? undefined
              : v.length_seconds,
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

  // Upload via the artifact-scoped helper. Component owns toast +
  // progress; helper owns URL + fetch shape.
  const uploadFile = useCallback(
    async (file: File) => {
      if (!uploadVideo) {
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
        const { video_id } = await uploadVideo(file);

        // Upload writes the full resource chain server-side; parent
        // just appends video_id to its selection.
        onVideoUploaded?.(video_id);

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
    [uploadVideo, onVideoUploaded]
  );

  // Internal upload handler — fires when a user picks a file via the
  // hidden file input. Active when ``uploadVideo`` is set.
  const handleInternalUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const first = e.target.files?.[0];
      if (first) {
        // Only upload the first file for videos (single select)
        uploadFile(first);
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

  // Accept pending — pending items already in selection; tell parent
  // hook to strip them from ``pending_ids`` if provided.
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingIds.size > 0) {
      onAcceptPending(Array.from(pendingIds));
    }
  }, [onAcceptPending, pendingIds]);

  // Reject pending — remove pending IDs from selection. Parent hook (if
  // present) also strips them from ``pending_ids``.
  const handleReject = useCallback(() => {
    if (onRejectPending && pendingIds.size > 0) {
      onRejectPending(Array.from(pendingIds));
      return;
    }
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, onRejectPending, pendingIds]);

  // Don't render if show_videos is false (AFTER all hooks)
  if (!show) {
    return null;
  }

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

      {/* Video Preview Container — when no video is selected, the whole
          box is the upload target (mirrors the empty-state add-image card
          in Images.tsx). Clicking anywhere on the black area opens the
          file picker. */}
      {(() => {
        const canUpload = !!uploadVideo;
        const isEmptyState = !selectedVideo && canUpload;
        const uploadDisabled = disabled || activeUploads.size > 0;

        const containerClass = cn(
          "relative border rounded-lg overflow-hidden min-h-[400px] flex-1 bg-black flex items-center justify-center",
          isEmptyState &&
            "cursor-pointer transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isEmptyState && uploadDisabled && "opacity-60 cursor-not-allowed",
        );

        const handleEmptyClick = () => {
          if (isEmptyState && !uploadDisabled) {
            videoInputRef.current?.click();
          }
        };

        return (
          <div
            className={containerClass}
            onClick={isEmptyState ? handleEmptyClick : undefined}
            role={isEmptyState ? "button" : undefined}
            tabIndex={isEmptyState ? 0 : undefined}
            aria-disabled={isEmptyState && uploadDisabled ? true : undefined}
            onKeyDown={
              isEmptyState
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleEmptyClick();
                    }
                  }
                : undefined
            }
          >
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
                  src={`${downloadBaseUrl}/${selectedVideo.id}`}
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
              <div className="flex flex-col items-center justify-center text-white/70 pointer-events-none">
                {canUpload ? (
                  <>
                    <Upload className="h-10 w-10 mb-3" />
                    <p className="text-sm font-medium">Click to upload video</p>
                    <p className="text-xs text-white/50 mt-1">MP4, MOV up to the server limit</p>
                  </>
                ) : (
                  <>
                    <Video className="h-12 w-12 mb-2" />
                    <p className="text-sm">No video selected</p>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Hidden file input */}
      {uploadVideo && (
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleInternalUpload}
          disabled={disabled || activeUploads.size > 0}
          className="hidden"
        />
      )}
    </div>
  );
}
