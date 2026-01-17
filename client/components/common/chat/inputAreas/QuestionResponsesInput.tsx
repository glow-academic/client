/**
 * QuestionResponsesInput.tsx
 * Question/quiz response input component
 * Explicit, self-contained types (like resource components)
 */
"use client";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";

// Explicit, self-contained prop interface (like resource components)
export interface QuestionResponsesInputProps {
  enabled: boolean;

  // Explicit question type - self-contained
  questions: Array<{
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

  selected_answers: Map<string, string[]>;
  on_answer_change: (questionId: string, answers: string[]) => void;
  on_submit: (answers: Map<string, string[]>) => void;
  disabled?: boolean;
}

export function QuestionResponsesInput({
  enabled,
  questions,
  selected_answers,
  on_answer_change,
  on_submit,
  disabled = false,
}: QuestionResponsesInputProps) {
  const [localAnswers, setLocalAnswers] = useState<Map<string, string[]>>(
    new Map(selected_answers)
  );

  const handleAnswerChange = (
    questionId: string,
    answerId: string,
    checked: boolean
  ) => {
    setLocalAnswers((prev) => {
      const newMap = new Map(prev);
      const currentAnswers = newMap.get(questionId) || [];

      if (checked) {
        const question = questions.find((q) => q.id === questionId);
        if (question?.allow_multiple) {
          // Multiple choice - add to array
          newMap.set(questionId, [...currentAnswers, answerId]);
        } else {
          // Single choice - replace array
          newMap.set(questionId, [answerId]);
        }
      } else {
        // Remove answer
        newMap.set(
          questionId,
          currentAnswers.filter((id) => id !== answerId)
        );
      }

      // Notify parent
      on_answer_change(questionId, newMap.get(questionId) || []);
      return newMap;
    });
  };

  const handleSubmit = () => {
    on_submit(localAnswers);
  };

  if (!enabled || disabled) return null;

  return (
    <CardFooter className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0">
      <div className="w-full space-y-4">
        {questions.map((question) => {
          const questionAnswers = localAnswers.get(question.id) || [];
          const isMultiple = question.allow_multiple ?? false;

          return (
            <div key={question.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {question.question_text}
              </Label>
              {isMultiple ? (
                <div className="space-y-2 pl-4">
                  {question.options?.map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`${question.id}-${option.id}`}
                        checked={questionAnswers.includes(option.id)}
                        onCheckedChange={(checked) =>
                          handleAnswerChange(
                            question.id,
                            option.id,
                            checked === true
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
                  value={questionAnswers[0] || ""}
                  onValueChange={(value) =>
                    handleAnswerChange(question.id, value, true)
                  }
                  className="pl-4"
                >
                  {question.options?.map((option) => (
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
            </div>
          );
        })}

        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={disabled || localAnswers.size === 0}
        >
          Submit Answers
        </Button>
      </div>
    </CardFooter>
  );
}
