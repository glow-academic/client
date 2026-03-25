/**
 * Operations.tsx
 * Resource component for operation type selection
 * Uses SelectableGrid to display operations as horizontal scrollable cards
 * Manages operation_ids array and reports to parent
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
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface OperationResourceItem {
  id?: string | null;
  operation?: string | null;
  generated?: boolean | null;
}

export interface OperationItem {
  id: string;
  name: string;
}

export interface OperationsProps {
  operation_ids?: string[];
  operation_resources?: OperationResourceItem[];
  show_operations?: boolean;
  operation_suggestions?: string[];
  operations?: OperationResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
}

export function Operations({
  operation_ids,
  operation_resources,
  show_operations = false,
  operation_suggestions,
  operations,
  disabled = false,
  onChange,
  label = "Operations",
  id = "operations",
  required = false,
  description,
  group_id,
  showAiGenerate = false,
  onGenerate,
}: OperationsProps) {
  const ids = useMemo(() => operation_ids ?? [], [operation_ids]);
  const show = show_operations ?? false;
  const allOperations = useMemo(() => operations ?? [], [operations]);
  const suggestionsList = useMemo(
    () => operation_suggestions ?? [],
    [operation_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const {
    isGenerating: aiIsGenerating,
    aiSuggestions,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "operations",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions.map((o) => o.id).filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Convert operations array to OperationItem format for SelectableGrid
  const operationItems = useMemo(() => {
    return allOperations
      .filter((o) => o.id && o.operation)
      .map((o) => ({
        id: o.id!,
        name: o.operation!,
      }));
  }, [allOperations]);

  // Check if an operation is suggested
  const isSuggested = useCallback(
    (operationId: string) => suggestionsList.includes(operationId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept AI suggestion - add AI-suggested operations to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((o) => o.id)
      .filter((oid): oid is string => !!oid && !ids.includes(oid));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Check if any operation resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return operation_resources?.some((o) => o.generated) ?? false;
  }, [operation_resources]);

  // Don't render if show_operations is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
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

      <SelectableGrid<OperationItem>
        items={operationItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={(operationId) => {
          const newIds = ids.includes(operationId)
            ? ids.filter((oid) => oid !== operationId)
            : [...ids, operationId];
          handleSelect(newIds);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested &&
                  !isSelected &&
                  "ring-2 ring-success bg-success/10"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                  Suggested
                </div>
              )}

              <div className="flex flex-col justify-center gap-1 flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {item.name}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No operations available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
