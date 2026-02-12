/**
 * Options.tsx
 * Resource component for answer options within questions
 * Scoped to a parent question via question_id
 * Manages option text and correct answer marking
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
import { cn } from "@/lib/utils";
import { Check, Loader2, PlusCircle, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface OptionItem {
  id: string;
  option_text: string;
  is_correct: boolean;
  generated?: boolean | null;
  question_id?: string | null;
}

export interface OptionsProps {
  option_ids?: string[];
  option_resources?: Array<{
    option_id?: string | null;
    option_text?: string | null;
    is_correct?: boolean | null;
    generated?: boolean | null;
    question_id?: string | null;
  }>;
  show_options?: boolean;
  question_id?: string | null;
  options?: Array<{
    option_id?: string | null;
    option_text?: string | null;
    is_correct?: boolean | null;
    generated?: boolean | null;
    question_id?: string | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  onOptionChange?: (optionId: string, field: string, value: string | boolean) => void;
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  group_id?: string | null;
  create_tool_id?: string | null;
  link_tool_id?: string | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  aiOptionResources?: Array<{
    option_id?: string | null;
    option_text?: string | null;
    is_correct?: boolean | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Options({
  option_ids,
  option_resources,
  show_options = false,
  question_id: _question_id,
  options,
  disabled = false,
  onChange,
  onOptionChange,
  label = "Options",
  id = "options",
  required = false,
  maxItems = 5,
  showAiGenerate = false,
  onGenerate,
  isGenerating = false,
  aiOptionResources,
  onAccept,
  onReject,
}: OptionsProps) {
  const ids = useMemo(() => option_ids ?? [], [option_ids]);
  const show = show_options ?? false;
  const allOptions = useMemo(() => options ?? [], [options]);

  const showDiff = !!aiOptionResources?.length;

  const hasGenerated = useMemo(() => {
    return option_resources?.some((o) => o.generated) ?? false;
  }, [option_resources]);

  // Internal option state for new options
  const [newOptions, setNewOptions] = useState<
    Array<{ text: string; is_correct: boolean }>
  >([]);

  const handleToggleCorrect = useCallback(
    (optionId: string, currentState: boolean) => {
      onOptionChange?.(optionId, "is_correct", !currentState);
    },
    [onOptionChange]
  );

  const handleRemove = useCallback(
    (optionId: string) => {
      onChange(ids.filter((id) => id !== optionId));
    },
    [ids, onChange]
  );

  const handleAddNew = useCallback(() => {
    setNewOptions((prev) => [...prev, { text: "", is_correct: false }]);
  }, []);

  const handleNewOptionTextChange = useCallback(
    (index: number, text: string) => {
      setNewOptions((prev) => {
        const next = [...prev];
        const item = next[index];
        if (item) {
          next[index] = { ...item, text };
        }
        return next;
      });
    },
    []
  );

  const handleRemoveNew = useCallback((index: number) => {
    setNewOptions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAccept = useCallback(() => {
    if (!aiOptionResources?.length) return;
    const newIds = aiOptionResources
      .map((o) => o.option_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiOptionResources, ids, onChange, onAccept]);

  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {label && (
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        {onGenerate && showAiGenerate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onGenerate}
                  disabled={disabled || isGenerating || showDiff}
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

      {/* AI suggested options preview */}
      {showDiff && aiOptionResources && aiOptionResources.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Options</p>
          {aiOptionResources.map((item, idx) => (
            <div
              key={item.option_id || idx}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border-2 border-success bg-success/10"
              )}
            >
              <span className="text-sm flex-1">{item.option_text || ""}</span>
              {item.is_correct && (
                <Check className="h-4 w-4 text-success" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Existing options */}
      <div className="space-y-2">
        {allOptions
          .filter((opt) => opt.option_id && ids.includes(opt.option_id))
          .map((option) => (
            <div
              key={option.option_id ?? "unknown"}
              className="flex items-center gap-2"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={option.is_correct ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        option.option_id &&
                        handleToggleCorrect(option.option_id, !!option.is_correct)
                      }
                      disabled={disabled}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {option.is_correct ? "Mark as incorrect" : "Mark as correct"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Input
                value={option.option_text ?? ""}
                disabled
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => option.option_id && handleRemove(option.option_id)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

        {/* New options being added */}
        {newOptions.map((newOpt, index) => (
          <div key={`new-${index}`} className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={disabled}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Input
              value={newOpt.text}
              onChange={(e) => handleNewOptionTextChange(index, e.target.value)}
              placeholder="Option text"
              className="flex-1"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleRemoveNew(index)}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {ids.length + newOptions.length < maxItems && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddNew}
          disabled={disabled}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Option
        </Button>
      )}
    </div>
  );
}
