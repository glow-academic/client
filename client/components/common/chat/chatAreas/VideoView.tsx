/**
 * VideoView.tsx
 * Video player component with custom shadcn-themed controls and timeline markers.
 * Questions are handled separately in QuestionTakingInput (input area).
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";

type VideoEntry = components["schemas"]["VideoEntry"];
type QuestionEntry = components["schemas"]["QuestionEntry"];

// Props interface
export interface VideoViewProps {
  video?: VideoEntry | null;
  questions?: QuestionEntry[];
  onNavigateToQuestion?: (questionIndex: number) => void;
}

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoView({ video, questions = [], onNavigateToQuestion }: VideoViewProps) {
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
    if (videoRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [isDragging]);

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
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

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

  // Calculate position from mouse/touch event
  const getPositionFromEvent = useCallback((e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    const progress = progressRef.current;
    if (!progress || videoDuration <= 0) return 0;

    const rect = progress.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * videoDuration;
  }, [videoDuration]);

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

  // Handle marker click
  const handleMarkerClick = useCallback((e: React.MouseEvent, marker: { time: number; questionIndex: number }) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      video.currentTime = marker.time;
      setCurrentTime(marker.time);
    }
    onNavigateToQuestion?.(marker.questionIndex);
  }, [onNavigateToQuestion]);

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
            {/* Track background */}
            <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-white/30 rounded-full">
              {/* Progress fill */}
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

            {/* Question markers */}
            {markers.map((marker, idx) => {
              const markerProgress = videoDuration > 0 ? (marker.time / videoDuration) * 100 : 0;
              const isActive = Math.abs(currentTime - marker.time) < 2;

              return (
                <Tooltip key={`${marker.questionId}-${marker.time}-${idx}`}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 transition-transform hover:scale-150 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-black/50 z-10",
                        isActive && "scale-125"
                      )}
                      style={{ left: `calc(12px + (100% - 24px) * ${markerProgress / 100})` }}
                      onClick={(e) => handleMarkerClick(e, marker)}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs bg-black/90 text-white border-none">
                    Q{marker.questionIndex + 1} at {formatTime(marker.time)}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 px-3 pb-2">
            {/* Play/Pause */}
            <button
              className="h-8 w-8 flex items-center justify-center text-white hover:text-white/80 transition-colors"
              onClick={togglePlay}
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
