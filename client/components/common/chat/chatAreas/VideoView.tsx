/**
 * VideoView.tsx
 * Video player component with custom shadcn-themed controls and timeline markers.
 * Questions are handled separately in QuestionTakingInput (input area).
 *
 * Features:
 * - Locks video progress until questions are answered
 * - Shows locked portions as grey/disabled
 * - Supports multiple questions at same timestamp
 * - Navigates to first unanswered question when marker clicked
 */
"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { Lock, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";

type VideoEntry = components["schemas"]["VideoEntry"];
type QuestionEntry = components["schemas"]["QuestionEntry"];
type QuizResponse = components["schemas"]["QuizResponse"];

// Props interface
export interface VideoViewProps {
  video?: VideoEntry | null;
  questions?: QuestionEntry[];
  responses?: QuizResponse[];
  onNavigateToQuestion?: (questionIndex: number) => void;
}

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoView({
  video,
  questions = [],
  responses = [],
  onNavigateToQuestion
}: VideoViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const videoUrl = video?.upload_id
    ? `/api/uploads/download/${video.upload_id}`
    : null;

  // Use video.length_seconds as fallback for duration
  const videoDuration = duration || video?.length_seconds || 0;

  // Build set of answered question IDs
  const answeredQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of responses) {
      if (r.question_id) {
        ids.add(String(r.question_id));
      }
    }
    return ids;
  }, [responses]);

  // Build markers from questions with answered status
  const markers = useMemo(() => {
    return questions.flatMap((question, questionIndex) => {
      const times = question.times || [];
      const isAnswered = answeredQuestionIds.has(String(question.question_id));
      return times.map((time) => ({
        time,
        questionIndex,
        questionId: question.question_id,
        isAnswered,
      }));
    });
  }, [questions, answeredQuestionIds]);

  // Group markers by timestamp for display
  const groupedMarkers = useMemo(() => {
    const groups = new Map<number, typeof markers>();
    for (const marker of markers) {
      const existing = groups.get(marker.time) || [];
      existing.push(marker);
      groups.set(marker.time, existing);
    }
    return groups;
  }, [markers]);

  // Calculate max allowed time - first unanswered question's timestamp
  // If all answered, allow full video
  const maxAllowedTime = useMemo(() => {
    // Sort markers by time to find first unanswered
    const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);
    for (const marker of sortedMarkers) {
      if (!marker.isAnswered) {
        // Lock at exactly this question's timestamp
        return marker.time;
      }
    }
    // All questions answered - allow full video
    return videoDuration;
  }, [markers, videoDuration]);

  // Clamp time to max allowed
  const clampTime = useCallback((time: number) => {
    return Math.min(time, maxAllowedTime);
  }, [maxAllowedTime]);

  // Find the first unanswered question index at maxAllowedTime
  const firstUnansweredQuestionIndex = useMemo(() => {
    const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);
    for (const marker of sortedMarkers) {
      if (!marker.isAnswered) {
        return marker.questionIndex;
      }
    }
    return null;
  }, [markers]);

  // Update current time as video plays (with clamping)
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && !isDragging) {
      const video = videoRef.current;
      // If video exceeds max allowed time, pause and seek back
      if (video.currentTime > maxAllowedTime) {
        video.pause();
        video.currentTime = maxAllowedTime;
        setCurrentTime(maxAllowedTime);
        setIsPlaying(false);
        // Auto-navigate to the first unanswered question
        if (firstUnansweredQuestionIndex !== null) {
          onNavigateToQuestion?.(firstUnansweredQuestionIndex);
        }
      } else {
        setCurrentTime(video.currentTime);
      }
    }
  }, [isDragging, maxAllowedTime, firstUnansweredQuestionIndex, onNavigateToQuestion]);

  // Get duration when video loads
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // Don't allow play if already at max allowed time
      if (video.currentTime >= maxAllowedTime) {
        return;
      }
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [maxAllowedTime]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Handle fullscreen change from ESC key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Sync play state with video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  // Calculate position from mouse/touch event (with clamping)
  const getPositionFromEvent = useCallback((e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    const progress = progressRef.current;
    if (!progress || videoDuration <= 0) return 0;

    const rect = progress.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const time = (x / rect.width) * videoDuration;
    return clampTime(time);
  }, [videoDuration, clampTime]);

  // Handle progress bar click/drag
  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const time = getPositionFromEvent(e);
    setCurrentTime(time);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const time = getPositionFromEvent(moveEvent);
      setCurrentTime(time);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const time = getPositionFromEvent(upEvent);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [getPositionFromEvent]);

  // Handle marker click - navigate to first unanswered question at that timestamp
  const handleMarkerClick = useCallback((e: React.MouseEvent, markersAtTime: typeof markers) => {
    e.stopPropagation();

    // Find first unanswered question at this timestamp, or first if all answered
    const firstUnanswered = markersAtTime.find(m => !m.isAnswered);
    const targetMarker = firstUnanswered || markersAtTime[0];

    if (!targetMarker) return;

    const video = videoRef.current;
    // Only seek if within allowed range
    const seekTime = clampTime(targetMarker.time);
    if (video) {
      video.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
    onNavigateToQuestion?.(targetMarker.questionIndex);
  }, [onNavigateToQuestion, clampTime]);

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }

    let timeout: NodeJS.Timeout;
    const resetTimeout = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    resetTimeout();

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", resetTimeout);
      container.addEventListener("touchstart", resetTimeout);
    }

    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener("mousemove", resetTimeout);
        container.removeEventListener("touchstart", resetTimeout);
      }
    };
  }, [isPlaying]);

  const progress = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  const allowedProgress = videoDuration > 0 ? (maxAllowedTime / videoDuration) * 100 : 100;
  const isLocked = maxAllowedTime < videoDuration;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col bg-black group",
        isFullscreen && "h-screen w-screen"
      )}
    >
      {/* Video element - no native controls */}
      <div
        className="flex-1 flex items-center justify-center cursor-pointer"
        onClick={togglePlay}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className={cn(
              "w-full object-contain",
              isFullscreen ? "max-h-[calc(100vh-60px)]" : "max-h-[50vh]"
            )}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
          />
        ) : (
          <div className="text-white text-sm p-8">No video available</div>
        )}
      </div>

      {/* Custom controls overlay */}
      {videoUrl && (
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300",
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Progress bar with markers */}
          <div
            ref={progressRef}
            className="relative h-6 px-3 cursor-pointer group/progress"
            onMouseDown={handleProgressMouseDown}
          >
            {/* Track background - full track */}
            <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-white/20 rounded-full overflow-hidden">
              {/* Allowed portion background */}
              <div
                className="absolute left-0 top-0 h-full bg-white/30"
                style={{ width: `${allowedProgress}%` }}
              />
              {/* Locked portion - darker/disabled */}
              {isLocked && (
                <div
                  className="absolute top-0 h-full bg-white/10"
                  style={{ left: `${allowedProgress}%`, right: 0 }}
                />
              )}
              {/* Progress fill - only in allowed area */}
              <div
                className="absolute left-0 top-0 h-full bg-white rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Scrubber thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(12px + (100% - 24px) * ${progress / 100})` }}
            />

            {/* Question markers - grouped by timestamp */}
            {Array.from(groupedMarkers.entries()).map(([time, markersAtTime]) => {
              const markerProgress = videoDuration > 0 ? (time / videoDuration) * 100 : 0;
              const isActive = Math.abs(currentTime - time) < 2;
              const allAnswered = markersAtTime.every(m => m.isAnswered);
              const isInLockedArea = time > maxAllowedTime;

              // Build tooltip text
              const questionLabels = markersAtTime
                .map(m => `Q${m.questionIndex + 1}`)
                .join(", ");
              const unansweredCount = markersAtTime.filter(m => !m.isAnswered).length;

              return (
                <Tooltip key={`marker-${time}`}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-black/50 z-10",
                        // Size based on number of questions
                        markersAtTime.length > 1 ? "w-3.5 h-3.5" : "w-2.5 h-2.5",
                        // Color based on answered status and locked area
                        isInLockedArea
                          ? "bg-white/30 cursor-not-allowed"
                          : allAnswered
                            ? "bg-green-400 hover:scale-150"
                            : "bg-amber-400 hover:scale-150",
                        isActive && !isInLockedArea && "scale-125"
                      )}
                      style={{ left: `calc(12px + (100% - 24px) * ${markerProgress / 100})` }}
                      onClick={(e) => !isInLockedArea && handleMarkerClick(e, markersAtTime)}
                      disabled={isInLockedArea}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs bg-black/90 text-white border-none">
                    <div className="flex flex-col gap-0.5">
                      <span>{questionLabels} at {formatTime(time)}</span>
                      {isInLockedArea ? (
                        <span className="text-white/60">Answer previous questions to unlock</span>
                      ) : unansweredCount > 0 ? (
                        <span className="text-amber-300">{unansweredCount} unanswered</span>
                      ) : (
                        <span className="text-green-300">All answered</span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 px-3 pb-2">
            {/* Play/Pause */}
            <button
              className={cn(
                "h-8 w-8 flex items-center justify-center transition-colors",
                currentTime >= maxAllowedTime
                  ? "text-white/40 cursor-not-allowed"
                  : "text-white hover:text-white/80"
              )}
              onClick={togglePlay}
              disabled={currentTime >= maxAllowedTime}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </button>

            {/* Volume */}
            <button
              className="h-8 w-8 flex items-center justify-center text-white hover:text-white/80 transition-colors"
              onClick={toggleMute}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>

            {/* Time display */}
            <span className="text-white text-xs font-mono ml-1">
              {formatTime(currentTime)} / {formatTime(videoDuration)}
            </span>

            {/* Lock indicator */}
            {isLocked && (
              <span className="text-white/60 text-xs flex items-center gap-1 ml-2">
                <Lock className="h-3 w-3" />
                Answer question to continue
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Fullscreen */}
            <button
              className="h-8 w-8 flex items-center justify-center text-white hover:text-white/80 transition-colors"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
