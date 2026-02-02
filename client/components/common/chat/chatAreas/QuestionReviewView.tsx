/**
 * QuestionReviewView.tsx
 * Chat area component for graded video mode - shows all questions with full feedback.
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api/schema";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

// ---- OpenAPI types (single source of truth) ----
type QuestionEntry = components["schemas"]["QuestionEntry"];
type QuizResponse = components["schemas"]["QuizResponse"];

// Props interface using OpenAPI types
export interface QuestionReviewViewProps {
  questions: QuestionEntry[];
  responses: QuizResponse[];
}

export function QuestionReviewView({
  questions,
  responses,
}: QuestionReviewViewProps) {
  // Build lookup: question_id -> selected option_ids from server responses
  const responsesByQuestion = new Map<string, string[]>();
  for (const r of responses) {
    const qId = r.question_id;
    const oId = r.option_id;
    if (!qId || !oId) continue;
    const existing = responsesByQuestion.get(qId) || [];
    existing.push(oId);
    responsesByQuestion.set(qId, existing);
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No questions to review
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {questions.map((question, index) => {
        const qId = question.question_id || "";
        const serverResponse = responsesByQuestion.get(qId);
        const hasResponse = serverResponse && serverResponse.length > 0;
        const options = question.options || [];

        return (
          <div key={qId} className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <span className="text-muted-foreground">Q{index + 1}.</span>
                {question.question_text}
              </Label>
              {!hasResponse && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full whitespace-nowrap">
                  <MinusCircle className="h-3 w-3" />
                  Not answered
                </span>
              )}
            </div>

            <div className="space-y-2 pl-4">
              {options.map((option) => {
                const optId = option.option_id || "";
                const wasSelected = hasResponse && serverResponse.includes(optId);
                const isCorrect = option.is_correct;

                let bgClass = "bg-muted/30";
                let icon = null;

                if (hasResponse) {
                  if (wasSelected && isCorrect) {
                    // Correct answer selected - green
                    bgClass =
                      "bg-green-100 dark:bg-green-900/30 border-green-300";
                    icon = <CheckCircle2 className="h-4 w-4 text-green-600" />;
                  } else if (wasSelected && !isCorrect) {
                    // Wrong answer selected - red
                    bgClass = "bg-red-100 dark:bg-red-900/30 border-red-300";
                    icon = <XCircle className="h-4 w-4 text-red-600" />;
                  } else if (!wasSelected && isCorrect) {
                    // Correct answer they missed - faded green
                    bgClass =
                      "bg-green-50 dark:bg-green-900/20 border-green-200";
                    icon = <CheckCircle2 className="h-4 w-4 text-green-400" />;
                  }
                } else {
                  // Not answered - show correct answers with faded green
                  if (isCorrect) {
                    bgClass =
                      "bg-green-50 dark:bg-green-900/20 border-green-200";
                    icon = <CheckCircle2 className="h-4 w-4 text-green-400" />;
                  }
                }

                return (
                  <div
                    key={optId}
                    className={`flex items-center gap-2 p-2 rounded border ${bgClass}`}
                  >
                    {icon}
                    <span className="text-sm">{option.option_text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
