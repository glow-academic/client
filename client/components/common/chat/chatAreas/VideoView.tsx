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


  // Handle marker click - seek video and navigate to question
  const handleMarkerClick = (marker: { time: number; questionIndex: number }) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = marker.time;
    }
    onNavigateToQuestion?.(marker.questionIndex);
  };


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

      {/* Question markers bar - only show if we have questions */}
      {questions.length > 0 && videoDuration > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-t text-xs">
          <span className="text-muted-foreground whitespace-nowrap">Questions:</span>
          <div className="flex items-center gap-1">
            {markers.map((marker, idx) => {
              const isActive = Math.abs(currentTime - marker.time) < 2;

              return (
                <button
                  key={`${marker.questionId}-${marker.time}-${idx}`}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handleMarkerClick(marker)}
                  title={`Jump to ${formatTime(marker.time)}`}
                >
                  Q{marker.questionIndex + 1}
                </button>
              );
            })}
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
