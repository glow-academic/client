/**
 * ImagePreviewCard.tsx
 * Image preview card with preview functionality
 */

"use client";

import ImageViewer from "@/components/common/chat/viewers/ImageViewer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, X } from "lucide-react";
import * as React from "react";

type ImageItem = {
  id: string;
  name: string;
  mime_type?: string;
};

export interface ImagePreviewCardProps {
  image: ImageItem;
  onRemove?: () => void;
  showActions?: boolean;
  className?: string;
}

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export function ImagePreviewCard({
  image,
  onRemove,
  showActions = true,
  className = "",
}: ImagePreviewCardProps) {
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);

  const handlePreview = () => {
    setShowPreviewDialog(true);
  };

  return (
    <>
      <div
        className={`group relative border rounded-lg hover:shadow-md transition-all bg-white ${className}`}
        data-testid="image-card"
        data-image-id={image.id}
      >
        {/* Action buttons - Preview and Remove icons on hover */}
        {showActions && (
          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 md:h-7 md:w-7 p-0 bg-white/90 backdrop-blur-sm"
              onClick={handlePreview}
              aria-label={`Preview image ${image.name}`}
              data-testid="btn-preview-image"
            >
              <Eye className="h-3.5 w-3.5 md:h-3 md:w-3" />
            </Button>
            {onRemove && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 md:h-7 md:w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
                onClick={onRemove}
                aria-label={`Remove image ${image.name}`}
                data-testid="btn-remove-image"
              >
                <X className="h-3.5 w-3.5 md:h-3 md:w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Image preview area */}
        <div
          className="aspect-square bg-muted rounded-lg relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handlePreview}
          style={{ cursor: "pointer" }}
        >
          {/* Image preview */}
          <div className="w-full h-full">
            <ImageViewer
              imageId={image.id}
              name={image.name}
              {...(image.mime_type && { mimeType: image.mime_type })}
              bare={true}
            />
          </div>

          {/* Image name */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded max-w-[calc(100%-1rem)]">
            <span title={image.name}>{truncateText(image.name, 25)}</span>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-4xl h-full max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{image.name}</DialogTitle>
            <DialogDescription>Image Preview</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ImageViewer
              imageId={image.id}
              name={image.name}
              {...(image.mime_type && { mimeType: image.mime_type })}
              bare={true}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
