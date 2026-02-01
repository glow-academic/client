/**
 * QuestionResponsesInput.tsx
 * Question/quiz response input component
 * Shows questions with options, handles answer selection and submission
 * After submission, shows correct options in green, incorrect in red
 */
"use client";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

// Simplified prop interface - matches server response structure
export interface QuestionResponsesInputProps {
  // Questions with nested options (only fields we use)
  questions: Array<{
    id: string;
    question_text: string;
    allow_multiple: boolean;
    options: Array<{
      id: string;
      option_text: string;
      is_correct: boolean;
    }>;
  }>;

  // Responses from server (passed through directly)
  // Each response is one selected option for a question
  responses: Array<{
    question_id: string;
    option_id: string;
  }>;

  // Callback when user submits answer for a question
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
    const existing = responsesByQuestion.get(r.question_id) || [];
    existing.push(r.option_id);
    responsesByQuestion.set(r.question_id, existing);
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
          const serverResponse = responsesByQuestion.get(question.id);
          const hasResponse = serverResponse && serverResponse.length > 0;
          const localSelection = localAnswers.get(question.id) || [];

          return (
            <div key={question.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {question.question_text}
              </Label>

              {hasResponse ? (
                // Show results with correct/incorrect styling
                <div className="space-y-2 pl-4">
                  {question.options.map((option) => {
                    const wasSelected = serverResponse.includes(option.id);
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
                        key={option.id}
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
                      {question.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`${question.id}-${option.id}`}
                            checked={localSelection.includes(option.id)}
                            onCheckedChange={(checked) =>
                              handleAnswerChange(
                                question.id,
                                option.id,
                                checked === true,
                                true
                              )
                            }
                            disabled={disabled}
                          />
                          <Label
                            htmlFor={`${question.id}-${option.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {option.option_text}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <RadioGroup
                      value={localSelection[0] || ""}
                      onValueChange={(value) =>
                        handleAnswerChange(question.id, value, true, false)
                      }
                      className="pl-4"
                    >
                      {question.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2"
                        >
                          <RadioGroupItem
                            value={option.id}
                            id={`${question.id}-${option.id}`}
                            disabled={disabled}
                          />
                          <Label
                            htmlFor={`${question.id}-${option.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {option.option_text}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                  <Button
                    onClick={() => handleSubmitQuestion(question.id)}
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
