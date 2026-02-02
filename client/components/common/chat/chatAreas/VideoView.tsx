/**
 * VideoView.tsx
 * Video player with timestamp-based questions
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import type { components } from "@/lib/api/schema";
import { useCallback, useRef, useState } from "react";
import { QuestionResponsesInput } from "../inputAreas/QuestionResponsesInput";

// ---- OpenAPI types (single source of truth) ----
type QuestionEntry = components["schemas"]["QuestionEntry"];
type QuizResponse = components["schemas"]["QuizResponse"];

// Props interface using OpenAPI types
export interface VideoViewProps {
  video: { id: string; upload_id: string };
  questions: QuestionEntry[];
  responses: QuizResponse[];
  on_submit_response: (question_id: string, option_ids: string[]) => void;
  disabled?: boolean;
}

export function VideoView({
  video,
  questions,
  responses,
  on_submit_response,
  disabled = false,
}: VideoViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Filter questions that should be shown at current timestamp
  // A question is visible if current time is within 2 seconds of any of its trigger times
  const visibleQuestions = questions.filter((q) => {
    const qId = q.question_id;
    const times = q.times || [];
    // If question has been answered, always show it
    const hasResponse = responses.some((r) => r.question_id === qId);
    if (hasResponse) return true;

    // Otherwise, show if we're at/past any of its trigger times
    return times.some((t) => currentTime >= t && currentTime < t + 30);
  });

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = Math.floor(videoRef.current.currentTime);
      setCurrentTime(time);

      // Pause video when reaching a question timestamp (if not already answered)
      for (const q of questions) {
        const qId = q.question_id;
        const times = q.times || [];
        const hasResponse = responses.some((r) => r.question_id === qId);
        if (!hasResponse && times.includes(time) && !isPaused) {
          videoRef.current.pause();
          setIsPaused(true);
          break;
        }
      }
    }
  }, [questions, responses, isPaused]);

  const handlePlay = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handleSubmit = useCallback(
    (questionId: string, optionIds: string[]) => {
      on_submit_response(questionId, optionIds);
      // Resume video after answering
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play();
      }
    },
    [on_submit_response]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Video player */}
      <div className="flex-1 bg-black flex items-center justify-center min-h-0">
        <video
          ref={videoRef}
          src={`/api/v4/videos/${video.id}/stream`}
          controls
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
        />
      </div>

      {/* Questions panel - shows when there are visible questions */}
      {visibleQuestions.length > 0 && (
        <div className="border-t max-h-[40%] overflow-y-auto">
          <QuestionResponsesInput
            questions={visibleQuestions}
            responses={responses}
            on_submit={handleSubmit}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
