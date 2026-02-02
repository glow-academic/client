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
    <div className="flex flex-col h-full">
      {/* Video player */}
      <div className="flex-1 bg-black flex items-center justify-center min-h-0">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-white text-sm">No video available</div>
        )}
      </div>
    </div>
  );
}
