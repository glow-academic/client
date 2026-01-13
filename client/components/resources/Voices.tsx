/**
 * Voices.tsx
 * Resource component for voice selection
 * Multi-select resource component following Departments.tsx pattern
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Check } from "lucide-react";
import { useCallback, useMemo } from "react";

type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;

export interface VoiceItem {
  id: string;
  voice: string;
}

export interface VoicesProps {
  voice_ids?: string[]; // Current voice resource IDs (standardized prop name)
  voice_resources?: Array<{
    id: string | null;
    voice: string | null;
    generated?: boolean | null;
  }>; // Selected voice resources (each includes generated field)
  show_voices?: boolean; // Whether to show this resource picker
  voice_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  voices?: Array<{
    id: string | null;
    voice: string | null;
    generated?: boolean | null;
  }>; // All available voices from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onVoiceIdsChange: (ids: string[]) => void; // Update voice_ids in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createVoicesAction?:
    | ((input: CreateDraftVoicesIn) => Promise<CreateDraftVoicesOut>)
    | undefined;
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
  placeholder = "Select voices...",
  group_id,
  agent_id,
  createVoicesAction,
}: VoicesProps) {
  const ids = useMemo(() => voice_ids ?? [], [voice_ids]);
  const show = show_voices ?? false;
  const allVoices = useMemo(() => voices ?? [], [voices]);
  const suggestionsList = useMemo(
    () => voice_suggestions ?? [],
    [voice_suggestions]
  );

  // Convert voices array to VoiceItem format for GenericPicker
  const voiceItems = useMemo(() => {
    return allVoices
      .filter((v) => v.id && v.voice) // Filter out nulls
      .map((v) => ({
        id: v.id!,
        voice: v.voice!,
      }));
  }, [allVoices]);

  // Check if a voice is suggested
  const isSuggested = useCallback(
    (voiceId: string) => suggestionsList.includes(voiceId),
    [suggestionsList]
  );

  // Don't render if show_voices is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      <GenericPicker<VoiceItem>
        items={voiceItems}
        itemIds={allVoices
          .map((v) => v.id)
          .filter((id): id is string => id !== null)} // All voice IDs from array, filter nulls
        selectedIds={ids}
        onSelect={onVoiceIdsChange}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.voice}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.voice}</div>
              </div>
            </div>
            <Check
              className={`ml-auto flex-shrink-0 h-4 w-4 ${
                isSelected ? "opacity-100" : "opacity-0"
              }`}
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
