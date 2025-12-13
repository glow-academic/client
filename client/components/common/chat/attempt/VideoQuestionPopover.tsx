/**
 * VideoQuestionPopover.tsx
 * Popover component that displays questions at video timestamps
 * @AshokSaravanan222 & @siladiea
 * 01/30/2025
 */
"use client";

import { useMemo, useState } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// Icons
import { CheckCircle2, XCircle } from "lucide-react";

import type { ContentItem } from "./AttemptChat";

type QuestionItem = ContentItem["questions"][number];
type QuizResponseItem = NonNullable<ContentItem["quiz"]>["responses"][number];

interface VideoQuestionPopoverProps {
  question: QuestionItem;
  quizResponses: QuizResponseItem[];
  onSubmitAnswer: (
    questionId: string,
    optionId: string,
    isCorrect: boolean,
  ) => void;
  onClose: () => void;
}

export default function VideoQuestionPopover({
  question,
  quizResponses,
  onSubmitAnswer,
  onClose,
}: VideoQuestionPopoverProps) {
  // Initialize answered state from quiz responses
  const isAnswered = useMemo(() => {
    return quizResponses.some(
      (r) => r.questionId === question.id && r.completed,
    );
  }, [quizResponses, question.id]);

  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set(),
  );
  const [isCorrect, setIsCorrect] = useState(false);

  // Handle option selection
  const handleOptionSelect = (optionId: string) => {
    if (question.allowMultiple) {
      setSelectedOptions((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(optionId)) {
          newSet.delete(optionId);
        } else {
          newSet.add(optionId);
        }
        return newSet;
      });
    } else {
      setSelectedOptions(new Set([optionId]));
    }
  };

  // Handle submit answer
  const handleSubmit = () => {
    if (selectedOptions.size === 0) return;

    // Determine if answer is correct
    const correctOptionIds = new Set(
      question.options.filter((opt: { isCorrect: boolean }) => opt.isCorrect).map((opt: { id: string }) => opt.id),
    );
    const selectedAndCorrect = Array.from(selectedOptions).filter((id: string) =>
      correctOptionIds.has(id),
    );
    const selectedAndIncorrect = Array.from(selectedOptions).filter(
      (id: string) => !correctOptionIds.has(id),
    );

    const isAnswerCorrect =
      selectedAndCorrect.length === correctOptionIds.size &&
      selectedAndIncorrect.length === 0 &&
      selectedOptions.size > 0;

    // Submit each selected option
    selectedOptions.forEach((optionId) => {
      onSubmitAnswer(question.id, optionId, isAnswerCorrect);
    });

    setIsCorrect(isAnswerCorrect);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
      <Card className="w-full max-w-2xl mx-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Question</span>
            {isAnswered && (
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-500">Correct!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-red-500">Incorrect</span>
                  </>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg font-medium">{question.questionText}</p>

          {question.type === "choice" && !question.allowMultiple && (
            <RadioGroup
              value={Array.from(selectedOptions)[0] || ""}
              onValueChange={handleOptionSelect}
              disabled={isAnswered}
            >
              <div className="space-y-3">
                {question.options.map((option: { id: string; optionText: string; isCorrect: boolean }) => (
                  <div
                    key={option.id}
                    className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <RadioGroupItem value={option.id} id={option.id} />
                    <Label
                      htmlFor={option.id}
                      className="flex-1 cursor-pointer"
                    >
                      {option.optionText}
                    </Label>
                    {isAnswered && option.isCorrect && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          {question.type === "choice" && question.allowMultiple && (
            <div className="space-y-3">
              {question.options.map((option: { id: string; optionText: string; isCorrect: boolean }) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => !isAnswered && handleOptionSelect(option.id)}
                >
                  <Checkbox
                    checked={selectedOptions.has(option.id)}
                    onCheckedChange={() =>
                      !isAnswered && handleOptionSelect(option.id)
                    }
                    disabled={isAnswered}
                  />
                  <Label className="flex-1 cursor-pointer">
                    {option.optionText}
                  </Label>
                  {isAnswered && option.isCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              ))}
            </div>
          )}

          {question.type === "frq" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Free response questions are not yet supported in video attempts.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4">
            {!isAnswered && (
              <Button
                onClick={handleSubmit}
                disabled={selectedOptions.size === 0}
              >
                Submit Answer
              </Button>
            )}
            {isAnswered && (
              <Button onClick={onClose} variant="default">
                Continue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
