/**
 * Videos.tsx
 * Resource component for video selection
 * Redesigned to match ContentSection interface-first pattern with video picker and preview
 * Manages video_ids array and reports to parent
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
import { cn } from "@/lib/utils";
import { inferMimeFromName } from "@/utils/mime-map";
import { Check, Loader2, Sparkles, Upload, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

type CreateDraftVideosIn = InputOf<"/api/v4/resources/videos", "post">;
type CreateDraftVideosOut = OutputOf<"/api/v4/resources/videos", "post">;

export interface VideoItem {
  id: string;
  name: string;
  description?: string;
  length_seconds?: number;
  upload_id?: string;
}

export interface VideosProps {
  video_ids?: string[]; // Current video artifact IDs (standardized prop name)
  video_resources?: Array<{
    id?: string | null;
    video_id?: string | null;
    name?: string | null;
    length_seconds?: number | null;
    completed?: boolean | null;
    file_path?: string | null;
    mime_type?: string | null;
    upload_id?: string | null;
    generated?: boolean | null;
  }>; // Selected video resources (each includes generated field)
  show_videos?: boolean; // Whether to show this resource picker
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  videos_required?: boolean; // Whether this resource is required
  video_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  videos?: Array<{
    id?: string | null;
    video_id?: string | null;
    name?: string | null;
    length_seconds?: number | null;
    completed?: boolean | null;
    file_path?: string | null;
    mime_type?: string | null;
    upload_id?: string | null;
    generated?: boolean | null;
  }>; // All available videos from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update video_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  createVideosAction?:
    | ((input: CreateDraftVideosIn) => Promise<CreateDraftVideosOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  onVideoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Upload handler
  videoInputRef?: React.RefObject<HTMLInputElement>; // Ref for file input
  isUploadingVideo?: boolean; // Whether video is currently uploading
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ video_ids: string[] } | void>) => void;
  /** Action to finalize TUS upload */
  finalizeUploadAction?: (uploadId: string) => Promise<{
    success: boolean;
    upload_id?: string;
    message?: string;
  }>;
  // AI diff view props
  aiVideoResources?: Array<{
    video_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Videos({
  video_ids,
  video_resources,
  show_videos = false,
  create_tool_id,
  link_tool_id,
  videos_required,
  video_suggestions,
  videos,
  disabled = false,
  onChange,
  label = "Videos",
  id = "videos",
  required = false,
  placeholder = "Select video...",
  description: _description,
  group_id,
  createVideosAction,
  onGenerate,
  isGenerating = false,
  onVideoUpload,
  videoInputRef,
  isUploadingVideo = false,
  isAutosaveEnabled = true,
  registerFlush,
  finalizeUploadAction,
  // AI diff view props
  aiVideoResources,
  onAccept,
  onReject,
}: VideosProps) {
  const ids = useMemo(() => video_ids ?? [], [video_ids]);
  const show = show_videos ?? false;
  const allVideos = useMemo(() => videos ?? [], [videos]);
  const suggestionsList = useMemo(
    () => video_suggestions ?? [],
    [video_suggestions]
  );

  // Internal state for selected video (single select for videos)
  // API returns video_id, not id
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    name: string;
    length_seconds: number;
    upload_id?: string;
  } | null>(() => {
    // Initialize from video_resources or videos array
    if (ids.length > 0 && allVideos.length > 0) {
      const video = allVideos.find((v) => (v.video_id ?? v.id) === ids[0]);
      const videoId = video?.video_id ?? video?.id;
      if (video && videoId && video.name && video.length_seconds !== null && video.length_seconds !== undefined) {
        return {
          id: videoId,
          name: video.name,
          length_seconds: video.length_seconds,
          ...(video.upload_id ? { upload_id: video.upload_id } : {}),
        };
      }
    }
    return null;
  });

  // Sync selectedVideo when ids change
  useEffect(() => {
    if (ids.length > 0 && allVideos.length > 0) {
      const video = allVideos.find((v) => (v.video_id ?? v.id) === ids[0]);
      const videoId = video?.video_id ?? video?.id;
      if (video && videoId && video.name && video.length_seconds !== null && video.length_seconds !== undefined) {
        setSelectedVideo({
          id: videoId,
          name: video.name,
          length_seconds: video.length_seconds,
          ...(video.upload_id ? { upload_id: video.upload_id } : {}),
        });
      }
    } else if (ids.length === 0) {
      setSelectedVideo(null);
    }
  }, [ids, allVideos]);

  // Track which video IDs have already had resources created
  const createdVideoIdsRef = useRef<Set<string>>(new Set());
  const flushRef = useRef<(() => Promise<{ video_ids: string[] } | void>) | undefined>(undefined);

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

  // Initialize createdVideoIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdVideoIdsRef.current.add(id));
  }, [ids]);

  // Build video mapping for GenericPicker (matching ContentSection pattern)
  // API returns video_id, not id
  const videoMapping = useMemo(() => {
    const mapping: Record<string, VideoItem> = {};
    allVideos.forEach((v) => {
      const videoId = v.video_id ?? v.id;
      if (videoId && v.name && v.length_seconds !== null && v.length_seconds !== undefined) {
        mapping[videoId] = {
          id: videoId,
          name: v.name,
          length_seconds: v.length_seconds,
          ...(v.upload_id ? { upload_id: v.upload_id } : {}),
        };
      }
    });
    return mapping;
  }, [allVideos]);

  // Check if a video is suggested
  const _isSuggested = useCallback(
    (videoId: string) => suggestionsList.includes(videoId),
    [suggestionsList]
  );

  const handleVideoSelect = useCallback(
    async (selectedIds: string[]) => {
      const videoId = selectedIds[0] || null;

      if (videoId && videoMapping[videoId]) {
        const selectedVideoItem = videoMapping[videoId];

        // Find if this is a newly selected video
        const isNewlySelected = !ids.includes(videoId) && !createdVideoIdsRef.current.has(videoId);

        // Create resource for newly selected video (only if autosave is enabled)
        if (isAutosaveEnabled && isNewlySelected) {
          if (createVideosAction && create_tool_id && group_id) {
            try {
              await createVideosAction({
                body: {
                  group_id: group_id,
                  name: selectedVideoItem.name ?? "",
                  length_seconds: selectedVideoItem.length_seconds ?? 0,
                  description: selectedVideoItem.description ?? "",
                  mcp: false,
                },
              });
              createdVideoIdsRef.current.add(videoId);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(
                `Failed to create video resource for ${videoId}:`,
                error
              );
              // Don't block UI - still update selection
            }
          }
        }

        // Update parent state
        onChange([videoId]);
      } else if (!videoId) {
        // Clear selection
        onChange([]);
      }
    },
    [ids, onChange, createVideosAction, create_tool_id, group_id, videoMapping, isAutosaveEnabled]
  );

  // Flush function for manual save mode - creates pending resources and returns all IDs
  flushRef.current = async (): Promise<{ video_ids: string[] } | void> => {
    if (!createVideosAction || !create_tool_id || !group_id) {
      return { video_ids: ids };
    }

    const allIds: string[] = [...ids];

    // Create resources for any selected videos that haven't been created yet
    for (const videoId of ids) {
      if (!createdVideoIdsRef.current.has(videoId)) {
        try {
          const videoItem = videoMapping[videoId];
          await createVideosAction({
            body: {
              group_id: group_id,
              name: videoItem?.name ?? "",
              length_seconds: videoItem?.length_seconds ?? 0,
              description: videoItem?.description ?? "",
              mcp: false,
            },
          });
          createdVideoIdsRef.current.add(videoId);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to create video resource for ${videoId}:`, error);
        }
      }
    }

    return { video_ids: allIds };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // TUS upload function
  const uploadFile = useCallback(
    async (file: File) => {
      const create_tool_id = create_tool_id;
      if (!finalizeUploadAction || !createVideosAction || !group_id || !create_tool_id) {
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
          endpoint: `/api/uploads/save`,
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

              // Create video resource entry
              const createResult = await createVideosAction({
                body: {
                  group_id: group_id,
                  name: file.name,
                  length_seconds: 0, // Will be updated after processing
                  description: "",
                  upload_id: databaseUploadId,
                  mcp: false,
                },
              });

              if (!createResult.id) {
                throw new Error("Failed to create video resource");
              }

              const videoResourceId = createResult.id;
              createdVideoIdsRef.current.add(videoResourceId);

              // Add to selection
              onChange([videoResourceId]);

              // Update selectedVideo state
              setSelectedVideo({
                id: videoResourceId,
                name: file.name,
                length_seconds: 0,
                upload_id: databaseUploadId,
              });

              toast.success(`Upload completed: ${file.name}!`, {
                description: "Video uploaded successfully",
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
      createVideosAction,
      group_id,
      create_tool_id,
      onChange,
    ]
  );

  // Internal upload handler for when finalizeUploadAction is provided
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

  // Check if any video resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return video_resources?.some((v) => v.generated) ?? false;
  }, [video_resources]);

  // AI suggestion state
  const showDiff = !!aiVideoResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiVideoResources
          ?.map((v) => v.video_id)
          .filter(Boolean) as string[]
      ),
    [aiVideoResources]
  );

  // Accept AI suggestion - select the first AI-suggested video
  const handleAccept = useCallback(() => {
    if (!aiVideoResources?.length) return;
    const firstSuggested = aiVideoResources[0];
    if (firstSuggested?.video_id) {
      onChange([firstSuggested.video_id]);
    }
    onAccept?.();
  }, [aiVideoResources, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_videos is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Create internal file input ref if not provided
  const internalVideoInputRef = useRef<HTMLInputElement>(null);
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
            {onGenerate && create_tool_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onGenerate}
                      disabled={disabled || isGenerating || showDiff}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasGenerated ? "Regenerate" : "Generate"}
                  </TooltipContent>
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

      {/* AI Suggested Video Preview */}
      {showDiff && aiVideoResources && aiVideoResources.length > 0 && (
        <div className="mb-2 p-3 rounded-lg border-2 border-success bg-success/10">
          <p className="text-sm font-medium text-success mb-2">AI Suggested Video</p>
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-success" />
            <span className="text-sm">{aiVideoResources[0]?.name || "Video"}</span>
          </div>
        </div>
      )}

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
          selectedVideo.upload_id ? (
            <video
              src={`/api/uploads/download/${selectedVideo.upload_id}`}
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
            {(onVideoUpload || finalizeUploadAction) && (
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
      {(onVideoUpload || finalizeUploadAction) && (
        <input
          ref={effectiveVideoInputRef}
          type="file"
          accept="video/*"
          onChange={finalizeUploadAction ? handleInternalUpload : onVideoUpload}
          disabled={isUploadingVideo || disabled || activeUploads.size > 0}
          className="hidden"
        />
      )}
    </div>
  );
}
