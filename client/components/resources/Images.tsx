/**
 * Images.tsx
 * Resource component for image selection
 * Uses GenericPicker to select existing image artifacts
 * Manages image_ids array and reports to parent
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

type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v4/resources/images", "post">;

export interface ImageItem {
  id: string;
  name: string;
  description?: string;
}

export interface ImagesProps {
  image_ids?: string[]; // Current image artifact IDs (standardized prop name)
  image_resources?: Array<{
    image_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected image resources (each includes generated field)
  show_images?: boolean; // Whether to show this resource picker
  images_agent_id?: string | null; // Agent ID for resource creation
  images_required?: boolean; // Whether this resource is required
  image_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  images?: Array<{
    image_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available images from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update image_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createImagesAction?:
    | ((input: CreateDraftImagesIn) => Promise<CreateDraftImagesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Images({
  image_ids,
  image_resources,
  show_images = false,
  images_agent_id,
  images_required,
  image_suggestions,
  images,
  disabled = false,
  onChange,
  label = "Images",
  id = "images",
  required = false,
  placeholder = "Select images...",
  description,
  group_id,
  agent_id,
  createImagesAction,
  onGenerate,
  isGenerating = false,
}: ImagesProps) {
  const ids = useMemo(() => image_ids ?? [], [image_ids]);
  const show = show_images ?? false;
  const allImages = useMemo(() => images ?? [], [images]);
  const suggestionsList = useMemo(
    () => image_suggestions ?? [],
    [image_suggestions]
  );

  // Track which image IDs have already had resources created
  const createdImageIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdImageIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdImageIdsRef.current.add(id));
  }, [ids]);

  // Convert images array to ImageItem format for GenericPicker
  const imageItems = useMemo(() => {
    return allImages
      .filter((i) => i.image_id && i.name) // Filter out nulls
      .map((i) => ({
        id: i.image_id!,
        name: i.name!,
        ...(i.description ? { description: i.description } : {}), // Only include if not null/undefined
      }));
  }, [allImages]);

  // Check if an image is suggested
  const isSuggested = useCallback(
    (imageId: string) => suggestionsList.includes(imageId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdImageIdsRef.current.has(id)
      );

      // Create resources for newly selected images
      const effectiveAgentId = images_agent_id ?? agent_id;
      if (
        newlySelected.length > 0 &&
        createImagesAction &&
        effectiveAgentId &&
        group_id
      ) {
        for (const imageId of newlySelected) {
          try {
            await createImagesAction({
              body: {
                agent_id: effectiveAgentId,
                group_id: group_id,
                image_id: imageId,
                mcp: false,
              },
            });
            createdImageIdsRef.current.add(imageId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create image resource for ${imageId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createImagesAction, images_agent_id, agent_id, group_id]
  );

  // Check if any image resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return image_resources?.some((i) => i.generated) ?? false;
  }, [image_resources]);

  // Don't render if show_images is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {(required || images_required) && (
              <span className="text-destructive">*</span>
            )}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {onGenerate && (images_agent_id || agent_id) && (
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
      <GenericPicker<ImageItem>
        items={imageItems}
        itemIds={allImages
          .map((i) => i.image_id)
          .filter((id): id is string => id !== null)} // All image IDs from array, filter nulls
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
