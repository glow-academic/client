/**
 * Modalities.tsx
 * Resource component for modality selection
 * Uses GenericPicker to select existing modality resources
 * Manages modality_ids array and reports to parent
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type ModalityGetResponse = OutputOf<"/api/v4/resources/modalities/get", "post">;
export type ModalityResourceItem = NonNullable<ModalityGetResponse["items"]>[number];

export interface ModalityItem {
  id: string;
  name: string;
  description?: string;
}

export interface ModalitiesProps {
  modality_ids?: string[]; // Current modality resource IDs (standardized prop name)
  modality_resources?: ModalityResourceItem[]; // Selected modality resources (each includes generated field)
  show_modalities?: boolean; // Whether to show this resource picker
  modality_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  modalities?: ModalityResourceItem[]; // All available modalities from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update modality_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  isGenerating?: boolean;
  // AI diff view props
  aiModalityResources?: Pick<ModalityResourceItem, "id" | "modality">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Modalities({
  modality_ids,
  modality_resources,
  show_modalities = false,
  modality_suggestions,
  modalities,
  disabled = false,
  onChange,
  label = "Modalities",
  id = "modalities",
  required = false,
  placeholder = "Select modalities...",
  description,
  searchTerm,
  onSearchChange,
  group_id,
  onGenerate,
  showAiGenerate = false,
}: ModalitiesProps) {
  const ids = useMemo(() => modality_ids ?? [], [modality_ids]);
  const show = show_modalities ?? false;
  const allModalities = useMemo(() => modalities ?? [], [modalities]);
  const suggestionsList = useMemo(
    () => modality_suggestions ?? [],
    [modality_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<{
    modality_id: string | null;
    name: string | null;
  }>({
    resourceType: "modalities",
    groupId: group_id,
    extractSuggestion: (data) => {
      if (!data.success && data.success !== undefined) return null;
      return { modality_id: (data.modality_id as string) ?? null, name: (data.name as string) ?? null };
    },
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((m) => m.modality_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  const filteredModalities = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allModalities;
    }
    const term = searchTerm.toLowerCase();
    return allModalities.filter((modality) => {
      const name = modality.name?.toLowerCase() ?? "";
      const desc = modality.description?.toLowerCase() ?? "";
      return name.includes(term) || desc.includes(term);
    });
  }, [allModalities, searchTerm]);

  // Convert modalities array to ModalityItem format for GenericPicker
  const modalityItems = useMemo(() => {
    return filteredModalities
      .filter((m) => m.modality_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.modality_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [filteredModalities]);

  // Check if a modality is suggested
  const isSuggested = useCallback(
    (modalityId: string) => suggestionsList.includes(modalityId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Modalities are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any modality resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return modality_resources?.some((m) => m.generated) ?? false;
  }, [modality_resources]);

  // Accept AI suggestion - add AI-suggested modalities to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((m) => m.modality_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    acceptAi();
  }, [aiSuggestions, ids, onChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

  // Don't render if show_modalities is false (AFTER all hooks)
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
      <GenericPicker<ModalityItem>
        items={modalityItems}
        itemIds={filteredModalities
          .map((m) => m.modality_id)
          .filter((id): id is string => id !== null)} // All modality IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10 rounded px-2 py-1 -mx-2 -my-1"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isAiSuggested && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                    AI Suggested
                  </span>
                )}
                {isSuggested(item.id) && !isSelected && !isAiSuggested && (
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
          );
        }}
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
