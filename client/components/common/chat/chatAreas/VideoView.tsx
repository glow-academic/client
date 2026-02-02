/**
 * VideoView.tsx
 * Video player component with timeline markers for questions.
 * Questions are handled separately in QuestionTakingInput (input area).
 */
"use client";

import type { components } from "@/lib/api/schema";
import { useRef, useState, useCallback } from "react";

type VideoEntry = components["schemas"]["VideoEntry"];
type QuestionEntry = components["schemas"]["QuestionEntry"];

// Props interface
export interface VideoViewProps {
  video?: VideoEntry | null;
  questions?: QuestionEntry[];
  onNavigateToQuestion?: (questionIndex: number) => void;
}

export function VideoView({ video, questions = [], onNavigateToQuestion }: VideoViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoUrl = video?.upload_id
    ? `/api/uploads/download/${video.upload_id}`
    : null;

  // Use video.length_seconds as fallback for duration
  const videoDuration = duration || video?.length_seconds || 0;

  // Build markers from questions
  const markers = questions.flatMap((question, questionIndex) => {
    const times = question.times || [];
    return times.map((time) => ({
      time,
      questionIndex,
      questionId: question.question_id,
    }));
  });

  // Update current time as video plays
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Get duration when video loads
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);


  // Handle marker click
  const handleMarkerClick = (marker: { time: number; questionIndex: number }) => {
    // Seek video to timestamp
    if (videoRef.current) {
      videoRef.current.currentTime = marker.time;
    }
    // Navigate to question
    onNavigateToQuestion?.(marker.questionIndex);
  };

  // Handle progress bar click (seek)
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !videoDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * videoDuration;
    videoRef.current.currentTime = newTime;
  };

  // Calculate progress percentage
  const progressPercent = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  return (
    <div className="flex flex-col">
      {/* Video player */}
      <div className="bg-black flex items-center justify-center relative">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full max-h-[50vh] object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          />
        ) : (
          <div className="text-white text-sm p-8">No video available</div>
        )}
      </div>

      {/* Custom progress bar with markers - only show if we have questions */}
      {questions.length > 0 && videoDuration > 0 && (
        <div className="px-2 py-2 bg-muted/50 border-t">
          <div
            className="relative h-6 bg-muted rounded cursor-pointer group"
            onClick={handleProgressClick}
          >
            {/* Progress fill */}
            <div
              className="absolute left-0 top-0 h-full bg-primary/30 rounded-l transition-all"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Playhead */}
            <div
              className="absolute top-0 h-full w-0.5 bg-primary transition-all"
              style={{ left: `${progressPercent}%` }}
            />

            {/* Question markers */}
            {markers.map((marker, idx) => {
              const markerPercent = (marker.time / videoDuration) * 100;
              const isActive = Math.abs(currentTime - marker.time) < 2; // Within 2 seconds

              return (
                <button
                  key={`${marker.questionId}-${marker.time}-${idx}`}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                    isActive
                      ? "bg-primary border-primary-foreground scale-110"
                      : "bg-background border-primary hover:bg-primary/20"
                  }`}
                  style={{ left: `${markerPercent}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkerClick(marker);
                  }}
                  title={`Question ${marker.questionIndex + 1} at ${formatTime(marker.time)}`}
                >
                  <span className="sr-only">
                    Go to Question {marker.questionIndex + 1}
                  </span>
                </button>
              );
            })}

            {/* Time display */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              {formatTime(currentTime)} / {formatTime(videoDuration)}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border-2 border-primary bg-background" />
              <span>Question marker</span>
            </div>
            <span className="text-muted-foreground/50">•</span>
            <span>Click marker to jump to question</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
