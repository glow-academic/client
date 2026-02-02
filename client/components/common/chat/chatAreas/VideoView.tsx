/**
 * VideoView.tsx
 * Simple video player component for video playback.
 * Questions are now handled separately in QuestionTakingInput (input area).
 */
"use client";

// Props interface - simplified to only handle video
export interface VideoViewProps {
  video: { id: string; upload_id: string };
}

export function VideoView({ video }: VideoViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Video player */}
      <div className="flex-1 bg-black flex items-center justify-center min-h-0">
        <video
          src={`/api/v4/videos/${video.id}/stream`}
          controls
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
