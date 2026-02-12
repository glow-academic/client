/**
 * Standards.tsx
 * Resource component for standards selection
 * Uses GenericPicker to select existing standards resources
 * Manages standard_ids array and reports to parent
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
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface StandardItem {
  id: string;
  standard_group_id?: string;
  name: string;
  description?: string;
  points?: number;
  generated?: boolean;
}

export interface StandardsProps {
  standard_ids?: string[]; // Current standard resource IDs (standardized prop name)
  standard_resources?: Array<{
    standard_id: string | null;
    standard_group_id: string | null;
    name: string | null;
    description?: string | null;
    points?: number | null;
    generated?: boolean | null;
  }>; // Selected standards resources (each includes generated field)
  show_standards?: boolean; // Whether to show this resource picker
  standard_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  standards?: Array<{
    standard_id: string | null;
    standard_group_id: string | null;
    name: string | null;
    description?: string | null;
    points?: number | null;
    generated?: boolean | null;
  }>; // All available standards from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update standard_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // AI diff view props
  aiStandardResources?: Array<{
    standard_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Standards({
  standard_ids,
  standard_resources,
  show_standards = false,
  standard_suggestions,
  standards,
  disabled = false,
  onChange,
  label = "Standards",
  id = "standards",
  required = false,
  placeholder = "Select standards...",
  description,
  group_id: _group_id,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  // AI diff view props
  aiStandardResources,
  onAccept,
  onReject,
}: StandardsProps) {
  const ids = useMemo(() => standard_ids ?? [], [standard_ids]);
  const show = show_standards ?? false;
  const allStandards = useMemo(() => standards ?? [], [standards]);
  const suggestionsList = useMemo(
    () => standard_suggestions ?? [],
    [standard_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiStandardResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiStandardResources
          ?.map((s) => s.standard_id)
          .filter(Boolean) as string[]
      ),
    [aiStandardResources]
  );

  const standardItems = useMemo(() => {
    return allStandards
      .filter((std) => std.standard_id && std.name)
      .map((std) => ({
        id: std.standard_id!,
        standard_group_id: std.standard_group_id ?? undefined,
        name: std.name ?? "",
        ...(std.description ? { description: std.description } : {}),
        ...(std.points !== null && std.points !== undefined
          ? { points: std.points }
          : {}),
        ...(std.generated !== null && std.generated !== undefined
          ? { generated: std.generated }
          : {}),
      }));
  }, [allStandards]);

  const isSuggested = useCallback(
    (standardId: string) => suggestionsList.includes(standardId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  const hasGenerated = useMemo(() => {
    return standard_resources?.some((std) => std.generated) ?? false;
  }, [standard_resources]);

  // Accept AI suggestion - add AI-suggested standards to selection
  const handleAccept = useCallback(() => {
    if (!aiStandardResources?.length) return;
    const newIds = aiStandardResources
      .map((s) => s.standard_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiStandardResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
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

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <GenericPicker<StandardItem>
        items={standardItems}
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        getSearchText={(item) =>
          [item.name, item.description ?? ""].filter(Boolean).join(" ")
        }
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10 rounded px-2 py-1 -mx-2 -my-1"
            )}>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{item.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.points !== undefined && (
                    <span>{item.points} pts</span>
                  )}
                  {item.description && (
                    <span className="line-clamp-1">{item.description}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAiSuggested && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    AI Suggested
                  </span>
                )}
                {isSuggested(item.id) && !isAiSuggested && (
                  <span className="text-xs text-muted-foreground">Suggested</span>
                )}
                {isSelected && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
            </div>
          );
        }}
        renderPreview={(item) => (
          <div className="space-y-2">
            <p className="text-sm font-medium">{item.name}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            )}
            {item.points !== undefined && (
              <p className="text-xs text-muted-foreground">
                Points: {item.points}
              </p>
            )}
            {item.standard_group_id && (
              <p className="text-xs text-muted-foreground">
                Group: {item.standard_group_id}
              </p>
            )}
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showClearAll
        showLabel={false}
        groupHeading="Standards"
        emptyMessage="No standards found."
        buttonClassName={cn(disabled && "opacity-60")}
      />
    </div>
  );
}
