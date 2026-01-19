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
import { Check, Loader2, Sparkles, Upload, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    video_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
    length_seconds?: number | null;
    upload_id?: string | null;
  }>; // Selected video resources (each includes generated field)
  show_videos?: boolean; // Whether to show this resource picker
  videos_agent_id?: string | null; // Agent ID for resource creation
  videos_required?: boolean; // Whether this resource is required
  video_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  videos?: Array<{
    video_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
    length_seconds?: number | null;
    upload_id?: string | null;
  }>; // All available videos from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update video_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createVideosAction?:
    | ((input: CreateDraftVideosIn) => Promise<CreateDraftVideosOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  onVideoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Upload handler
  videoInputRef?: React.RefObject<HTMLInputElement>; // Ref for file input
  isUploadingVideo?: boolean; // Whether video is currently uploading
}

export function Videos({
  video_ids,
  video_resources,
  show_videos = false,
  videos_agent_id,
  videos_required,
  video_suggestions,
  videos,
  disabled = false,
  onChange,
  label = "Videos",
  id = "videos",
  required = false,
  placeholder = "Select video...",
  description,
  group_id,
  agent_id,
  createVideosAction,
  onGenerate,
  isGenerating = false,
  onVideoUpload,
  videoInputRef,
  isUploadingVideo = false,
}: VideosProps) {
  const ids = useMemo(() => video_ids ?? [], [video_ids]);
  const show = show_videos ?? false;
  const allVideos = useMemo(() => videos ?? [], [videos]);
  const suggestionsList = useMemo(
    () => video_suggestions ?? [],
    [video_suggestions]
  );

  // Internal state for selected video (single select for videos)
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    name: string;
    length_seconds: number;
    upload_id?: string;
  } | null>(() => {
    // Initialize from video_resources or videos array
    if (ids.length > 0 && allVideos.length > 0) {
      const video = allVideos.find((v) => v.video_id === ids[0]);
      if (video && video.video_id && video.name && video.length_seconds !== null && video.length_seconds !== undefined) {
        return {
          id: video.video_id,
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
      const video = allVideos.find((v) => v.video_id === ids[0]);
      if (video && video.video_id && video.name && video.length_seconds !== null && video.length_seconds !== undefined) {
        setSelectedVideo({
          id: video.video_id,
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

  // Initialize createdVideoIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdVideoIdsRef.current.add(id));
  }, [ids]);

  // Build video mapping for GenericPicker (matching ContentSection pattern)
  const videoMapping = useMemo(() => {
    const mapping: Record<string, VideoItem> = {};
    allVideos.forEach((v) => {
      if (v.video_id && v.name && v.length_seconds !== null && v.length_seconds !== undefined) {
        mapping[v.video_id] = {
          id: v.video_id,
          name: v.name,
          ...(v.description ? { description: v.description } : {}),
          length_seconds: v.length_seconds,
          ...(v.upload_id ? { upload_id: v.upload_id } : {}),
        };
      }
    });
    return mapping;
  }, [allVideos]);

  // Check if a video is suggested
  const isSuggested = useCallback(
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

        // Create resource for newly selected video
        if (isNewlySelected) {
          const effectiveAgentId = videos_agent_id ?? agent_id;
          if (createVideosAction && effectiveAgentId && group_id) {
            try {
              await createVideosAction({
                body: {
                  agent_id: effectiveAgentId,
                  group_id: group_id,
                  video_id: videoId,
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
    [ids, onChange, createVideosAction, videos_agent_id, agent_id, group_id, videoMapping]
  );

  // Check if any video resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return video_resources?.some((v) => v.generated) ?? false;
  }, [video_resources]);

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
            {onGenerate && (videos_agent_id || agent_id) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onGenerate}
                      disabled={disabled || isGenerating}
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
            {onVideoUpload && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => effectiveVideoInputRef.current?.click()}
                disabled={disabled || isUploadingVideo}
                className="mt-4"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Video
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      {onVideoUpload && (
        <input
          ref={effectiveVideoInputRef}
          type="file"
          accept="video/*"
          onChange={onVideoUpload}
          disabled={isUploadingVideo || disabled}
          className="hidden"
        />
      )}
    </div>
  );
}
