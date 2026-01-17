/**
 * Tools.tsx
 * Resource component for tools selection
 * Uses GenericPicker to select existing tools resources
 * Manages tool_ids array and reports to parent
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
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftToolsIn = InputOf<"/api/v4/resources/tools", "post">;
type CreateDraftToolsOut = OutputOf<"/api/v4/resources/tools", "post">;

export interface ToolsItem {
  id: string;
  name: string;
  description?: string;
}

export interface ToolsProps {
  tool_ids?: string[]; // Current tools resource IDs (standardized prop name)
  tool_resources?: Array<{
    tool_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected tools resources (each includes generated field)
  show_tools?: boolean; // Whether to show this resource picker
  tool_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  tools?: Array<{
    tool_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available tools from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update tool_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createToolsAction?:
    | ((input: CreateDraftToolsIn) => Promise<CreateDraftToolsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Tools({
  tool_ids,
  tool_resources,
  show_tools = false,
  tool_suggestions,
  tools,
  disabled = false,
  onChange,
  label = "Tools",
  id = "tools",
  required = false,
  placeholder = "Select tools...",
  description,
  group_id,
  agent_id,
  createToolsAction,
  onGenerate,
  isGenerating = false,
}: ToolsProps) {
  const ids = useMemo(() => tool_ids ?? [], [tool_ids]);
  const show = show_tools ?? false;
  const allTools = useMemo(() => tools ?? [], [tools]);
  const suggestionsList = useMemo(
    () => tool_suggestions ?? [],
    [tool_suggestions]
  );

  // Track which tools IDs have already had resources created
  const createdToolsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdToolsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdToolsIdsRef.current.add(id));
  }, [ids]);

  // Convert tools array to ToolsItem format for GenericPicker
  const toolsItems = useMemo(() => {
    return allTools
      .filter((m) => m.tool_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.tool_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [allTools]);

  // Check if a tools is suggested
  const isSuggested = useCallback(
    (toolsId: string) => suggestionsList.includes(toolsId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Tools are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any tools resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return tool_resources?.some((m) => m.generated) ?? false;
  }, [tool_resources]);

  // Don't render if show_tools is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
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
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <GenericPicker<ToolsItem>
        items={toolsItems}
        itemIds={allTools
          .map((m) => m.tool_id)
          .filter((id): id is string => id !== null)} // All tools IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
