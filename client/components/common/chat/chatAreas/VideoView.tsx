/**
 * VideoView.tsx
 * Separate video player view (not part of MessagesView)
 * Video playback with controls and questions overlay
 * Explicit, self-contained types (like resource components)
 */
"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

// Explicit, self-contained prop interface (like resource components)
export interface VideoViewProps {
  video_data: {
    id: string;
    upload_id: string | null;
  };
  video_questions?: Array<{
    id: string;
    question_text: string;
    type: string;
    allow_multiple: boolean | null;
    times: Array<number> | null;
    options: Array<{
      id: string;
      option_text: string;
      type: string | null;
      is_correct: boolean | null;
    }> | null;
  }>;
  on_question_submit?: (answers: Map<string, string[]>) => void;
  disabled?: boolean;
}

export function VideoView({
  video_data,
  video_questions = [],
  on_question_submit,
  disabled = false,
}: VideoViewProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Map<string, string[]>>(
    new Map()
  );

  const handleAnswerChange = (questionId: string, answerIds: string[]) => {
    setSelectedAnswers((prev) => {
      const newMap = new Map(prev);
      newMap.set(questionId, answerIds);
      return newMap;
    });
  };

  const handleSubmit = () => {
    if (on_question_submit) {
      on_question_submit(selectedAnswers);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Questions at top */}
      {video_questions.length > 0 && (
        <div className="border-b p-4 space-y-4">
          <h2 className="text-lg font-semibold">Questions</h2>
          {video_questions.map((question, idx) => (
            <div key={question.id || idx} className="space-y-2">
              <p className="font-medium">{question.question_text || ""}</p>
              {question.options && question.options.length > 0 && (
                <div className="space-y-1 pl-4">
                  {question.options.map((option) => (
                    <div
                      key={option.id || ""}
                      className={`p-2 rounded border ${
                        option.is_correct
                          ? "bg-green-50 border-green-200"
                          : "bg-muted/50"
                      }`}
                    >
                      {option.option_text || ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video player in main area */}
      <div className="flex-1 bg-black flex items-center justify-center">
        {video_data.upload_id ? (
          <video
            src={`/api/v4/videos/${video_data.id}/stream`}
            controls
            className="w-full h-full object-contain"
            disabled={disabled}
          />
        ) : (
          <div className="text-white">Video not available</div>
        )}
      </div>

      {/* Submit button below video */}
      {video_questions.length > 0 && (
        <div className="border-t p-4">
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={disabled || selectedAnswers.size === 0}
          >
            Submit Answers
          </Button>
        </div>
      )}
    </div>
  );
}
