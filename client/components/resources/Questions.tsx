/**
 * Questions.tsx
 * Resource component for question messages
 * Uses ReorderableList for UI, creates question resources, reports IDs to parent
 */

"use client";

import { ReorderableList } from "@/components/common/forms/ReorderableList";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftQuestionsIn = InputOf<"/api/v4/resources/questions", "post">;
type CreateDraftQuestionsOut = OutputOf<"/api/v4/resources/questions", "post">;

export interface QuestionsProps {
  question_ids?: string[]; // Current question resource IDs (standardized prop name)
  question_resources?: Array<{
    question_text: string | null;
    idx: number | null;
    generated?: boolean | null;
  }>; // Selected question resources (each includes generated field)
  show_questions?: boolean; // Whether to show this resource picker
  questions_agent_id?: string | null; // Agent ID for resource creation
  questions_required?: boolean; // Whether this resource is required
  question_suggestions?: string[]; // Array of suggested question IDs (UUIDs) - consistent with other suggestions
  questions?: Array<{
    question_text: string | null;
    idx: number | null;
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
}

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
  maxItems = 10,
  addButtonLabel = "Add question",
  itemPlaceholder = "Question",
  group_id,
  agent_id,
  createQuestionsAction,
  onGenerate,
  isGenerating = false,
  questionMapping = {},
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
    // Note: This requires question_ids to match questions array order
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
  const suggestionsList = useMemo(() => {
    if (question_suggestions && question_suggestions.length > 0) {
      // Look up question text from suggestion IDs using the mapping
      return question_suggestions
        .map((id) => effectiveQuestionMapping[id])
        .filter(
          (text): text is string =>
            text !== null && text !== undefined && text.trim() !== ""
        );
    }
    return [];
  }, [question_suggestions, effectiveQuestionMapping]);

  // Internal state for display texts (synced with question_ids via questionMapping)
  const [internalTexts, setInternalTexts] = useState<string[]>(() => {
    // Initialize from question_ids using effectiveQuestionMapping
    if (ids.length > 0 && Object.keys(effectiveQuestionMapping).length > 0) {
      return ids
        .map((id) => effectiveQuestionMapping[id] || "")
        .filter((text) => text.trim() !== "");
    }
    return [""];
  });

  const debounceTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastSavedTextsRef = useRef<string[]>(internalTexts);
  const isInitialMountRef = useRef(true);
  const questionIdMapRef = useRef<Map<string, string>>(new Map()); // Maps question text -> question_id

  // Sync external question_ids changes (when loading from server)
  useEffect(() => {
    if (ids.length > 0 && Object.keys(effectiveQuestionMapping).length > 0) {
      const texts = ids
        .map((id) => effectiveQuestionMapping[id] || "")
        .filter((text) => text.trim() !== "");
      if (texts.length > 0) {
        setInternalTexts(texts.length > 0 ? texts : [""]);
        // Update mapping
        ids.forEach((id, idx) => {
          if (texts[idx]) {
            questionIdMapRef.current.set(texts[idx], id);
          }
        });
      }
    }
  }, [ids, effectiveQuestionMapping]);

  // Debounced resource creation for each question text
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedTextsRef.current = internalTexts;
      return;
    }

    // Clear all existing timers
    debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
    debounceTimersRef.current.clear();

    // Create/update resources for each text
    const newQuestionIds: string[] = [];
    // Use promises to track async operations
    const promises: Promise<void>[] = [];

    internalTexts.forEach((text, index) => {
      if (!text.trim()) {
        // Skip empty texts
        return;
      }

      // Check if we already have an ID for this text
      const existingId = questionIdMapRef.current.get(text);
      if (existingId) {
        newQuestionIds.push(existingId);
        return;
      }

      // Debounce creation for this text
      const promise = (async () => {
        const effectiveAgentId = questions_agent_id ?? agent_id;
        if (createQuestionsAction && effectiveAgentId && group_id) {
          try {
            const result = await createQuestionsAction({
              body: {
                agent_id: effectiveAgentId,
                group_id: group_id,
                question_text: text,
                mcp: false,
              },
            });
            if (result.question_id) {
              questionIdMapRef.current.set(text, result.question_id);
              // Update parent with all IDs
              const allIds = internalTexts
                .map((t) => {
                  if (!t.trim()) return null;
                  return questionIdMapRef.current.get(t) || null;
                })
                .filter((id): id is string => id !== null);
              onChange(allIds);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create question resource for "${text}":`,
              error
            );
          }
        }
      })();
      promises.push(promise);

      const timer = setTimeout(() => {
        // Timer just tracks the debounce, promise handles the actual work
      }, 1000);

      debounceTimersRef.current.set(index, timer);
    });

    lastSavedTextsRef.current = internalTexts;

    // Capture ref value at effect start for cleanup
    const timersAtStart = debounceTimersRef.current;

    return () => {
      // Use captured ref value for cleanup
      timersAtStart.forEach((timer) => clearTimeout(timer));
      timersAtStart.clear();
    };
  }, [
    internalTexts,
    createQuestionsAction,
    onChange,
    questions_agent_id,
    agent_id,
    group_id,
  ]);

  const handleItemsChange = useCallback((items: string[]) => {
    setInternalTexts(items.length > 0 ? items : [""]);
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
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
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
      <ReorderableList
        items={internalTexts}
        onItemsChange={handleItemsChange}
        suggestions={suggestionsList}
        maxItems={maxItems}
        addButtonLabel={addButtonLabel}
        disabled={disabled}
        itemPlaceholder={itemPlaceholder}
      />
    </div>
  );
}
