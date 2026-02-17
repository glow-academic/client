/**
 * Questions.tsx
 * Resource component for question messages
 * Redesigned to match ContentSection expandable question pattern
 * Creates question resources, reports IDs to parent
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  Check,
  GripVertical,
  Loader2,
  MessageSquare,
  PlusCircle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CreateDraftQuestionsIn = InputOf<"/api/v4/resources/questions", "post">;
type CreateDraftQuestionsOut = OutputOf<
  "/api/v4/resources/questions",
  "post"
>;

// Derive resource item type from the GET endpoint response
type QuestionsGetResponse = OutputOf<"/api/v4/resources/questions/get", "post">;
export type QuestionsResourceItem = NonNullable<QuestionsGetResponse["items"]>[number];

export interface QuestionsProps {
  question_ids?: string[]; // Current question resource IDs (standardized prop name)
  question_resources?: QuestionsResourceItem[]; // Selected question resources (each includes generated field)
  show_questions?: boolean; // Whether to show this resource picker
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  questions_required?: boolean; // Whether this resource is required
  question_suggestions?: string[]; // Array of suggested question IDs (UUIDs) - consistent with other suggestions
  questions?: QuestionsResourceItem[]; // All available questions from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update question_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  group_id?: string | null; // Group ID for linking resources
  createQuestionsAction?:
    | ((input: CreateDraftQuestionsIn) => Promise<CreateDraftQuestionsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // Optional: mapping of question_id -> question text (for initial display)
  questionMapping?: Record<string, string>;
  // Optional: video length for time slider (when questions are associated with videos)
  videoLength?: number | null;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ question_ids: string[] } | void>) => void;
  aiQuestionResources?: Pick<QuestionsResourceItem, "question_id" | "question_text">[] | null;
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
  create_tool_id,
  questions_required,
  question_suggestions: _question_suggestions,
  questions,
  disabled = false,
  onChange,
  label = "Questions",
  id = "questions",
  required = false,
  maxItems = 4, // Default to 4 like ContentSection
  addButtonLabel = "Add question",
  itemPlaceholder = "Question",
  group_id,
  createQuestionsAction,
  onGenerate,
  showAiGenerate = false,
  questionMapping = {},
  videoLength = null,
  isAutosaveEnabled = true,
  registerFlush,
  aiQuestionResources: _aiQuestionResources,
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

  // AI suggestion handling via shared hook
  type AiQuestionSuggestion = Pick<QuestionsResourceItem, "question_id" | "question_text">[];
  const {
    isGenerating: aiIsGenerating,
    aiSuggestion,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "questions",
    groupId: group_id,
  });

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

  const debounceTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastSavedQuestionsRef = useRef<QuestionType[]>(internalQuestions);
  const lastReportedIdsRef = useRef<string[]>(ids); // Track last IDs reported to parent
  const isInitialMountRef = useRef(true);
  const questionIdMapRef = useRef<Map<string, string>>(new Map()); // Maps question text -> question_id
  const onChangeRef = useRef(onChange); // Stable ref to avoid useEffect dependency
  onChangeRef.current = onChange;
  const flushRef = useRef<(() => Promise<{ question_ids: string[] } | void>) | undefined>(undefined);
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<
    number | null
  >(null);
  const questionInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );

  // Sync external question_ids changes (when loading from server)
  useEffect(() => {
    if (ids.length > 0 && Object.keys(effectiveQuestionMapping).length > 0) {
      const newQuestions = ids.map((id, idx) => ({
        id: id || `temp-${idx}`,
        question_text: effectiveQuestionMapping[id] || "",
        allow_multiple: false,
        times: [],
      }));
      // Only update if questions actually changed to prevent infinite loops
      setInternalQuestions((prev) => {
        const prevTexts = prev.map((q) => q.question_text);
        const newTexts = newQuestions.map((q) => q.question_text);
        if (JSON.stringify(prevTexts) === JSON.stringify(newTexts)) return prev;
        return newQuestions;
      });
      // Update mapping
      ids.forEach((id, idx) => {
        if (newQuestions[idx]?.question_text) {
          questionIdMapRef.current.set(newQuestions[idx].question_text, id);
        }
      });
      // Keep lastReportedIdsRef in sync with external ids
      lastReportedIdsRef.current = ids;
    }
  }, [ids, effectiveQuestionMapping]);

  // Debounced resource creation for each question text - only when autosave is enabled
  useEffect(() => {
    // Skip if autosave is disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedQuestionsRef.current = internalQuestions;
      return;
    }

    // Clear all existing timers
    debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
    debounceTimersRef.current.clear();

    // Check if there are any questions that need creation
    const hasQuestionsToCreate = internalQuestions.some(
      (q) => q.question_text.trim() && !questionIdMapRef.current.has(q.question_text)
    );

    if (!hasQuestionsToCreate) {
      // All questions already have IDs, update parent only if IDs changed (reorder/delete)
      const allIds = internalQuestions
        .filter((q) => q.question_text.trim())
        .map((q) => questionIdMapRef.current.get(q.question_text))
        .filter((id): id is string => id !== undefined);
      // Only call onChange if IDs actually changed to prevent infinite loops
      const lastReportedStr = JSON.stringify(lastReportedIdsRef.current);
      const newIdsStr = JSON.stringify(allIds);
      if (lastReportedStr !== newIdsStr) {
        lastReportedIdsRef.current = allIds;
        onChangeRef.current(allIds);
      }
      return;
    }

    // Debounce the flush
    const timer = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    debounceTimersRef.current.set(0, timer);

    lastSavedQuestionsRef.current = internalQuestions;

    // Capture ref value at effect start for cleanup
    const timersAtStart = debounceTimersRef.current;

    return () => {
      // Use captured ref value for cleanup
      timersAtStart.forEach((timer) => clearTimeout(timer));
      timersAtStart.clear();
    };
  // Note: onChange is accessed via onChangeRef to avoid dependency issues
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalQuestions, createQuestionsAction, isAutosaveEnabled]);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ question_ids: string[] } | void> => {
    if (!createQuestionsAction || !create_tool_id || !group_id) return;

    // Find questions that need creation (have text but no ID)
    const questionsToCreate = internalQuestions.filter(
      (q) => q.question_text.trim() && !questionIdMapRef.current.has(q.question_text)
    );

    // Create resources for each
    for (const question of questionsToCreate) {
      try {
        const result = await createQuestionsAction({
          body: {
            group_id: group_id,
            question_text: question.question_text,
            allow_multiple: question.allow_multiple,
            time_value: question.times?.[0] ?? 0,
            mcp: false,
          },
        });
        if (result.question_id) {
          questionIdMapRef.current.set(question.question_text, result.question_id);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to create question: "${question.question_text}"`, error);
        throw error;
      }
    }

    // Update parent with all IDs
    const allIds = internalQuestions
      .filter((q) => q.question_text.trim())
      .map((q) => questionIdMapRef.current.get(q.question_text))
      .filter((id): id is string => id !== undefined);

    lastReportedIdsRef.current = allIds;
    onChangeRef.current(allIds);
    lastSavedQuestionsRef.current = internalQuestions;

    return { question_ids: allIds };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

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
    setInternalQuestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Check if any question resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return _question_resources?.some((q) => q.generated) ?? false;
  }, [_question_resources]);

  // AI suggestion state
  const showDiff = !!aiSuggestion?.length;

  // Accept AI suggestion - add AI-suggested questions to internal questions
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.length) return;
    // Add AI questions to internal questions
    const newQuestions = aiSuggestion
      .filter((q) => q.question_text)
      .map((q, idx) => ({
        id: q.question_id || `ai-${idx}`,
        question_text: q.question_text || "",
        allow_multiple: false,
        times: [],
      }));
    if (newQuestions.length > 0) {
      setInternalQuestions((prev) => [
        ...prev.filter((q) => q.question_text.trim()),
        ...newQuestions,
      ]);
      // Map the new question IDs
      aiSuggestion.forEach((q) => {
        if (q.question_id && q.question_text) {
          questionIdMapRef.current.set(q.question_text, q.question_id);
        }
      });
    }
    clearAi();
  }, [aiSuggestion, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
          {onGenerate && showAiGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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

      {/* AI-suggested questions preview */}
      {showDiff && aiSuggestion && aiSuggestion.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Questions</p>
          <div className="space-y-2">
            {aiSuggestion.map((item, idx) => (
              <div
                key={item.question_id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.question_text || ""}
              </div>
            ))}
          </div>
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
                    className="flex-1 w-full"
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
