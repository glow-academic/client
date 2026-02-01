/**
 * VideoView.tsx
 * Video player with timestamp-based questions
 * Questions appear when video reaches their trigger time
 * Uses QuestionResponsesInput for question display
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { QuestionResponsesInput } from "../inputAreas/QuestionResponsesInput";

// Simplified prop interface - only what we need
export interface VideoViewProps {
  video: {
    id: string;
    upload_id: string;
  };

  // Questions with timestamps (times = when to show)
  questions: Array<{
    id: string;
    question_text: string;
    allow_multiple: boolean;
    times: number[]; // Seconds when to show this question
    options: Array<{
      id: string;
      option_text: string;
      is_correct: boolean;
    }>;
  }>;

  // Responses from server (passed through to QuestionResponsesInput)
  responses: Array<{
    question_id: string;
    option_id: string;
  }>;

  // Callback when user submits answer
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
    // If question has been answered, always show it
    const hasResponse = responses.some((r) => r.question_id === q.id);
    if (hasResponse) return true;

    // Otherwise, show if we're at/past any of its trigger times
    return q.times.some((t) => currentTime >= t && currentTime < t + 30);
  });

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = Math.floor(videoRef.current.currentTime);
      setCurrentTime(time);

      // Pause video when reaching a question timestamp (if not already answered)
      for (const q of questions) {
        const hasResponse = responses.some((r) => r.question_id === q.id);
        if (!hasResponse && q.times.includes(time) && !isPaused) {
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
