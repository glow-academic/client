/**
 * Images.tsx
 * Resource component for image selection
 * Redesigned to match ContentSection interface-first pattern with horizontal scrollable row and upload box
 * Manages image_ids array and reports to parent
 */

"use client";

import ImageViewer from "@/components/artifacts/attempt/chat/viewers/ImageViewer";
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import { inferMimeFromName } from "@/utils/mime-map";
import { Check, Eye, Image, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v4/resources/images", "post">;

// Derive resource item type from the GET endpoint response
type ImageGetResponse = OutputOf<"/api/v4/resources/images/get", "post">;
export type ImageResourceItem = NonNullable<ImageGetResponse["item"]>;

export interface ImageItem {
  id: string;
  name: string;
  description?: string;
  upload_id?: string;
  updated_at?: string;
}

export interface ImagesProps {
  image_ids?: string[]; // Current image artifact IDs (standardized prop name)
  image_resources?: ImageResourceItem[]; // Selected image resources (each includes generated field)
  show_images?: boolean; // Whether to show this resource picker
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  images_required?: boolean; // Whether this resource is required
  image_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  images?: ImageResourceItem[]; // All available images from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update image_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  createImagesAction?:
    | ((input: CreateDraftImagesIn) => Promise<CreateDraftImagesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  multiSelect?: boolean; // Whether to allow multiple image selection
  maxImages?: number; // Maximum number of images allowed
  onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Upload handler
  imageInputRef?: React.RefObject<HTMLInputElement>; // Ref for file input
  isUploadingImage?: boolean; // Whether image is currently uploading
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ image_ids: string[] } | void>) => void;
  /** Action to finalize TUS upload */
  finalizeUploadAction?: (uploadId: string) => Promise<{
    success: boolean;
    upload_id?: string;
    message?: string;
  }>;
  aiImageResources?: Pick<ImageResourceItem, "image_id" | "name">[] | null;
}

export function Images({
  image_ids,
  image_resources,
  show_images = false,
  create_tool_id,
  images_required,
  image_suggestions: _image_suggestions,
  images,
  disabled = false,
  onChange,
  label = "Images",
  id = "images",
  required = false,
  placeholder = "Select images...",
  description: _description,
  group_id,
  createImagesAction,
  onGenerate,
  showAiGenerate = false,
  multiSelect = false,
  maxImages = 1,
  onImageUpload,
  imageInputRef,
  isUploadingImage = false,
  isAutosaveEnabled = true,
  registerFlush,
  finalizeUploadAction,
  aiImageResources: _aiImageResources,
}: ImagesProps) {
  const ids = useMemo(() => image_ids ?? [], [image_ids]);
  const show = show_images ?? false;
  const allImages = useMemo(() => images ?? [], [images]);
  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "images",
    groupId: group_id,
  });

  // Internal state for selected images (for display)
  const [selectedImages, setSelectedImages] = useState<
    Array<{ id: string; name: string; upload_id: string }>
  >(() => {
    // Initialize from image_resources or images array
    // API returns image_id, not id. Use upload_id for downloads.
    if (image_resources && image_resources.length > 0) {
      return image_resources
        .filter((img) => (img.image_id || img.id) && img.name)
        .map((img) => ({
          id: (img.image_id ?? img.id)!,
          name: img.name!,
          upload_id: img.upload_id || (img.image_id ?? img.id)!,
        }));
    }
    if (ids.length > 0 && allImages.length > 0) {
      return ids
        .map((id) => {
          const img = allImages.find((i) => (i.image_id ?? i.id) === id);
          const imgId = img?.image_id ?? img?.id;
          if (img && imgId && img.name) {
            return {
              id: imgId,
              name: img.name,
              upload_id: img.upload_id || imgId,
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
  // API returns image_id, not id
  useEffect(() => {
    if (ids.length > 0 && allImages.length > 0) {
      const newSelectedImages = ids
        .map((id) => {
          const img = allImages.find((i) => (i.image_id ?? i.id) === id);
          const imgId = img?.image_id ?? img?.id;
          if (img && imgId && img.name) {
            return {
              id: imgId,
              name: img.name,
              upload_id: img.upload_id || imgId,
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

  // Initialize createdImageIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdImageIdsRef.current.add(id));
  }, [ids]);

  // Build image mapping for GenericPicker
  // API returns image_id, not id
  const imageMapping = useMemo(() => {
    const mapping: Record<string, ImageItem> = {};
    allImages.forEach((img) => {
      const imgId = img.image_id ?? img.id;
      if (imgId && img.name) {
        mapping[imgId] = {
          id: imgId,
          name: img.name,
          ...(img.upload_id ? { upload_id: img.upload_id } : {}),
        };
      }
    });
    return mapping;
  }, [allImages]);

  const handleImageSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdImageIdsRef.current.has(id)
      );

      // Create resources for newly selected images (only if autosave is enabled)
      const create_tool_id = create_tool_id;
      if (
        isAutosaveEnabled &&
        newlySelected.length > 0 &&
        createImagesAction &&
        create_tool_id &&
        group_id
      ) {
        for (const imageId of newlySelected) {
          try {
            const imageItem = imageMapping[imageId];
            await createImagesAction({
              body: {
                group_id: group_id,
                name: imageItem?.name ?? "",
                description: imageItem?.description ?? "",
                mcp: false,
                tool_id: create_tool_id ?? undefined,
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
    [ids, onChange, createImagesAction, create_tool_id, group_id, imageMapping, isAutosaveEnabled]
  );

  // Flush function for manual save mode - creates pending resources and returns all IDs
  flushRef.current = async (): Promise<{ image_ids: string[] } | void> => {
    if (!createImagesAction || !create_tool_id || !group_id) {
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
              group_id: group_id,
              name: imageItem?.name ?? "",
              description: imageItem?.description ?? "",
              mcp: false,
              tool_id: create_tool_id ?? undefined,
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

  // TUS upload function
  const uploadFile = useCallback(
    async (file: File) => {
      const create_tool_id = create_tool_id;
      if (!finalizeUploadAction || !createImagesAction || !group_id || !create_tool_id) {
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

              // Create image resource entry
              const createResult = await createImagesAction({
                body: {
                  group_id: group_id,
                  name: file.name,
                  description: "",
                  upload_id: databaseUploadId,
                  mcp: false,
                  tool_id: create_tool_id ?? undefined,
                },
              });

              if (!createResult.id) {
                throw new Error("Failed to create image resource");
              }

              const imageResourceId = createResult.id;
              createdImageIdsRef.current.add(imageResourceId);

              // Add to selection
              onChange([...ids, imageResourceId]);

              // Update selectedImages state
              setSelectedImages((prev) => [
                ...prev,
                {
                  id: imageResourceId,
                  name: file.name,
                  upload_id: databaseUploadId,
                },
              ]);

              toast.success(`Upload completed: ${file.name}!`, {
                description: "Image uploaded successfully",
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
      createImagesAction,
      group_id,
      create_tool_id,
      ids,
      onChange,
    ]
  );

  // Internal upload handler for when finalizeUploadAction is provided
  const handleInternalUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        Array.from(files).forEach((file) => {
          uploadFile(file);
        });
      }
      // Reset input
      e.target.value = "";
    },
    [uploadFile]
  );

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

  // AI suggestion state
  const showDiff = !!aiSuggestion?.length;

  // Accept AI suggestion - add AI-suggested images to selection
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.length) return;
    const newIds = aiSuggestion
      .map((i) => i.image_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestion, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
            {onGenerate && showAiGenerate && create_tool_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onGenerate}
                      disabled={disabled || aiIsGenerating || showDiff}
                    >
                      {aiIsGenerating ? (
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
            {/* Display AI suggested images (not yet selected) */}
            {showDiff && aiSuggestion?.filter(
              (ai) => ai.image_id && !ids.includes(ai.image_id)
            ).map((ai) => {
              const imgData = allImages.find((i) => (i.image_id ?? i.id) === ai.image_id);
              if (!imgData || !ai.image_id) return null;
              return (
                <div
                  key={ai.image_id}
                  className="relative aspect-square w-32 min-w-[8rem] border-2 border-success rounded-lg overflow-hidden bg-success/10 shrink-0"
                >
                  {/* AI suggested badge - top right */}
                  <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    AI Suggested
                  </div>
                  {/* Preview button - top left */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImageId(imgData.upload_id || ai.image_id!);
                    }}
                    className="absolute top-1 left-1 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                    disabled={disabled}
                  >
                    <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                  </button>
                  <ImageViewer
                    imageId={imgData.upload_id || ai.image_id!}
                    name={ai.name || "Image"}
                    bare={true}
                  />
                  {/* Image name at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 z-10">
                    <span className="truncate block">{ai.name || "Image"}</span>
                  </div>
                </div>
              );
            })}

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
                    setPreviewImageId(img.upload_id);
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
                  imageId={img.upload_id}
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
            {selectedImages.length < maxImages && activeUploads.size === 0 && (
              <div
                onClick={() => {
                  if (!disabled && !isUploadingImage && (onImageUpload || finalizeUploadAction)) {
                    effectiveImageInputRef.current?.click();
                  }
                }}
                className={cn(
                  "aspect-square w-32 min-w-[8rem] border-2 border-dashed border-muted-foreground/50 rounded-lg cursor-pointer bg-muted/20 hover:border-muted-foreground hover:bg-muted/50 transition-colors flex flex-col items-center justify-center shrink-0",
                  (disabled || isUploadingImage) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground text-center px-2">
                  Add image
                </p>
              </div>
            )}

            {/* Upload progress indicator */}
            {activeUploads.size > 0 && (
              <div className="aspect-square w-32 min-w-[8rem] border-2 border-dashed border-primary rounded-lg bg-muted/20 flex flex-col items-center justify-center shrink-0">
                {Array.from(activeUploads.values()).map((upload) => (
                  <div key={upload.toastId} className="w-full px-2 text-center">
                    <Loader2 className="h-6 w-6 text-primary mb-1 mx-auto animate-spin" />
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {upload.status === "finalizing" ? "Finalizing..." : `${upload.progress}%`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        {(onImageUpload || finalizeUploadAction) && (
          <input
            ref={effectiveImageInputRef}
            type="file"
            accept="image/*"
            onChange={finalizeUploadAction ? handleInternalUpload : onImageUpload}
            disabled={isUploadingImage || disabled || activeUploads.size > 0}
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
                selectedImages.find((img) => img.upload_id === previewImageId)?.name ||
                "Image"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
