/**
 * Images.tsx
 * Resource component for image selection
 * Redesigned to match ContentSection interface-first pattern with horizontal scrollable row and upload box
 * Pure UI: data in, IDs out via onChange. Parent owns creation.
 */

"use client";

import ImageViewer from "@/components/common/viewers/ImageViewer";
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
import {
  Check,
  Eye,
  Image,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

export interface ImageResourceItem {
  image_id?: string | null;
  id?: string | null;
  name?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface ImageItem {
  id: string;
  name: string;
  description?: string;
  updated_at?: string;
}

export interface ImagesProps {
  image_ids?: string[]; // Current image artifact IDs (standardized prop name)
  image_resources?: ImageResourceItem[]; // Selected image resources (each includes generated field)
  show_images?: boolean; // Whether to show this resource picker
  images_required?: boolean; // Whether this resource is required
  images?: ImageResourceItem[]; // All available images from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update image_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  multiSelect?: boolean; // Whether to allow multiple image selection
  maxImages?: number; // Maximum number of images allowed
  onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Upload handler
  imageInputRef?: React.RefObject<HTMLInputElement>; // Ref for file input
  isUploadingImage?: boolean; // Whether image is currently uploading
  /** Artifact-scoped base path for upload/download URLs (e.g., "/document") */
  uploadBasePath?: string;
  /** Server action to upload a file — receives FormData, returns upload_id */
  uploadFileAction?: (formData: FormData) => Promise<{
    success: boolean;
    upload_id?: string;
    message?: string;
  }>;
  /** Report uploaded image values upward (unified draft pattern -- parent owns creation)
   *  Called after TUS upload + finalize with the creation parameters.
   *  TODO: Server-side DraftImageValue needs upload_id field for file-backed images. */
  onImageUploadValue?: (image: {
    name: string;
    description: string;
    upload_id: string;
  }) => void;
}

export function Images({
  image_ids,
  image_resources,
  show_images = false,
  images_required,
  images,
  disabled = false,
  onChange,
  label = "Images",
  id = "images",
  required = false,
  placeholder = "Select images...",
  description: _description,
  multiSelect = false,
  maxImages = 1,
  onImageUpload,
  imageInputRef,
  isUploadingImage = false,
  uploadBasePath: _uploadBasePath,
  uploadFileAction,
  onImageUploadValue,
}: ImagesProps) {
  const ids = useMemo(() => image_ids ?? [], [image_ids]);
  const show = show_images ?? false;
  const allImages = useMemo(() => images ?? [], [images]);
  const downloadBaseUrl = "/api/system/image";

  // Internal state for selected images (for display)
  const [selectedImages, setSelectedImages] = useState<
    Array<{ id: string; name: string }>
  >(() => {
    if (image_resources && image_resources.length > 0) {
      return image_resources
        .filter((img) => (img.image_id || img.id) && img.name)
        .map((img) => ({
          id: (img.image_id ?? img.id)!,
          name: img.name!,
        }));
    }
    if (ids.length > 0 && allImages.length > 0) {
      return ids
        .map((id) => {
          const img = allImages.find((i) => (i.image_id ?? i.id) === id);
          const imgId = img?.image_id ?? img?.id;
          if (img && imgId && img.name) {
            return { id: imgId, name: img.name };
          }
          return null;
        })
        .filter((img): img is { id: string; name: string } => img !== null);
    }
    return [];
  });

  // Sync selectedImages when ids change
  useEffect(() => {
    if (ids.length > 0 && allImages.length > 0) {
      const newSelectedImages = ids
        .map((id) => {
          const img = allImages.find((i) => (i.image_id ?? i.id) === id);
          const imgId = img?.image_id ?? img?.id;
          if (img && imgId && img.name) {
            return { id: imgId, name: img.name };
          }
          return null;
        })
        .filter((img): img is { id: string; name: string } => img !== null);
      setSelectedImages(newSelectedImages);
    } else if (ids.length === 0) {
      setSelectedImages([]);
    }
  }, [ids, allImages]);

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
        };
      }
    });
    return mapping;
  }, [allImages]);

  const handleImageSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
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
        onImageUploadValue?.({
          name: file.name,
          description: "",
          upload_id: databaseUploadId,
        });

        toast.success(`Upload completed: ${file.name}!`, {
          description: "Image uploaded successfully",
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
      onImageUploadValue,
    ]
  );

  // Internal upload handler for when uploadFileAction is provided
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

  // Pending state: items with pending=true from the API
  const pendingItems = useMemo(
    () => allImages.filter((i) => i.pending === true),
    [allImages]
  );
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((i) => i.image_id ?? i.id).filter(Boolean) as string[]),
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

  // Create internal file input ref if not provided (must be before conditional return)
  const internalImageInputRef = useRef<HTMLInputElement>(null);
  const effectiveImageInputRef = imageInputRef || internalImageInputRef;

  // Don't render if show_images is false (AFTER all hooks)
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
              <Image className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
              {(required || images_required) && (
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
                  downloadBaseUrl={downloadBaseUrl}
                />
                {/* Image name at bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 z-10">
                  <span className="truncate block">{img.name}</span>
                </div>
              </div>
            ))}

            {/* Add Image Box - Show until max (matching ContentSection pattern) */}
            {selectedImages.length < maxImages &&
              activeUploads.size === 0 && (
                <div
                  onClick={() => {
                    if (
                      !disabled &&
                      !isUploadingImage &&
                      (onImageUpload || uploadFileAction)
                    ) {
                      effectiveImageInputRef.current?.click();
                    }
                  }}
                  className={cn(
                    "aspect-square w-32 min-w-[8rem] border-2 border-dashed border-muted-foreground/50 rounded-lg cursor-pointer bg-muted/20 hover:border-muted-foreground hover:bg-muted/50 transition-colors flex flex-col items-center justify-center shrink-0",
                    (disabled || isUploadingImage) &&
                      "opacity-50 cursor-not-allowed"
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
                  <div
                    key={upload.toastId}
                    className="w-full px-2 text-center"
                  >
                    <Loader2 className="h-6 w-6 text-primary mb-1 mx-auto animate-spin" />
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {upload.status === "finalizing"
                        ? "Finalizing..."
                        : `${upload.progress}%`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        {(onImageUpload || uploadFileAction) && (
          <input
            ref={effectiveImageInputRef}
            type="file"
            accept="image/*"
            onChange={
              uploadFileAction ? handleInternalUpload : onImageUpload
            }
            disabled={
              isUploadingImage || disabled || activeUploads.size > 0
            }
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
                selectedImages.find(
                  (img) => img.id === previewImageId
                )?.name || "Image"
              }
              downloadBaseUrl={downloadBaseUrl}
            />
          </div>
        </div>
      )}
    </div>
  );
}
