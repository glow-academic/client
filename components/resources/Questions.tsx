/**
 * Questions.tsx
 * Resource component for question messages
 * Redesigned to match ContentSection expandable question pattern
 * Pure UI: data in, IDs out via onChange. Parent owns creation.
 */

"use client";

import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Check,
  GripVertical,
  MessageSquare,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export interface QuestionsResourceItem {
  question_id?: string | null;
  question_text?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface QuestionsProps {
  question_ids?: string[]; // Current question resource IDs (standardized prop name)
  question_resources?: QuestionsResourceItem[]; // Selected question resources (each includes generated field)
  show_questions?: boolean; // Whether to show this resource picker
  questions_required?: boolean; // Whether this resource is required
  questions?: QuestionsResourceItem[]; // All available questions from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update question_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  // Optional: mapping of question_id -> question text (for initial display)
  questionMapping?: Record<string, string>;
  // Optional: video length for time slider (when questions are associated with videos)
  videoLength?: number | null;
  /** Report value changes upward (unified draft pattern — parent owns creation) */
  onQuestionsChange?: (questions: Array<{ question_text: string; time: number; allow_multiple: boolean }>) => void;
  /** Called whenever internal questions change (including unflushed) — allows parent to show dependent UI immediately */
  onInternalQuestionsChange?: (questions: { id: string; question_text: string }[]) => void;
}

// Internal question type (matching ContentSection pattern)
type QuestionType = {
  id: string;
  question_text: string;
  allow_multiple: boolean;
  times?: number[];
};

export function Questions({
  question_ids,
  question_resources: _question_resources,
  show_questions = false,
  questions_required,
  questions,
  disabled = false,
  onChange,
  label = "Questions",
  id = "questions",
  required = false,
  maxItems = 4, // Default to 4 like ContentSection
  addButtonLabel = "Add question",
  itemPlaceholder = "Question",
  questionMapping = {},
  videoLength = null,
  onQuestionsChange,
  onInternalQuestionsChange,
}: QuestionsProps) {
  // Use standardized props
  const ids = useMemo(() => question_ids ?? [], [question_ids]);
  const show = show_questions ?? false;
  const allQuestions = useMemo(() => questions ?? [], [questions]);

  // Build questionMapping from questions array if not provided
  const effectiveQuestionMapping = useMemo(() => {
    if (Object.keys(questionMapping).length > 0) {
      return questionMapping;
    }
    // Build mapping from questions array (question_id -> question text)
    const mapping: Record<string, string> = {};
    ids.forEach((id, idx) => {
      const question = allQuestions[idx];
      if (question?.question_text) {
        mapping[id] = question.question_text;
      }
    });
    return mapping;
  }, [questionMapping, ids, allQuestions]);

  // Internal state for questions (matching ContentSection pattern)
  const [internalQuestions, setInternalQuestions] = useState<QuestionType[]>(
    () => {
      // Initialize from question_ids using effectiveQuestionMapping
      if (ids.length > 0 && Object.keys(effectiveQuestionMapping).length > 0) {
        return ids.map((id, idx) => ({
          id: id || `temp-${idx}`,
          question_text: effectiveQuestionMapping[id] || "",
          allow_multiple: false,
          times: [],
        }));
      }
      return [
        {
          id: "",
          question_text: "",
          allow_multiple: false,
          times: [],
        },
      ];
    }
  );

  const questionIdMapRef = useRef<Map<string, string>>(new Map()); // Maps question text -> question_id
  const onInternalQuestionsChangeRef = useRef(onInternalQuestionsChange);
  onInternalQuestionsChangeRef.current = onInternalQuestionsChange;
  const onQuestionsChangeRef = useRef(onQuestionsChange);
  onQuestionsChangeRef.current = onQuestionsChange;
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<
    number | null
  >(null);
  const questionInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );
  // Dirty flag: once the user interacts, stop syncing from server and stop
  // emitting on pure-UI state changes (same pattern as Examples.tsx).
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Sync external question_ids changes (when loading from server). Skip while
  // the user is editing so their input isn't clobbered.
  useEffect(() => {
    if (isDirtyRef.current) return;
    if (ids.length > 0 && Object.keys(effectiveQuestionMapping).length > 0) {
      const newQuestions = ids.map((id, idx) => ({
        id: id || `temp-${idx}`,
        question_text: effectiveQuestionMapping[id] || "",
        allow_multiple: false,
        times: [],
      }));
      setInternalQuestions((prev) => {
        const prevTexts = prev.map((q) => q.question_text);
        const newTexts = newQuestions.map((q) => q.question_text);
        if (JSON.stringify(prevTexts) === JSON.stringify(newTexts)) return prev;
        return newQuestions;
      });
      ids.forEach((id, idx) => {
        if (newQuestions[idx]?.question_text) {
          questionIdMapRef.current.set(newQuestions[idx].question_text, id);
        }
      });
    }
  }, [ids, effectiveQuestionMapping]);

  // Report internal questions upward. Only emit draft values after the user
  // has actually interacted — otherwise a pure re-render (e.g. parent state
  // churn) would emit on every render and trigger spurious saves.
  useEffect(() => {
    // onInternalQuestionsChange drives dependent UI (Options) and must always
    // fire, even on initial mount, so the Options list can render against the
    // current question set.
    const questionsWithText = internalQuestions
      .filter((q) => q.question_text.trim())
      .map((q) => ({
        id: questionIdMapRef.current.get(q.question_text) || q.id || `pending-${q.question_text}`,
        question_text: q.question_text,
      }));
    onInternalQuestionsChangeRef.current?.(questionsWithText);

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isDirtyRef.current) return;
    onQuestionsChangeRef.current?.(
      internalQuestions
        .filter((q) => q.question_text.trim())
        .map((q) => ({
          question_text: q.question_text,
          time: q.times?.[0] ?? 0,
          allow_multiple: q.allow_multiple,
        }))
    );
  }, [internalQuestions]);

  // Question handlers (matching ContentSection pattern)
  const handleDragStartQuestion = useCallback(
    (e: React.DragEvent, index: number) => {
      setDraggedQuestionIndex(index);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOverQuestion = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropQuestion = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedQuestionIndex === null) return;
      isDirtyRef.current = true;
      setInternalQuestions((prev) => {
        const next = [...prev];
        const removed = next[draggedQuestionIndex];
        if (!removed) return next;
        next.splice(draggedQuestionIndex, 1);
        next.splice(targetIndex, 0, removed);
        return next;
      });
      setDraggedQuestionIndex(null);
    },
    [draggedQuestionIndex]
  );

  const handleQuestionTextChange = useCallback(
    (index: number, text: string) => {
      isDirtyRef.current = true;
      setInternalQuestions((prev) => {
        const next = [...prev];
        const question = next[index];
        if (!question) return next;
        next[index] = {
          ...question,
          question_text: text,
        };
        return next;
      });
    },
    []
  );

  const handleQuestionTimeChange = useCallback(
    (index: number, range: [number, number]) => {
      const time = range[1];
      const estimatedVideoLength = videoLength || 8;
      if (isNaN(time) || time < 0 || time > estimatedVideoLength) {
        return;
      }
      isDirtyRef.current = true;
      setInternalQuestions((prev) => {
        const next = [...prev];
        const question = next[index];
        if (!question) return next;
        next[index] = {
          ...question,
          times: [time],
        };
        return next;
      });
    },
    [videoLength]
  );

  const addQuestion = useCallback(() => {
    if (internalQuestions.length >= maxItems) {
      toast.error(`Maximum ${maxItems} questions allowed`);
      return;
    }
    isDirtyRef.current = true;
    setInternalQuestions((prev) => [
      ...prev,
      {
        id: "",
        question_text: "",
        allow_multiple: false,
        times: [],
      },
    ]);
  }, [internalQuestions.length, maxItems]);

  const removeQuestion = useCallback((index: number) => {
    isDirtyRef.current = true;
    setInternalQuestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Pending state: items with pending=true from the API
  const pendingItems = useMemo(
    () => allQuestions.filter((q) => q.pending === true),
    [allQuestions]
  );
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((q) => q.question_id).filter(Boolean) as string[]),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in selection, no-op
  const handleAccept = useCallback(() => {
    // no-op: pending items already in selection
  }, []);

  // Reject pending — remove pending IDs from selection
  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, pendingIds]);

  // Don't render if show_questions is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Label and Generate Button */}
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            {label}
            {(required || questions_required) && (
              <span className="text-destructive">*</span>
            )}
          </Label>
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}

      {/* Questions List (matching ContentSection pattern) */}
      {internalQuestions.length === 0 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={addQuestion}
            disabled={disabled}
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> {addButtonLabel}
          </Button>
        </div>
      )}
      {internalQuestions.length > 0 && (
        <div className="space-y-2">
          {internalQuestions.map((question, index) => (
            <div
              key={question.id || index}
              className={cn(
                "space-y-2",
                draggedQuestionIndex === index && "opacity-50"
              )}
              onDragOver={handleDragOverQuestion}
              onDrop={(e) => handleDropQuestion(e, index)}
            >
              <div className="flex items-center gap-2">
                {/* Drag Handle */}
                {!disabled && (
                  <div
                    draggable={!disabled}
                    onDragStart={(e) => handleDragStartQuestion(e, index)}
                    className="cursor-grab active:cursor-grabbing w-8 shrink-0 flex items-center justify-center"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {/* Question Text Input */}
                <div className="flex-1 min-w-0">
                  <Input
                    ref={(el) => {
                      questionInputRefs.current[index] = el;
                    }}
                    value={question.question_text}
                    onChange={(e) =>
                      handleQuestionTextChange(index, e.target.value)
                    }
                    placeholder={`${itemPlaceholder} ${index + 1}`}
                    className={cn("flex-1 w-full", showDiff && question.id && pendingIds.has(question.id) && "ring-2 ring-success bg-success/5")}
                    disabled={disabled}
                    onDragStart={(e) => e.preventDefault()}
                  />
                </div>

                {/* Time Slider (when video length is available) */}
                {videoLength && (
                  <div className="w-48 shrink-0">
                    <RangeSlider
                      min={0}
                      max={videoLength}
                      value={[
                        0,
                        Math.max(
                          0,
                          Math.min(
                            videoLength,
                            question.times?.[0] ?? 0
                          )
                        ),
                      ]}
                      onValueChange={(range) =>
                        handleQuestionTimeChange(index, range)
                      }
                      disabled={disabled}
                      className="space-y-0"
                    />
                  </div>
                )}

                {/* Delete Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(index)}
                  className="h-8 w-8 shrink-0"
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {internalQuestions.length < maxItems && internalQuestions.length > 0 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={addQuestion}
            disabled={disabled}
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> {addButtonLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
