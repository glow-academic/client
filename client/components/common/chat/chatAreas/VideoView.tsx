/**
 * VideoView.tsx
 * Simple video player component for video playback.
 * Questions are now handled separately in QuestionTakingInput (input area).
 */
"use client";

import type { components } from "@/lib/api/schema";

type VideoEntry = components["schemas"]["VideoEntry"];

// Props interface - uses OpenAPI VideoEntry type
export interface VideoViewProps {
  video?: VideoEntry | null;
}

export function VideoView({ video }: VideoViewProps) {
  const videoUrl = video?.upload_id
    ? `/api/uploads/download/${video.upload_id}`
    : null;

  return (
    <div className="flex flex-col">
      {/* Video player - natural aspect ratio, not forced full height */}
      <div className="bg-black flex items-center justify-center">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="w-full max-h-[50vh] object-contain"
          />
        ) : (
          <div className="text-white text-sm p-8">No video available</div>
        )}
      </div>
    </div>
  );
}
