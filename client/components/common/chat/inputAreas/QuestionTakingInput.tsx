/**
 * QuestionTakingInput.tsx
 * Question input component for taking mode - shows one question at a time with navigation.
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { components } from "@/lib/api/schema";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

// ---- OpenAPI types (single source of truth) ----
type QuestionEntry = components["schemas"]["QuestionEntry"];
type QuizResponse = components["schemas"]["QuizResponse"];

// Props interface using OpenAPI types
export interface QuestionTakingInputProps {
  questions: QuestionEntry[];
  responses: QuizResponse[]; // Shows "you picked this" on resume - no feedback
  on_submit: (question_id: string, option_ids: string[]) => void;
  disabled?: boolean;
  // Controlled navigation props (optional)
  questionIndex?: number;
  onQuestionIndexChange?: (index: number) => void;
}

export function QuestionTakingInput({
  questions,
  responses,
  on_submit,
  disabled = false,
  questionIndex,
  onQuestionIndexChange,
}: QuestionTakingInputProps) {
  // Build lookup: question_id -> selected option_ids from server responses
  const responsesByQuestion = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of responses) {
      const qId = r.question_id;
      const oId = r.option_id;
      if (!qId || !oId) continue;
      const existing = map.get(qId) || [];
      existing.push(oId);
      map.set(qId, existing);
    }
    return map;
  }, [responses]);

  // Internal state for uncontrolled mode
  const [internalIndex, setInternalIndex] = useState(() => {
    // Start at first unanswered question, or 0 if all answered
    const firstUnanswered = questions.findIndex(
      (q) => !responsesByQuestion.has(q.question_id || "")
    );
    return firstUnanswered >= 0 ? firstUnanswered : 0;
  });

  // Use controlled index if provided, otherwise internal
  const isControlled = questionIndex !== undefined;
  const currentIndex = isControlled ? questionIndex : internalIndex;

  // Unified setter that works for both controlled and uncontrolled modes
  const setCurrentIndex = (newIndex: number) => {
    if (isControlled) {
      onQuestionIndexChange?.(newIndex);
    } else {
      setInternalIndex(newIndex);
    }
  };

  // Sync internal index when controlled index changes from parent (e.g., marker click)
  useEffect(() => {
    if (isControlled && questionIndex !== internalIndex) {
      setInternalIndex(questionIndex);
    }
  }, [isControlled, questionIndex, internalIndex]);

  // Local state for current question's answer
  const [localAnswers, setLocalAnswers] = useState<Map<string, string[]>>(
    new Map()
  );

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const qId = currentQuestion?.question_id || "";
  const options = currentQuestion?.options || [];
  const serverResponse = responsesByQuestion.get(qId);
  const hasServerResponse = serverResponse && serverResponse.length > 0;
  const localSelection = localAnswers.get(qId) || [];

  // Determine if local selection differs from server response
  const hasLocalChanges = localSelection.length > 0;
  const localDiffersFromServer = hasLocalChanges && (
    !hasServerResponse ||
    localSelection.length !== serverResponse.length ||
    !localSelection.every((id) => serverResponse.includes(id))
  );

  // What to show as "current selection" - local if changed, otherwise server response
  const displaySelection = hasLocalChanges ? localSelection : (serverResponse || []);

  const handleAnswerChange = (
    answerId: string,
    checked: boolean,
    allowMultiple: boolean
  ) => {
    setLocalAnswers((prev) => {
      const newMap = new Map(prev);
      const currentAnswers = newMap.get(qId) || [];

      if (checked) {
        if (allowMultiple) {
          newMap.set(qId, [...currentAnswers, answerId]);
        } else {
          newMap.set(qId, [answerId]);
        }
      } else {
        newMap.set(
          qId,
          currentAnswers.filter((id) => id !== answerId)
        );
      }
      return newMap;
    });
  };

  const handleSubmit = () => {
    const selectedOptions = localAnswers.get(qId) || [];
    if (selectedOptions.length > 0) {
      on_submit(qId, selectedOptions);
      // Clear local state for this question after submit
      setLocalAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(qId);
        return newMap;
      });
      // Auto-advance to next question if not last
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Clear any local changes when navigating
      setLocalAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(qId);
        return newMap;
      });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      // Clear any local changes when navigating
      setLocalAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(qId);
        return newMap;
      });
    }
  };

  // Determine button state
  const showSubmit = localDiffersFromServer && localSelection.length > 0;
  const showNext = hasServerResponse && !localDiffersFromServer && currentIndex < questions.length - 1;
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <CardFooter className="px-3 pb-2 pt-3 border-t flex flex-col">
      {/* Question content area */}
      <div className="w-full space-y-3">
        {/* Question text */}
        <Label className="text-sm font-medium block">
          {currentQuestion?.question_text}
        </Label>

        {/* Options */}
        <div className="space-y-2">
          {currentQuestion?.allow_multiple ? (
            // Checkbox for multiple selection
            options.map((option) => {
              const optId = option.option_id || "";
              const isSelected = displaySelection.includes(optId);

              return (
                <div
                  key={optId}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`${qId}-${optId}`}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleAnswerChange(optId, checked === true, true)
                    }
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`${qId}-${optId}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {option.option_text}
                  </Label>
                  {hasServerResponse && serverResponse.includes(optId) && !hasLocalChanges && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Your answer
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            // Radio for single selection
            <RadioGroup
              value={displaySelection[0] || ""}
              onValueChange={(value) => handleAnswerChange(value, true, false)}
            >
              {options.map((option) => {
                const optId = option.option_id || "";

                return (
                  <div
                    key={optId}
                    className="flex items-center space-x-2"
                  >
                    <RadioGroupItem
                      value={optId}
                      id={`${qId}-${optId}`}
                      disabled={disabled}
                    />
                    <Label
                      htmlFor={`${qId}-${optId}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {option.option_text}
                    </Label>
                    {hasServerResponse && serverResponse.includes(optId) && !hasLocalChanges && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Your answer
                      </span>
                    )}
                  </div>
                );
              })}
            </RadioGroup>
          )}
        </div>
      </div>

      {/* Navigation footer */}
      <div className="w-full flex items-center justify-between pt-3 border-t mt-3">
        {/* Back button (left) */}
        <div className="w-24">
          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={disabled}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        {/* Question indicator (center) */}
        <span className="text-sm text-muted-foreground">
          Q{currentIndex + 1} of {questions.length}
        </span>

        {/* Submit/Next button (right) */}
        <div className="w-24 flex justify-end">
          {showSubmit ? (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={disabled}
            >
              Submit
            </Button>
          ) : showNext ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={disabled}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : !hasServerResponse && localSelection.length === 0 ? (
            // No selection yet - show disabled submit
            <Button
              size="sm"
              disabled
            >
              Submit
            </Button>
          ) : isLastQuestion && hasServerResponse ? (
            // Last question, already answered
            <span className="text-xs text-muted-foreground">Done</span>
          ) : null}
        </div>
      </div>
    </CardFooter>
  );
}
