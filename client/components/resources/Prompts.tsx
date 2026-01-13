/**
 * Prompts.tsx
 * Resource component for prompt selection
 * Uses GenericPicker for selection
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
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
import { useMemo } from "react";

type CreateDraftPromptsIn = InputOf<"/api/v4/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v4/resources/prompts", "post">;

export interface PromptsProps {
  prompt_id?: string | null; // Current prompt_id (standardized prop name)
  prompt_resource?: {
    id: string | null;
    system_prompt: string | null;
    name: string | null;
    description: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_prompts?: boolean; // Whether to show this resource picker
  prompt_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  prompts?: Array<{
    prompt_id: string | null;
    system_prompt: string | null;
    name: string | null;
    description: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    department_ids?: string[] | null;
    can_delete?: boolean | null;
    generated?: boolean | null;
  }>; // Array of all available prompt options
  disabled?: boolean; // Based on can_edit flag
  onPromptIdChange: (promptId: string | null) => void; // Update prompt_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createPromptsAction?:
    | ((input: CreateDraftPromptsIn) => Promise<CreateDraftPromptsOut>)
    | undefined;
  // Legacy props for backward compatibility
  promptResource?: {
    id: string;
    system_prompt: string;
    name: string;
    description: string;
    generated?: boolean | null;
  } | null;
  promptId?: string | null;
  suggestions?: string[];
}

export function Prompts({
  prompt_id,
  prompt_resource,
  show_prompts = true,
  prompt_suggestions,
  prompts,
  disabled = false,
  onPromptIdChange,
  onGenerate,
  isGenerating = false,
  label = "Prompt",
  placeholder = "Select a prompt",
  required = false,
  id = "prompt",
  "data-testid": dataTestId,
  helpText,
  group_id,
  agent_id,
  createPromptsAction,
  // Legacy props for backward compatibility
  promptResource,
  promptId: _promptId,
  suggestions,
}: PromptsProps) {
  // Use standardized props with fallback to legacy props
  const resource = prompt_resource ?? promptResource ?? null;
  const resourceId = prompt_id ?? _promptId ?? null;
  const show = show_prompts ?? true;
  const suggestionsList = useMemo(
    () => prompt_suggestions ?? suggestions ?? [],
    [prompt_suggestions, suggestions]
  );

  // Use prompts array for GenericPicker items
  const pickerItems = useMemo(() => {
    if (prompts && prompts.length > 0) {
      return prompts;
    }
    return [];
  }, [prompts]);

  // Don't render if show_prompts is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {onGenerate && agent_id && (
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
                  {resource?.generated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <GenericPicker
        items={pickerItems}
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={(ids) => onPromptIdChange(ids[0] || null)}
        multiSelect={false}
        getId={(item) => item.prompt_id || ""}
        getLabel={(item) => item.name || item.system_prompt || "Unknown Prompt"}
        getSearchText={(item) =>
          `${item.name || ""} ${item.description || ""} ${item.system_prompt || ""}`.trim()
        }
        renderPreview={(item) => (
          <div className="space-y-1">
            <div className="font-medium">
              {item.name || "Untitled Prompt"}
            </div>
            {item.description && (
              <div className="text-sm text-muted-foreground">
                {item.description}
              </div>
            )}
            {item.system_prompt && (
              <div className="text-xs text-muted-foreground max-w-md line-clamp-3">
                {item.system_prompt}
              </div>
            )}
            {item.department_ids && item.department_ids.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Departments: {item.department_ids.length}
              </div>
            )}
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        label={label}
        description={helpText}
        emptyMessage="No prompts available"
        groupHeading="Prompts"
        id={id}
        data-testid={dataTestId}
      />
    </div>
  );
}
