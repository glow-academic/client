/**
 * QuestionResponsesInput.tsx
 * Question/quiz response input component
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { components } from "@/lib/api/schema";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

// ---- OpenAPI types (single source of truth) ----
type QuestionEntry = components["schemas"]["QuestionEntry"];
type QuizResponse = components["schemas"]["QuizResponse"];

// Props interface using OpenAPI types
export interface QuestionResponsesInputProps {
  questions: QuestionEntry[];
  responses: QuizResponse[];
  on_submit: (question_id: string, option_ids: string[]) => void;
  disabled?: boolean;
}

export function QuestionResponsesInput({
  questions,
  responses,
  on_submit,
  disabled = false,
}: QuestionResponsesInputProps) {
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

  // Local state for unanswered questions
  const [localAnswers, setLocalAnswers] = useState<Map<string, string[]>>(
    new Map()
  );

  const handleAnswerChange = (
    questionId: string,
    answerId: string,
    checked: boolean,
    allowMultiple: boolean
  ) => {
    setLocalAnswers((prev) => {
      const newMap = new Map(prev);
      const currentAnswers = newMap.get(questionId) || [];

      if (checked) {
        if (allowMultiple) {
          newMap.set(questionId, [...currentAnswers, answerId]);
        } else {
          newMap.set(questionId, [answerId]);
        }
      } else {
        newMap.set(
          questionId,
          currentAnswers.filter((id) => id !== answerId)
        );
      }
      return newMap;
    });
  };

  const handleSubmitQuestion = (questionId: string) => {
    const selectedOptions = localAnswers.get(questionId) || [];
    if (selectedOptions.length > 0) {
      on_submit(questionId, selectedOptions);
      // Clear local state for this question after submit
      setLocalAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(questionId);
        return newMap;
      });
    }
  };

  if (questions.length === 0) return null;

  return (
    <CardFooter className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0 overflow-y-auto">
      <div className="w-full space-y-4">
        {questions.map((question) => {
          const qId = question.question_id || "";
          const serverResponse = responsesByQuestion.get(qId);
          const hasResponse = serverResponse && serverResponse.length > 0;
          const localSelection = localAnswers.get(qId) || [];
          const options = question.options || [];

          return (
            <div key={qId} className="space-y-2">
              <Label className="text-sm font-medium">
                {question.question_text}
              </Label>

              {hasResponse ? (
                // Show results with correct/incorrect styling
                <div className="space-y-2 pl-4">
                  {options.map((option) => {
                    const optId = option.option_id || "";
                    const wasSelected = serverResponse.includes(optId);
                    const isCorrect = option.is_correct;

                    let bgClass = "bg-muted/30";
                    let icon = null;

                    if (wasSelected && isCorrect) {
                      bgClass = "bg-green-100 dark:bg-green-900/30 border-green-300";
                      icon = <CheckCircle2 className="h-4 w-4 text-green-600" />;
                    } else if (wasSelected && !isCorrect) {
                      bgClass = "bg-red-100 dark:bg-red-900/30 border-red-300";
                      icon = <XCircle className="h-4 w-4 text-red-600" />;
                    } else if (!wasSelected && isCorrect) {
                      // Show correct answer they missed
                      bgClass = "bg-green-50 dark:bg-green-900/20 border-green-200";
                      icon = <CheckCircle2 className="h-4 w-4 text-green-400" />;
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
              ) : (
                // Show input UI for unanswered questions
                <>
                  {question.allow_multiple ? (
                    <div className="space-y-2 pl-4">
                      {options.map((option) => {
                        const optId = option.option_id || "";
                        return (
                        <div
                          key={optId}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`${qId}-${optId}`}
                            checked={localSelection.includes(optId)}
                            onCheckedChange={(checked) =>
                              handleAnswerChange(
                                qId,
                                optId,
                                checked === true,
                                true
                              )
                            }
                            disabled={disabled}
                          />
                          <Label
                            htmlFor={`${qId}-${optId}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {option.option_text}
                          </Label>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <RadioGroup
                      value={localSelection[0] || ""}
                      onValueChange={(value) =>
                        handleAnswerChange(qId, value, true, false)
                      }
                      className="pl-4"
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
                            className="text-sm font-normal cursor-pointer"
                          >
                            {option.option_text}
                          </Label>
                        </div>
                        );
                      })}
                    </RadioGroup>
                  )}
                  <Button
                    onClick={() => handleSubmitQuestion(qId)}
                    size="sm"
                    className="mt-2"
                    disabled={disabled || localSelection.length === 0}
                  >
                    Submit Answer
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </CardFooter>
  );
}
