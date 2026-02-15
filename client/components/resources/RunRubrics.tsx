/**
 * RunRubrics.tsx
 * Resource component for assigning rubrics to a run
 * Uses SelectableGrid for multi-select rubrics per run
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type RunRubricsGetResponse = OutputOf<"/api/v4/resources/run_rubrics/get", "post">;
export type RunRubricsResourceItem = NonNullable<RunRubricsGetResponse["items"]>[number];

export interface RunRubricOption {
  rubric_id: string | null;
  name: string | null;
  description?: string | null;
  agent_role?: string | null;
  generated?: boolean | null;
}

export interface RunRubricsProps {
  run_id: string;
  run_name?: string | null;
  run_description?: string | null;
  show_rubrics?: boolean;
  rubrics?: RunRubricOption[];
  disabled?: boolean;
  required?: boolean;
  selected_rubric_ids?: string[];
  onChange: (runId: string, rubricIds: string[]) => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // AI diff view props
  aiRubricResources?: Pick<RunRubricsResourceItem, "id" | "rubric_id">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function RunRubrics({
  run_id,
  run_name,
  run_description,
  show_rubrics = false,
  rubrics = [],
  disabled = false,
  required = false,
  selected_rubric_ids,
  onChange,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
  isGenerating: _isGenerating = false,
  // AI diff view props (deprecated - now from useResourceAi hook)
  aiRubricResources: _aiRubricResources,
  onAccept: _onAccept,
  onReject: _onReject,
}: RunRubricsProps) {
  // AI suggestion handling via shared hook (accumulate mode: each event = one rubric)
  const { isGenerating: aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<
    Pick<RunRubricsResourceItem, "id" | "rubric_id">
  >({
    resourceType: "run_rubrics",
    groupId: run_id,
    accumulate: true,
    extractSuggestion: (data) => {
      if (!data.id) return null;
      return {
        id: (data.id as string) ?? null,
        rubric_id: (data.rubric_id as string) ?? null,
      };
    },
  });

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
      onChange(run_id, nextSelection);
    },
    [onChange, run_id, selectedIds]
  );

  // AI suggestion state from hook
  const aiRubricResources = aiSuggestions;
  const showDiff = aiSuggestions.length > 0;

  // Set of AI-suggested rubric IDs for styling
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((r) => r.rubric_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Accept AI suggestion - add AI-suggested rubrics to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((r) => r.rubric_id)
      .filter((id): id is string => !!id);
    const merged = [...new Set([...selectedIds, ...newIds])];
    onChange(run_id, merged);
    acceptAi();
  }, [aiSuggestions, selectedIds, onChange, run_id, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

  if (!show_rubrics) {
    return null;
  }

  return (
    <div className="space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">
            Rubrics for {run_name ?? "run"}
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
        {run_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {run_description}
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
