/**
 * Images.tsx
 * Resource component for image selection
 * Redesigned to match ContentSection interface-first pattern with horizontal scrollable row and upload box
 * Manages image_ids array and reports to parent
 */

"use client";

import ImageViewer from "@/components/common/chat/viewers/ImageViewer";
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
import { Check, Eye, Image, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v4/resources/images", "post">;

export interface ImageItem {
  id: string;
  name: string;
  description?: string;
  upload_id?: string;
  updated_at?: string;
}

export interface ImagesProps {
  image_ids?: string[]; // Current image artifact IDs (standardized prop name)
  image_resources?: Array<{
    id?: string | null;
    name?: string | null;
    file_path?: string | null;
    mime_type?: string | null;
    upload_id?: string | null;
    generated?: boolean | null;
  }>; // Selected image resources (each includes generated field)
  show_images?: boolean; // Whether to show this resource picker
  images_agent_id?: string | null; // Agent ID for resource creation
  images_required?: boolean; // Whether this resource is required
  image_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  images?: Array<{
    id?: string | null;
    name?: string | null;
    file_path?: string | null;
    mime_type?: string | null;
    upload_id?: string | null;
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
  multiSelect?: boolean; // Whether to allow multiple image selection
  maxImages?: number; // Maximum number of images allowed
  onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Upload handler
  imageInputRef?: React.RefObject<HTMLInputElement>; // Ref for file input
  isUploadingImage?: boolean; // Whether image is currently uploading
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ image_ids: string[] } | void>) => void;
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
  description: _description,
  group_id,
  agent_id,
  createImagesAction,
  onGenerate,
  isGenerating = false,
  multiSelect = false,
  maxImages = 1,
  onImageUpload,
  imageInputRef,
  isUploadingImage = false,
  isAutosaveEnabled = true,
  registerFlush,
}: ImagesProps) {
  const ids = useMemo(() => image_ids ?? [], [image_ids]);
  const show = show_images ?? false;
  const allImages = useMemo(() => images ?? [], [images]);
  const suggestionsList = useMemo(
    () => image_suggestions ?? [],
    [image_suggestions]
  );

  // Internal state for selected images (for display)
  const [selectedImages, setSelectedImages] = useState<
    Array<{ id: string; name: string; upload_id: string }>
  >(() => {
    // Initialize from image_resources or images array
    if (image_resources && image_resources.length > 0) {
      return image_resources
        .filter((img) => img.id && img.name)
        .map((img) => ({
          id: img.id!,
          name: img.name!,
          upload_id: img.id!,
        }));
    }
    if (ids.length > 0 && allImages.length > 0) {
      return ids
        .map((id) => {
          const img = allImages.find((i) => i.id === id);
          if (img && img.id && img.name) {
            return {
              id: img.id,
              name: img.name,
              upload_id: img.upload_id || img.id,
            };
          }
          return null;
        })
        .filter(
          (img): img is { id: string; name: string; upload_id: string } =>
            img !== null
        );
    }
    return [];
  });

  // Sync selectedImages when ids change
  useEffect(() => {
    if (ids.length > 0 && allImages.length > 0) {
      const newSelectedImages = ids
        .map((id) => {
          const img = allImages.find((i) => i.id === id);
          if (img && img.id && img.name) {
            return {
              id: img.id,
              name: img.name,
              upload_id: img.upload_id || img.id,
            };
          }
          return null;
        })
        .filter(
          (img): img is { id: string; name: string; upload_id: string } =>
            img !== null
        );
      setSelectedImages(newSelectedImages);
    } else if (ids.length === 0) {
      setSelectedImages([]);
    }
  }, [ids, allImages]);

  // Track which image IDs have already had resources created
  const createdImageIdsRef = useRef<Set<string>>(new Set());
  const flushRef = useRef<(() => Promise<{ image_ids: string[] } | void>) | undefined>(undefined);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);

  // Initialize createdImageIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdImageIdsRef.current.add(id));
  }, [ids]);

  // Build image mapping for GenericPicker
  const imageMapping = useMemo(() => {
    const mapping: Record<string, ImageItem> = {};
    allImages.forEach((img) => {
      if (img.id && img.name) {
        mapping[img.id] = {
          id: img.id,
          name: img.name,
          ...(img.upload_id ? { upload_id: img.upload_id } : {}),
        };
      }
    });
    return mapping;
  }, [allImages]);

  // Check if an image is suggested
  const _isSuggested = useCallback(
    (imageId: string) => suggestionsList.includes(imageId),
    [suggestionsList]
  );

  const handleImageSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdImageIdsRef.current.has(id)
      );

      // Create resources for newly selected images (only if autosave is enabled)
      const effectiveAgentId = images_agent_id ?? agent_id;
      if (
        isAutosaveEnabled &&
        newlySelected.length > 0 &&
        createImagesAction &&
        effectiveAgentId &&
        group_id
      ) {
        for (const imageId of newlySelected) {
          try {
            const imageItem = imageMapping[imageId];
            await createImagesAction({
              body: {
                agent_id: effectiveAgentId,
                group_id: group_id,
                name: imageItem?.name ?? "",
                description: imageItem?.description ?? "",
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
    [ids, onChange, createImagesAction, images_agent_id, agent_id, group_id, imageMapping, isAutosaveEnabled]
  );

  // Flush function for manual save mode - creates pending resources and returns all IDs
  flushRef.current = async (): Promise<{ image_ids: string[] } | void> => {
    const effectiveAgentId = images_agent_id ?? agent_id;
    if (!createImagesAction || !effectiveAgentId || !group_id) {
      return { image_ids: ids };
    }

    const allIds: string[] = [...ids];

    // Create resources for any selected images that haven't been created yet
    for (const imageId of ids) {
      if (!createdImageIdsRef.current.has(imageId)) {
        try {
          const imageItem = imageMapping[imageId];
          await createImagesAction({
            body: {
              agent_id: effectiveAgentId,
              group_id: group_id,
              name: imageItem?.name ?? "",
              description: imageItem?.description ?? "",
              mcp: false,
            },
          });
          createdImageIdsRef.current.add(imageId);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to create image resource for ${imageId}:`, error);
        }
      }
    }

    return { image_ids: allIds };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const handleImageRemove = useCallback(
    (imageId: string) => {
      const newIds = ids.filter((id) => id !== imageId);
      onChange(newIds);
    },
    [ids, onChange]
  );

  // Check if any image resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return image_resources?.some((i) => i.generated) ?? false;
  }, [image_resources]);

  // Don't render if show_images is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Create internal file input ref if not provided
  const internalImageInputRef = useRef<HTMLInputElement>(null);
  const effectiveImageInputRef = imageInputRef || internalImageInputRef;

  return (
    <div className="space-y-2">
      {/* Label, Generate Button, Picker */}
      <div className="flex items-end justify-between gap-2">
        {label ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={id} className="flex items-center gap-1.5">
              <Image className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
              {(required || images_required) && (
                <span className="text-destructive">*</span>
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
        ) : (
          <span />
        )}
        <GenericPicker
          items={imageMapping}
          itemIds={Object.keys(imageMapping)}
          selectedIds={ids}
          onSelect={handleImageSelect}
          getId={(item) => {
            const imgItem = item as ImageItem;
            return imgItem.id;
          }}
          getLabel={(item) => {
            const imgItem = item as ImageItem;
            const date = imgItem.updated_at
              ? new Date(imgItem.updated_at)
              : new Date();
            return `${imgItem.name} - ${date.toLocaleDateString()}`;
          }}
          getSearchText={(item) => {
            const imgItem = item as ImageItem;
            const date = imgItem.updated_at
              ? new Date(imgItem.updated_at)
              : new Date();
            return `${imgItem.name} ${date.toLocaleDateString()}`;
          }}
          renderButton={(selectedItems) => {
            if (selectedItems.length === 0) {
              return placeholder;
            }
            if (multiSelect && selectedItems.length > 1) {
              return `${selectedItems.length} images selected`;
            }
            const selectedImage = selectedItems[0] as ImageItem;
            return selectedImage?.name || placeholder;
          }}
          renderItem={(item, isSelected) => {
            const imgItem = item as ImageItem;
            const date = imgItem.updated_at
              ? new Date(imgItem.updated_at)
              : new Date();
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
                    <span className="font-medium">{imgItem.name}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground mt-1">
                  {date.toLocaleDateString()} {date.toLocaleTimeString()}
                </span>
              </div>
            );
          }}
          disabled={disabled}
          multiSelect={multiSelect}
          hideSelectedChips={true}
          buttonClassName="h-8 justify-between"
          compact={true}
          groupHeading="Images"
          placeholder={placeholder}
          clearActionLabel="New Image"
        />
      </div>

      {/* Image Picker and Preview Section (matching ContentSection pattern) */}
      <div className="space-y-2">

        {/* Image Grid - Horizontal Scrollable Row (matching ContentSection pattern) */}
        <div className="overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {/* Display selected images */}
            {selectedImages.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square w-32 min-w-[8rem] border rounded-lg overflow-hidden bg-muted/20 shrink-0"
              >
                {/* Preview button - top left */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImageId(img.id);
                  }}
                  className="absolute top-1 left-1 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                  disabled={disabled}
                >
                  <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                </button>
                {/* Delete button - top right */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImageRemove(img.id);
                  }}
                  className="absolute top-1 right-1 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                  disabled={disabled}
                >
                  <X className="h-3.5 w-3.5 text-primary-foreground" />
                </button>
                <ImageViewer
                  imageId={img.id}
                  name={img.name}
                  bare={true}
                />
                {/* Image name at bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 z-10">
                  <span className="truncate block">{img.name}</span>
                </div>
              </div>
            ))}

            {/* Add Image Box - Show until max (matching ContentSection pattern) */}
            {selectedImages.length < maxImages && (
              <div
                onClick={() => {
                  if (!disabled && !isUploadingImage && onImageUpload) {
                    effectiveImageInputRef.current?.click();
                  }
                }}
                className="aspect-square w-32 min-w-[8rem] border-2 border-dashed border-muted-foreground/50 rounded-lg cursor-pointer bg-muted/20 hover:border-muted-foreground hover:bg-muted/50 transition-colors flex flex-col items-center justify-center shrink-0"
              >
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground text-center px-2">
                  Add image
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        {onImageUpload && (
          <input
            ref={effectiveImageInputRef}
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            disabled={isUploadingImage || disabled}
            className="hidden"
          />
        )}
      </div>

      {/* Image Preview Dialog */}
      {previewImageId && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setPreviewImageId(null)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4">
            <ImageViewer
              imageId={previewImageId}
              name={
                selectedImages.find((img) => img.id === previewImageId)?.name ||
                "Image"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
