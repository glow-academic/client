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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface VoiceResourceItem {
  id?: string | null;
  voice?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

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
  voices?: VoiceResourceItem[]; // All available voices from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onVoiceIdsChange: (ids: string[]) => void; // Update voice_ids in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
}

export function Voices({
  voice_ids,
  voice_resources,
  show_voices = false,
  voices,
  disabled = false,
  onVoiceIdsChange,
  label = "Voices",
  id = "voices",
  required = false,
  isAutosaveEnabled: _isAutosaveEnabled = true,
}: VoicesProps) {
  const ids = useMemo(() => voice_ids ?? [], [voice_ids]);
  const show = show_voices ?? false;
  const allVoices = useMemo(() => voices ?? [], [voices]);

  // Build grid items: voice cards
  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = allVoices
      .filter((v) => v.id && v.voice)
      .map((v) => ({ type: "voice" as const, id: v.id!, voice: v.voice! }));
    return items;
  }, [allVoices]);

  // Check if a voice is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (voiceId: string) => {
      const voice = allVoices.find((v) => v.id === voiceId);
      return voice?.suggested === true;
    },
    [allVoices]
  );

  // Pending items: voices with pending=true from the API
  const pendingItems = useMemo(() => {
    return allVoices.filter((v) => v.pending);
  }, [allVoices]);
  const pendingIds = useMemo(() => {
    return new Set(pendingItems.map((v) => v.id).filter((id): id is string => !!id));
  }, [pendingItems]);

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      // Update parent state
      onVoiceIdsChange(selectedIds);
    },
    [onVoiceIdsChange]
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

  // Pending state
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in selection, just confirm (no-op for form state)
  const handleAccept = useCallback(() => {
    // Pending items are already in the selection; accepting is a no-op for form state.
  }, []);

  // Reject pending — remove pending item IDs from selection
  const handleReject = useCallback(() => {
    const currentIds = ids.filter((id) => !pendingIds.has(id));
    onVoiceIdsChange(currentIds);
  }, [ids, pendingIds, onVoiceIdsChange]);

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
      <SelectableGrid<GridItem>
        horizontal
        items={gridItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleGridSelect}
        getId={(item) => (item.type === "voice" ? item.id : "__add__")}
        itemClassName="w-[100px]"
        renderItem={(item, isSelected) => {
          if (item.type !== "voice") return null;

          const isPendingVoice = showDiff && pendingIds.has(item.id);

          return (
            <div className="flex items-center justify-center">
              <div
                className={cn(
                  "relative flex items-center justify-center h-20 w-20 rounded-full border bg-card text-card-foreground shadow-sm transition-all",
                  "hover:shadow-md hover:bg-accent/50",
                  isSelected && "ring-2 ring-primary bg-accent",
                  isPendingVoice && !isSelected && "ring-2 ring-success bg-success/10"
                )}
              >
                {/* Suggested dot indicator */}
                {!isSelected && !isPendingVoice && isSuggested(item.id) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute top-0 right-0 z-10 h-2 w-2 rounded-full bg-primary" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <span className="font-medium text-xs leading-tight text-center px-1">
                  {item.voice}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No voices available."
        disabled={disabled}
      />
    </div>
  );
}
