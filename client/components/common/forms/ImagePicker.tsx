/**
 * ImagePicker.tsx
 * Shared component for image upload and selection
 * Used by both Scenario.tsx and Video.tsx
 */

"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Image = {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
  active: boolean;
};

type ImagePickerProps = {
  images: Image[];
  onImagesChange: (images: Image[]) => void;
  disabled?: boolean;
  readonly?: boolean;
  finalizeUploadAction?: (
    input: { uploadId: string; fileId: string; name: string }
  ) => Promise<{ success: boolean; imageId?: string; message: string }>;
};

export function ImagePicker({
  images,
  onImagesChange,
  disabled = false,
  readonly = false,
  finalizeUploadAction,
}: ImagePickerProps) {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (!finalizeUploadAction) {
      toast.error("Image upload finalize action is required");
      return;
    }

    setIsUploadingImage(true);
    const toastId = toast.loading(`Uploading image: ${file.name}`, {
      description: "0% complete",
      dismissible: true,
    });

    try {
      // Generate a unique fileId for tracking
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Create TUS upload
      const upload = new tus.Upload(file, {
        endpoint: `/api/images/upload`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type,
          fileId: fileId,
        },
        onError: (error) => {
          toast.error(`Upload failed: ${file.name}`, {
            description: error.message || "An error occurred during upload",
            id: toastId,
          });
          setIsUploadingImage(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          toast.loading(`Uploading image: ${file.name}`, {
            description: `${percentage}% complete`,
            id: toastId,
          });
        },
        onSuccess: async () => {
          // Get upload ID from location header
          const location = upload.url;
          const uploadId = location.split("/").pop();

          if (!uploadId) {
            throw new Error("Failed to get upload ID");
          }

          // Finalize upload
          try {
            const result = await finalizeUploadAction({
              uploadId,
              fileId,
              name: file.name,
            });

            if (result.success && result.imageId) {
              // Create image object with the returned imageId
              const newImage: Image = {
                id: result.imageId,
                name: file.name,
                file_path: `/api/images/upload/${uploadId}`, // Temporary path, will be updated by backend
                mime_type: file.type,
                active: true,
              };

              onImagesChange([...images, newImage]);
              toast.success(`Image uploaded: ${file.name}`, { id: toastId });
            } else {
              throw new Error(result.message || "Failed to finalize upload");
            }
          } catch (finalizeError) {
            toast.error(
              `Failed to finalize upload: ${
                finalizeError instanceof Error
                  ? finalizeError.message
                  : "Unknown error"
              }`,
              { id: toastId }
            );
          } finally {
            setIsUploadingImage(false);
          }
        },
      });

      upload.start();
    } catch (error) {
      toast.error(
        `Failed to upload image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          id: toastId,
        }
      );
      setIsUploadingImage(false);
    }

    // Reset input
    e.target.value = "";
  };

  const handleRemoveImage = (imageId: string) => {
    onImagesChange(images.filter((img) => img.id !== imageId));
  };

  return (
    <div className="space-y-2">
      <Label>Reference Images</Label>
      <div className="space-y-2">
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative flex items-center gap-2 rounded border p-2"
              >
                <img
                  src={img.file_path}
                  alt={img.name}
                  className="h-12 w-12 rounded object-cover"
                />
                <div className="flex-1 truncate text-sm">{img.name}</div>
                {!readonly && !disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveImage(img.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {!readonly && !disabled && (
          <div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileSelect}
              disabled={isUploadingImage || disabled}
              className="hidden"
              id="image-upload-input"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage || disabled}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploadingImage ? "Uploading..." : "Upload Image"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

