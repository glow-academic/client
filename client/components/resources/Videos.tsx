/**
 * Videos.tsx
 * Resource component for video selection
 * Uses GenericPicker to select existing video artifacts
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
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftVideosIn = InputOf<"/api/v4/resources/videos", "post">;
type CreateDraftVideosOut = OutputOf<"/api/v4/resources/videos", "post">;

export interface VideoItem {
  id: string;
  name: string;
  description?: string;
}

export interface VideosProps {
  video_ids?: string[]; // Current video artifact IDs (standardized prop name)
  video_resources?: Array<{
    video_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
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
  placeholder = "Select videos...",
  description,
  group_id,
  agent_id,
  createVideosAction,
  onGenerate,
  isGenerating = false,
}: VideosProps) {
  const ids = useMemo(() => video_ids ?? [], [video_ids]);
  const show = show_videos ?? false;
  const allVideos = useMemo(() => videos ?? [], [videos]);
  const suggestionsList = useMemo(
    () => video_suggestions ?? [],
    [video_suggestions]
  );

  // Track which video IDs have already had resources created
  const createdVideoIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdVideoIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdVideoIdsRef.current.add(id));
  }, [ids]);

  // Convert videos array to VideoItem format for GenericPicker
  const videoItems = useMemo(() => {
    return allVideos
      .filter((v) => v.video_id && v.name) // Filter out nulls
      .map((v) => ({
        id: v.video_id!,
        name: v.name!,
        ...(v.description ? { description: v.description } : {}), // Only include if not null/undefined
      }));
  }, [allVideos]);

  // Check if a video is suggested
  const isSuggested = useCallback(
    (videoId: string) => suggestionsList.includes(videoId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdVideoIdsRef.current.has(id)
      );

      // Create resources for newly selected videos
      const effectiveAgentId = videos_agent_id ?? agent_id;
      if (
        newlySelected.length > 0 &&
        createVideosAction &&
        effectiveAgentId &&
        group_id
      ) {
        for (const videoId of newlySelected) {
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
      onChange(selectedIds);
    },
    [ids, onChange, createVideosAction, videos_agent_id, agent_id, group_id]
  );

  // Check if any video resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return video_resources?.some((v) => v.generated) ?? false;
  }, [video_resources]);

  // Don't render if show_videos is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {(required || videos_required) && (
              <span className="text-destructive">*</span>
            )}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
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
      )}
      <GenericPicker<VideoItem>
        items={videoItems}
        itemIds={allVideos
          .map((v) => v.video_id)
          .filter((id): id is string => id !== null)} // All video IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
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
                  <div className="text-xs text-muted-foreground truncate">
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
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
