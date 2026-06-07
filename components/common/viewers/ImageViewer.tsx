"use client";

import { FileText } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export interface ImageViewerProps {
  imageId: string;
  name?: string;
  mimeType?: string;
  bare?: boolean;
  compact?: boolean;
  /** Base URL for downloads. */
  downloadBaseUrl: string;
}

export default function ImageViewer({
  imageId,
  name,
  mimeType,
  bare = true,
  compact: _compact = false,
  downloadBaseUrl,
}: ImageViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(mimeType || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the live blob URL in a ref so the in-flight fetch can still
  // reach (and the next effect run can revoke) a URL created after this
  // effect's own cleanup has already fired — see DocumentViewer.tsx.
  const blobUrlRef = useRef<string | null>(null);

  // Load image
  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(null);

        // Revoke any blob URL left over from a previous load before
        // creating a new one.
        if (blobUrlRef.current && blobUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        setContent(null);

        const response = await fetch(`${downloadBaseUrl}/${imageId}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          let errorMessage = `Failed to load image: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch {
            // If not JSON, use the default error message
          }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type") ?? "";

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // The imageId/downloadBaseUrl changed (or we unmounted) while the
        // fetch was in flight: don't touch state and revoke the just-made
        // URL ourselves, since this effect's cleanup already ran with no
        // URL to revoke.
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        blobUrlRef.current = blobUrl;
        setType(contentType);
        setContent(blobUrl);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadImage();

    // Cleanup on unmount or when imageId/downloadBaseUrl changes.
    return () => {
      cancelled = true;
      if (blobUrlRef.current && blobUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [imageId, downloadBaseUrl]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Failed to load image</p>
        </div>
      );
    }

    // Image viewer - responsive and fit to width
    // Only render if content is a valid non-empty string
    if (type?.includes("image/") && content && content.trim() !== "") {
      return (
        <div className="w-full h-full">
          <Image
            src={content}
            alt={name || "Image"}
            className="w-full h-full object-cover"
            width={0}
            height={0}
            sizes="100vw"
            unoptimized
          />
        </div>
      );
    }

    // Unsupported file type
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Preview not available</p>
      </div>
    );
  };

  // Render image view
  if (bare) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">
            {name || "Image"}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0">{renderContent()}</div>
    </div>
  );
}
