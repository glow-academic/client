/**
 * Options.tsx
 * Dependent child resource component for answer options
 * Groups options by question_id, with inline editing (text + correct toggle)
 * Creates option resources with question_id linkage via createOptionsAction
 */

"use client";

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
import { cn } from "@/lib/utils";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  Check,
  GripVertical,
  Loader2,
  PlusCircle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { QuestionsResourceItem } from "./Questions";

type CreateDraftOptionsIn = InputOf<"/api/v4/resources/options", "post">;
type CreateDraftOptionsOut = OutputOf<"/api/v4/resources/options", "post">;

// Derive resource item type from the GET endpoint response
type OptionsGetResponse = OutputOf<"/api/v4/resources/options/get", "post">;
export type OptionResourceItem = NonNullable<
  OptionsGetResponse["items"]
>[number];

type FlushResult = { option_ids: string[] } | void;

// Internal option type for editing
type InternalOption = {
  id: string;
  option_text: string;
  is_correct: boolean;
  question_id: string;
};

export interface OptionsProps {
  option_ids?: string[];
  option_resources?: OptionResourceItem[];
  show_options?: boolean;
  option_suggestions?: string[];
  options?: OptionResourceItem[];
  question_ids?: string[];
  question_resources?: QuestionsResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  group_id?: string | null;
  create_tool_id?: string | null;
  createOptionsAction?:
    | ((input: CreateDraftOptionsIn) => Promise<CreateDraftOptionsOut>)
    | undefined;
  isAutosaveEnabled?: boolean;
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Options({
  option_ids,
  option_resources,
  show_options = false,
  options,
  question_ids,
  question_resources,
  disabled = false,
  onChange,
  group_id,
  create_tool_id,
  createOptionsAction,
  isAutosaveEnabled = true,
  registerFlush,
  showAiGenerate = false,
  onGenerate,
}: OptionsProps) {
  const ids = useMemo(() => option_ids ?? [], [option_ids]);
  const show = show_options ?? false;
  const questionIds = useMemo(() => question_ids ?? [], [question_ids]);
  const questionResources = useMemo(
    () => question_resources ?? [],
    [question_resources],
  );

  // Build question label map
  const questionLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    questionResources.forEach((q) => {
      if (q.question_id && q.question_text) {
        map[q.question_id] = q.question_text;
      }
    });
    return map;
  }, [questionResources]);

  // Build option mapping from resources
  const optionMapping = useMemo(() => {
    const map: Record<
      string,
      { option_text: string; is_correct: boolean; question_id: string }
    > = {};
    const allOpts = [...(option_resources ?? []), ...(options ?? [])];
    allOpts.forEach((o) => {
      if (o.option_id) {
        map[o.option_id] = {
          option_text: o.option_text ?? "",
          is_correct: o.is_correct ?? false,
          question_id: (o as Record<string, unknown>).question_id as string ?? "",
        };
      }
    });
    return map;
  }, [option_resources, options]);

  // Internal state for inline editing
  const [internalOptions, setInternalOptions] = useState<InternalOption[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<InternalOption[]>([]);
  const isInitialMountRef = useRef(true);
  const optionIdMapRef = useRef<Map<string, string>>(new Map());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastReportedIdsRef = useRef<string[]>(ids);
  const flushRef = useRef<(() => Promise<FlushResult>) | undefined>(undefined);

  // Sync from external IDs
  useEffect(() => {
    if (ids.length > 0 && Object.keys(optionMapping).length > 0) {
      const newOptions: InternalOption[] = ids
        .map((id) => {
          const mapped = optionMapping[id];
          if (!mapped) return null;
          return {
            id,
            option_text: mapped.option_text,
            is_correct: mapped.is_correct,
            question_id: mapped.question_id,
          };
        })
        .filter((o): o is InternalOption => o !== null);
      setInternalOptions((prev) => {
        const prevStr = JSON.stringify(prev.map((o) => o.id));
        const newStr = JSON.stringify(newOptions.map((o) => o.id));
        if (prevStr === newStr) return prev;
        return newOptions;
      });
      ids.forEach((id) => {
        const mapped = optionMapping[id];
        if (mapped) {
          optionIdMapRef.current.set(
            `${mapped.option_text}|${mapped.is_correct}|${mapped.question_id}`,
            id,
          );
        }
      });
      lastReportedIdsRef.current = ids;
    }
  }, [ids, optionMapping]);

  // Debounced resource creation
  useEffect(() => {
    if (!isAutosaveEnabled) return;
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedRef.current = internalOptions;
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const hasToCreate = internalOptions.some(
      (o) =>
        o.option_text.trim() &&
        !optionIdMapRef.current.has(
          `${o.option_text}|${o.is_correct}|${o.question_id}`,
        ),
    );

    if (!hasToCreate) {
      const allIds = internalOptions
        .filter((o) => o.option_text.trim())
        .map((o) =>
          optionIdMapRef.current.get(
            `${o.option_text}|${o.is_correct}|${o.question_id}`,
          ),
        )
        .filter((id): id is string => id !== undefined);
      if (JSON.stringify(lastReportedIdsRef.current) !== JSON.stringify(allIds)) {
        lastReportedIdsRef.current = allIds;
        onChangeRef.current(allIds);
      }
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    lastSavedRef.current = internalOptions;

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalOptions, createOptionsAction, isAutosaveEnabled]);

  // Flush function
  flushRef.current = async (): Promise<FlushResult> => {
    if (!createOptionsAction || !create_tool_id || !group_id) return;

    const toCreate = internalOptions.filter(
      (o) =>
        o.option_text.trim() &&
        !optionIdMapRef.current.has(
          `${o.option_text}|${o.is_correct}|${o.question_id}`,
        ),
    );

    for (const option of toCreate) {
      try {
        const result = await createOptionsAction({
          body: {
            option_text: option.option_text,
            is_correct: option.is_correct,
            question_id: option.question_id || undefined,
            group_id: group_id,
            mcp: false,
          },
        });
        if (result.option_id) {
          optionIdMapRef.current.set(
            `${option.option_text}|${option.is_correct}|${option.question_id}`,
            result.option_id,
          );
        }
      } catch (error) {
        console.error(`Failed to create option: "${option.option_text}"`, error);
        throw error;
      }
    }

    const allIds = internalOptions
      .filter((o) => o.option_text.trim())
      .map((o) =>
        optionIdMapRef.current.get(
          `${o.option_text}|${o.is_correct}|${o.question_id}`,
        ),
      )
      .filter((id): id is string => id !== undefined);

    lastReportedIdsRef.current = allIds;
    onChangeRef.current(allIds);
    lastSavedRef.current = internalOptions;

    return { option_ids: allIds };
  };

  // Register flush callback
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<{
    questionId: string;
    optionIndex: number;
  } | null>(null);

  // Group options by question_id
  const optionsByQuestion = useMemo(() => {
    const groups: Record<string, InternalOption[]> = {};
    questionIds.forEach((qId) => {
      groups[qId] = internalOptions.filter((o) => o.question_id === qId);
    });
    return groups;
  }, [internalOptions, questionIds]);

  // Handlers
  const handleAddOption = useCallback(
    (questionId: string) => {
      const questionOptions = internalOptions.filter(
        (o) => o.question_id === questionId,
      );
      if (questionOptions.length >= 5) {
        toast.error("Maximum 5 options per question");
        return;
      }
      setInternalOptions((prev) => [
        ...prev,
        {
          id: "",
          option_text: "",
          is_correct: false,
          question_id: questionId,
        },
      ]);
    },
    [internalOptions],
  );

  const handleRemoveOption = useCallback(
    (questionId: string, optionIndex: number) => {
      setInternalOptions((prev) => {
        let count = 0;
        return prev.filter((o) => {
          if (o.question_id === questionId) {
            const keep = count !== optionIndex;
            count++;
            return keep;
          }
          return true;
        });
      });
    },
    [],
  );

  const handleOptionTextChange = useCallback(
    (questionId: string, optionIndex: number, text: string) => {
      setInternalOptions((prev) => {
        let count = 0;
        return prev.map((o) => {
          if (o.question_id === questionId) {
            if (count === optionIndex) {
              count++;
              return { ...o, option_text: text };
            }
            count++;
          }
          return o;
        });
      });
    },
    [],
  );

  const handleToggleCorrect = useCallback(
    (questionId: string, optionIndex: number) => {
      setInternalOptions((prev) => {
        let count = 0;
        return prev.map((o) => {
          if (o.question_id === questionId) {
            if (count === optionIndex) {
              count++;
              return { ...o, is_correct: !o.is_correct };
            }
            count++;
          }
          return o;
        });
      });
    },
    [],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, questionId: string, optionIndex: number) => {
      setDraggedIndex({ questionId, optionIndex });
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, questionId: string, targetIndex: number) => {
      e.preventDefault();
      if (!draggedIndex || draggedIndex.questionId !== questionId) {
        setDraggedIndex(null);
        return;
      }
      if (draggedIndex.optionIndex === targetIndex) {
        setDraggedIndex(null);
        return;
      }
      setInternalOptions((prev) => {
        const questionOpts = prev.filter((o) => o.question_id === questionId);
        const otherOpts = prev.filter((o) => o.question_id !== questionId);
        const [removed] = questionOpts.splice(draggedIndex.optionIndex, 1);
        if (removed) {
          questionOpts.splice(targetIndex, 0, removed);
        }
        return [...otherOpts, ...questionOpts];
      });
      setDraggedIndex(null);
    },
    [draggedIndex],
  );

  // AI suggestion handling
  const {
    isGenerating: aiIsGenerating,
    aiSuggestions,
    accept: acceptAi,
    reject: rejectAi,
  } = useResourceAi<{
    option_id: string | null;
    option_text: string | null;
  }>({
    resourceType: "options",
    groupId: group_id,
    extractSuggestion: (data) => {
      if (!data.success && data.success !== undefined) return null;
      return {
        option_id: (data.option_id as string) ?? null,
        option_text: (data.option_text as string) ?? null,
      };
    },
    accumulate: true,
  });

  const showDiff = aiSuggestions.length > 0;

  const hasGenerated = useMemo(() => {
    return option_resources?.some((o) => o.generated) ?? false;
  }, [option_resources]);

  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((o) => o.option_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    acceptAi();
  }, [aiSuggestions, ids, onChange, acceptAi]);

  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

  // Don't render if no questions or not shown
  if (!show || questionIds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Label and AI generate */}
      <div className="flex items-center gap-2">
        <Label className="flex items-center gap-1">Options</Label>
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

      {/* Per-question option sections */}
      {questionIds.map((qId) => {
        const questionLabel =
          questionLabelMap[qId] || "Question";
        const questionOptions = optionsByQuestion[qId] ?? [];

        return (
          <div key={qId} className="space-y-2 pl-4 border-l-2 border-muted">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {questionLabel}
            </p>
            {questionOptions.map((option, optIdx) => (
              <div
                key={option.id || `${qId}-${optIdx}`}
                className={cn(
                  "flex items-center gap-2",
                  draggedIndex?.questionId === qId &&
                    draggedIndex?.optionIndex === optIdx &&
                    "opacity-50",
                )}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, qId, optIdx)}
              >
                {/* Drag Handle */}
                {!disabled && (
                  <div
                    draggable={!disabled}
                    onDragStart={(e) => handleDragStart(e, qId, optIdx)}
                    className="cursor-grab active:cursor-grabbing w-6 shrink-0 flex items-center justify-center"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {/* Correct Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={option.is_correct ? "default" : "outline"}
                        size="icon"
                        onClick={() => handleToggleCorrect(qId, optIdx)}
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
                </TooltipProvider>

                {/* Option Text */}
                <Input
                  value={option.option_text}
                  onChange={(e) =>
                    handleOptionTextChange(qId, optIdx, e.target.value)
                  }
                  placeholder={`Option ${optIdx + 1}`}
                  className="flex-1 min-w-0"
                  disabled={disabled}
                  onDragStart={(e) => e.preventDefault()}
                />

                {/* Delete */}
                {questionOptions.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(qId, optIdx)}
                    className="h-8 w-8 shrink-0"
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {/* Add Option Button */}
            {questionOptions.length < 5 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleAddOption(qId)}
                disabled={disabled}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            )}

            {/* Initial empty state */}
            {questionOptions.length === 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleAddOption(qId)}
                disabled={disabled}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Options
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
