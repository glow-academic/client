/**
 * GroupRubrics.tsx
 * Resource component for assigning rubrics to a group
 * Uses SelectableGrid for multi-select rubrics per group
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface GroupRubricOption {
  rubric_id: string | null;
  name: string | null;
  description?: string | null;
  agent_role?: string | null;
  generated?: boolean | null;
}

export interface GroupRubricsProps {
  group_id: string;
  group_name?: string | null;
  group_description?: string | null;
  show_rubrics?: boolean;
  rubrics?: GroupRubricOption[];
  disabled?: boolean;
  required?: boolean;
  selected_rubric_ids?: string[];
  onChange: (groupId: string, rubricIds: string[]) => void;
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  // AI diff view props
  aiRubricResources?: Array<{
    id?: string | null;
    rubric_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function GroupRubrics({
  group_id,
  group_name,
  group_description,
  show_rubrics = false,
  rubrics = [],
  disabled = false,
  required = false,
  selected_rubric_ids,
  onChange,
  link_tool_id: _link_tool_id,
  // AI diff view props
  aiRubricResources,
  onAccept,
  onReject,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
  isGenerating: _isGenerating = false,
}: GroupRubricsProps) {
  const selectedIds = useMemo(() => selected_rubric_ids ?? [], [
    selected_rubric_ids,
  ]);

  const filteredRubrics = useMemo(
    () => rubrics.filter((rubric) => rubric.rubric_id && rubric.name),
    [rubrics]
  );

  const handleSelect = useCallback(
    (rubricId: string) => {
      const nextSelection = selectedIds.includes(rubricId)
        ? selectedIds.filter((id) => id !== rubricId)
        : [...selectedIds, rubricId];
      onChange(group_id, nextSelection);
    },
    [onChange, group_id, selectedIds]
  );

  // AI suggestion state
  const showDiff = !!aiRubricResources?.length;

  // Set of AI-suggested rubric IDs for styling
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiRubricResources
          ?.map((r) => r.rubric_id)
          .filter(Boolean) as string[]
      ),
    [aiRubricResources]
  );

  // Accept AI suggestion - add AI-suggested rubrics to selection
  const handleAccept = useCallback(() => {
    if (!aiRubricResources?.length) return;
    const newIds = aiRubricResources
      .map((r) => r.rubric_id)
      .filter((id): id is string => !!id);
    const merged = [...new Set([...selectedIds, ...newIds])];
    onChange(group_id, merged);
    onAccept?.();
  }, [aiRubricResources, selectedIds, onChange, group_id, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  if (!show_rubrics) {
    return null;
  }

  return (
    <div className="space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">
            Rubrics for {group_name ?? "group"}
          </Label>
          {required && <span className="text-destructive">*</span>}
          {selectedIds.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
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
        {group_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {group_description}
          </p>
        )}
      </div>
      {/* AI-suggested rubrics preview */}
      {showDiff && aiRubricResources && aiRubricResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Rubrics</p>
          <div className="flex flex-wrap gap-2">
            {aiRubricResources.map((item, idx) => (
              <div
                key={item.id || item.rubric_id || idx}
                className={cn(
                  "px-3 py-2 rounded-lg border-2 border-success bg-success/10",
                  "text-sm font-medium"
                )}
              >
                {item.name || "Unnamed rubric"}
              </div>
            ))}
          </div>
        </div>
      )}
      <SelectableGrid
        horizontal
        items={filteredRubrics}
        selectedId={null}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        getId={(item) => item.rubric_id ?? ""}
        renderItem={(item, isSelected) => {
          const isAiSuggested = aiSuggestedIds.has(item.rubric_id ?? "");
          return (
          <div
            className={cn(
              "w-full rounded-lg border p-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-muted/60 hover:border-muted-foreground/50",
              isAiSuggested && "ring-2 ring-success bg-success/5"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">
                    {item.name}
                  </span>
                  {item.agent_role && (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {item.agent_role}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted"
                )}
              >
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>
        );}}
        emptyMessage="No rubrics available."
        disabled={disabled}
      />
    </div>
  );
}
