/**
 * Voices.tsx
 * Resource component for voice selection
 * Multi-select resource component with horizontal selectable grid and custom voice creation
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

type LinkVoicesIn = InputOf<"/api/v5/resources/voices/link", "post">;
type LinkVoicesOut = OutputOf<"/api/v5/resources/voices/link", "post">;

// Derive resource item type from the GET endpoint response
type VoicesGetResponse = OutputOf<"/api/v5/resources/voices/get", "post">;
export type VoiceResourceItem = NonNullable<VoicesGetResponse["items"]>[number];

export interface VoiceItem {
  id: string;
  voice: string;
}

// Union type for grid items: voice cards + the custom "add" card
type GridItem = { type: "voice"; id: string; voice: string } | { type: "add" };

export interface VoicesProps {
  voice_ids?: string[]; // Current voice resource IDs (standardized prop name)
  voice_resources?: VoiceResourceItem[]; // Selected voice resources (each includes generated field)
  show_voices?: boolean; // Whether to show this resource picker
  voice_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  voices?: VoiceResourceItem[]; // All available voices from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onVoiceIdsChange: (ids: string[]) => void; // Update voice_ids in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for linking existing resources
  linkVoicesAction?:
    | ((input: LinkVoicesIn) => Promise<LinkVoicesOut>)
    | undefined;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  aiVoiceResources?: Array<{ id?: string | null; voice?: string | null }> | null;
}

export function Voices({
  voice_ids,
  voice_resources,
  show_voices = false,
  voice_suggestions,
  voices,
  disabled = false,
  onVoiceIdsChange,
  label = "Voices",
  id = "voices",
  required = false,
  group_id,
  create_tool_id,
  link_tool_id,
  linkVoicesAction,
  isAutosaveEnabled = true,
  showAiGenerate = false,
  onGenerate,
}: VoicesProps) {
  const ids = useMemo(() => voice_ids ?? [], [voice_ids]);
  const show = show_voices ?? false;
  const allVoices = useMemo(() => voices ?? [], [voices]);
  const suggestionsList = useMemo(
    () => voice_suggestions ?? [],
    [voice_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "voices",
    groupId: group_id,
    accumulate: true,
  });

  // Build grid items: voice cards
  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = allVoices
      .filter((v) => v.id && v.voice)
      .map((v) => ({ type: "voice" as const, id: v.id!, voice: v.voice! }));
    return items;
  }, [allVoices]);

  // Check if a voice is suggested
  const isSuggested = useCallback(
    (voiceId: string) => suggestionsList.includes(voiceId),
    [suggestionsList]
  );

  // Check if a voice is AI-suggested
  const aiSuggestedIds = useMemo(() => {
    return new Set(aiSuggestions.map((v) => v.id).filter((id): id is string => !!id));
  }, [aiSuggestions]);

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id)
      );

      // Fire link tracking for each newly selected existing resource
      if (newlySelected.length > 0 && linkVoicesAction && group_id && link_tool_id) {
        for (const voiceId of newlySelected) {
          linkVoicesAction({
            body: { resource_id: voiceId, tool_id: link_tool_id },
          }).catch(() => {});
        }
      }

      // Update parent state
      onVoiceIdsChange(selectedIds);
    },
    [ids, onVoiceIdsChange, group_id, linkVoicesAction, link_tool_id]
  );

  // Handle grid card click — multi-select toggle
  const handleGridSelect = useCallback(
    (itemId: string) => {
      const nextIds = ids.includes(itemId)
        ? ids.filter((i) => i !== itemId)
        : [...ids, itemId];
      void handleSelect(nextIds);
    },
    [ids, handleSelect]
  );

  // Check if any voice resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return voice_resources?.some((v) => v.generated) ?? false;
  }, [voice_resources]);

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;

  // Accept AI suggestion - add AI-suggested voices to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((v) => v.id)
      .filter((id): id is string => !!id);
    if (newIds.length > 0) {
      onVoiceIdsChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onVoiceIdsChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_voices is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
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
      {/* AI-suggested voices preview */}
      {showDiff && aiSuggestions.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Voices</p>
          <div className="space-y-2">
            {aiSuggestions.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.voice || ""}
              </div>
            ))}
          </div>
        </div>
      )}
      <SelectableGrid<GridItem>
        horizontal
        items={gridItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleGridSelect}
        getId={(item) => (item.type === "voice" ? item.id : "__add__")}
        renderItem={(item, isSelected) => {
          if (item.type !== "voice") return null;

          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-2 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* AI Suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI
                </div>
              )}

              {/* Suggested badge - top right */}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  Suggested
                </div>
              )}

              <h3 className="font-medium text-sm leading-tight pr-6">
                {item.voice}
              </h3>
            </div>
          );
        }}
        emptyMessage="No voices available."
        disabled={disabled}
      />
    </div>
  );
}
