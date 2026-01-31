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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  MessageSquare,
  PlusCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CreateDraftQuestionsIn = InputOf<"/api/v4/resources/questions", "post">;
type CreateDraftQuestionsOut = OutputOf<
  "/api/v4/resources/questions",
  "post"
>;

export interface QuestionsProps {
  question_ids?: string[]; // Current question resource IDs (standardized prop name)
  question_resources?: Array<{
    id?: string | null;
    question_id?: string | null;
    question_text?: string | null;
    allow_multiple?: boolean | null;
    generated?: boolean | null;
  }>; // Selected question resources (each includes generated field)
  show_questions?: boolean; // Whether to show this resource picker
  questions_agent_id?: string | null; // Agent ID for resource creation
  questions_required?: boolean; // Whether this resource is required
  question_suggestions?: string[]; // Array of suggested question IDs (UUIDs) - consistent with other suggestions
  questions?: Array<{
    id?: string | null;
    question_id?: string | null;
    question_text?: string | null;
    allow_multiple?: boolean | null;
    generated?: boolean | null;
  }>; // All available questions from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update question_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createQuestionsAction?:
    | ((input: CreateDraftQuestionsIn) => Promise<CreateDraftQuestionsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Optional: mapping of question_id -> question text (for initial display)
  questionMapping?: Record<string, string>;
  // Optional: video length for time slider (when questions are associated with videos)
  videoLength?: number | null;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ question_ids: string[] } | void>) => void;
  // AI diff view props
  aiQuestionResources?: Array<{
    question_id?: string | null;
    question_text?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

// Internal question type (matching ContentSection pattern)
type QuestionType = {
  id: string;
  question_text: string;
  allow_multiple: boolean;
  options: Array<{
    id: string;
    option_text: string;
    type?: "discrete" | "freeform";
    is_correct: boolean;
  }>;
  times?: number[];
};

export function Questions({
  question_ids,
  question_resources: _question_resources,
  show_questions = false,
  questions_agent_id,
  questions_required,
  question_suggestions,
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
  agent_id,
  createQuestionsAction,
  onGenerate,
  isGenerating = false,
  questionMapping = {},
  videoLength = null,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiQuestionResources,
  onAccept,
  onReject,
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

  // Convert question_suggestions (UUIDs) to question strings by looking them up
  const _suggestionsList = useMemo(() => {
    if (question_suggestions && question_suggestions.length > 0) {
      return question_suggestions
        .map((id) => effectiveQuestionMapping[id])
        .filter(
          (text): text is string =>
            text !== null && text !== undefined && text.trim() !== ""
        );
    }
    return [];
  }, [question_suggestions, effectiveQuestionMapping]);

  // Internal state for questions (matching ContentSection pattern)
  const [internalQuestions, setInternalQuestions] = useState<QuestionType[]>(
    () => {
      // Initialize from question_ids using effectiveQuestionMapping
      if (ids.length > 0 && Object.keys(effectiveQuestionMapping).length > 0) {
        return ids.map((id, idx) => ({
          id: id || `temp-${idx}`,
          question_text: effectiveQuestionMapping[id] || "",
          allow_multiple: false,
          options: [
            {
              id: "",
              option_text: "",
              type: "discrete" as const,
              is_correct: false,
            },
            {
              id: "",
              option_text: "",
              type: "discrete" as const,
              is_correct: false,
            },
          ],
          times: [],
        }));
      }
      return [
        {
          id: "",
          question_text: "",
          allow_multiple: false,
          options: [
            {
              id: "",
              option_text: "",
              type: "discrete" as const,
              is_correct: false,
            },
            {
              id: "",
              option_text: "",
              type: "discrete" as const,
              is_correct: false,
            },
          ],
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
  const [draggedOptionIndex, setDraggedOptionIndex] = useState<{
    questionIndex: number;
    optionIndex: number;
  } | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set()
  );
  const questionInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );
  const [optionMaxWidths, setOptionMaxWidths] = useState<
    Record<number, number | undefined>
  >({});

  // Sync external question_ids changes (when loading from server)
  useEffect(() => {
    if (ids.length > 0 && Object.keys(effectiveQuestionMapping).length > 0) {
      const newQuestions = ids.map((id, idx) => ({
        id: id || `temp-${idx}`,
        question_text: effectiveQuestionMapping[id] || "",
        allow_multiple: false,
        options: [
          {
            id: "",
            option_text: "",
            type: "discrete" as const,
            is_correct: false,
          },
          {
            id: "",
            option_text: "",
            type: "discrete" as const,
            is_correct: false,
          },
        ],
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

  // Update option max widths when question inputs resize
  useEffect(() => {
    const updateWidths = () => {
      const widths: Record<number, number | undefined> = {};
      Object.entries(questionInputRefs.current).forEach(([indexStr, el]) => {
        if (el) {
          const index = parseInt(indexStr, 10);
          const question = internalQuestions[index];
          const baseSpace = 40; // gap + checkbox
          const deleteButtonSpace =
            question && question.options.length > 2 ? 40 : 0;
          const totalSpace = baseSpace + deleteButtonSpace;
          const calculatedWidth = el.offsetWidth - totalSpace;
          widths[index] = calculatedWidth > 0 ? calculatedWidth : undefined;
        }
      });
      setOptionMaxWidths(widths);
    };

    updateWidths();

    const observers: ResizeObserver[] = [];
    Object.values(questionInputRefs.current).forEach((el) => {
      if (el) {
        const observer = new ResizeObserver(() => {
          updateWidths();
        });
        observer.observe(el);
        observers.push(observer);
      }
    });

    window.addEventListener("resize", updateWidths);

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("resize", updateWidths);
    };
  }, [internalQuestions, videoLength, expandedQuestions]);

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
    const effectiveAgentId = questions_agent_id ?? agent_id;
    if (!createQuestionsAction || !effectiveAgentId || !group_id) return;

    // Find questions that need creation (have text but no ID)
    const questionsToCreate = internalQuestions.filter(
      (q) => q.question_text.trim() && !questionIdMapRef.current.has(q.question_text)
    );

    // Create resources for each
    for (const question of questionsToCreate) {
      try {
        const result = await createQuestionsAction({
          body: {
            agent_id: effectiveAgentId,
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
  const toggleQuestionExpanded = useCallback((index: number) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

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

  const handleDragStartOption = useCallback(
    (
      e: React.DragEvent,
      questionIndex: number,
      optionIndex: number
    ) => {
      setDraggedOptionIndex({ questionIndex, optionIndex });
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOverOption = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropOption = useCallback(
    (
      e: React.DragEvent,
      questionIndex: number,
      targetOptionIndex: number
    ) => {
      e.preventDefault();
      if (draggedOptionIndex === null) return;
      if (
        draggedOptionIndex.questionIndex !== questionIndex ||
        draggedOptionIndex.optionIndex === targetOptionIndex
      ) {
        setDraggedOptionIndex(null);
        return;
      }
      setInternalQuestions((prev) => {
        const next = [...prev];
        const question = next[draggedOptionIndex.questionIndex];
        if (!question) return next;
        const options = [...question.options];
        const removed = options[draggedOptionIndex.optionIndex];
        if (!removed) return next;
        options.splice(draggedOptionIndex.optionIndex, 1);
        options.splice(targetOptionIndex, 0, removed);
        next[draggedOptionIndex.questionIndex] = {
          ...question,
          options,
        };
        return next;
      });
      setDraggedOptionIndex(null);
    },
    [draggedOptionIndex]
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

  const handleAddOption = useCallback((questionIndex: number) => {
    setInternalQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      next[questionIndex] = {
        ...question,
        options: [
          ...question.options,
          {
            id: "",
            option_text: "",
            type: "discrete",
            is_correct: false,
          },
        ],
      };
      return next;
    });
  }, []);

  const handleRemoveOption = useCallback(
    (questionIndex: number, optionIndex: number) => {
      setInternalQuestions((prev) => {
        const next = [...prev];
        const question = next[questionIndex];
        if (!question) return next;
        next[questionIndex] = {
          ...question,
          options: question.options.filter((_, i) => i !== optionIndex),
        };
        return next;
      });
    },
    []
  );

  const handleOptionChange = useCallback(
    (
      questionIndex: number,
      optionIndex: number,
      option: {
        id: string;
        option_text: string;
        type?: "discrete" | "freeform";
        is_correct: boolean;
      }
    ) => {
      setInternalQuestions((prev) => {
        const next = [...prev];
        const question = next[questionIndex];
        if (!question) return next;
        const options = [...question.options];
        const existingOption = options[optionIndex];
        if (!existingOption) return next;
        options[optionIndex] = option;
        next[questionIndex] = {
          ...question,
          options,
        };
        return next;
      });
    },
    []
  );

  const handleToggleOptionCorrect = useCallback(
    (questionIndex: number, optionIndex: number) => {
      setInternalQuestions((prev) => {
        const next = [...prev];
        const question = next[questionIndex];
        if (!question) return next;
        const options = [...question.options];
        const existingOption = options[optionIndex];
        if (!existingOption) return next;
        options[optionIndex] = {
          ...existingOption,
          is_correct: !existingOption.is_correct,
        };
        next[questionIndex] = {
          ...question,
          options,
        };
        return next;
      });
    },
    []
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
        options: [
          {
            id: "",
            option_text: "",
            type: "discrete",
            is_correct: false,
          },
          {
            id: "",
            option_text: "",
            type: "discrete",
            is_correct: false,
          },
        ],
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
          {onGenerate && (questions_agent_id || agent_id) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
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

                {/* Accordion Toggle */}
                {question.options.length > 0 && (
                  <Button
                    type="button"
                    variant={
                      expandedQuestions.has(index) ? "default" : "outline"
                    }
                    size="icon"
                    onClick={() => toggleQuestionExpanded(index)}
                    className="h-8 w-8 shrink-0"
                    disabled={disabled}
                  >
                    {expandedQuestions.has(index) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
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

              {/* Options (shown when expanded) */}
              {expandedQuestions.has(index) &&
                question.options.length > 0 && (
                  <div className="pl-10 space-y-2 border-l-2 border-muted">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={option.id || optIndex}
                        className={cn(
                          "flex items-center gap-2",
                          draggedOptionIndex?.questionIndex === index &&
                            draggedOptionIndex?.optionIndex === optIndex &&
                            "opacity-50"
                        )}
                        onDragOver={handleDragOverOption}
                        onDrop={(e) => handleDropOption(e, index, optIndex)}
                      >
                        {/* Option Drag Handle */}
                        <div
                          draggable={!disabled}
                          onDragStart={(e) =>
                            handleDragStartOption(e, index, optIndex)
                          }
                          className="cursor-grab active:cursor-grabbing w-8 shrink-0 flex items-center justify-center"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>

                        {/* Correct Checkbox */}
                        {option.type !== "freeform" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant={
                                  option.is_correct ? "default" : "outline"
                                }
                                size="icon"
                                onClick={() => {
                                  handleToggleOptionCorrect(index, optIndex);
                                }}
                                className="h-8 w-8 shrink-0"
                                disabled={disabled}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {option.is_correct
                                ? "Mark as incorrect"
                                : "Mark as correct"}
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Option Text Input */}
                        <Input
                          value={option.option_text}
                          onChange={(e) => {
                            handleOptionChange(index, optIndex, {
                              ...option,
                              option_text: e.target.value,
                            });
                          }}
                          placeholder="Option text"
                          className="flex-1 min-w-0"
                          style={{
                            maxWidth:
                              optionMaxWidths[index] !== undefined
                                ? `${optionMaxWidths[index]}px`
                                : undefined,
                          }}
                          disabled={disabled}
                          onDragStart={(e) => e.preventDefault()}
                        />

                        {/* Delete Option Button */}
                        {question.options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              handleRemoveOption(index, optIndex);
                            }}
                            className="h-8 w-8 shrink-0"
                            disabled={disabled}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {question.options.length < 5 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          handleAddOption(index);
                        }}
                        disabled={disabled}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Option
                      </Button>
                    )}
                  </div>
                )}
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
