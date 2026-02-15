/**
 * Voices.tsx
 * Resource component for voice selection
 * Multi-select resource component following Departments.tsx pattern
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type FlushResult = { voice_ids: string[] } | void;

type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;

// Derive resource item type from the GET endpoint response
type VoicesGetResponse = OutputOf<"/api/v4/resources/voices/get", "post">;
export type VoiceResourceItem = NonNullable<VoicesGetResponse["items"]>[number];

export interface VoiceItem {
  id: string;
  voice: string;
}

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
  placeholder?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createVoicesAction?:
    | ((input: CreateDraftVoicesIn) => Promise<CreateDraftVoicesOut>)
    | undefined;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // AI diff view props
  aiVoiceResources?: Array<{ id?: string | null; voice?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  searchTerm,
  onSearchChange,
  group_id,
  create_tool_id,
  createVoicesAction,
  isAutosaveEnabled: _isAutosaveEnabled = true,
  registerFlush,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
  isGenerating: _isGenerating = false,
  // AI diff view props (deprecated - now handled by useResourceAi hook)
  aiVoiceResources: _aiVoiceResources,
  onAccept: _onAccept,
  onReject: _onReject,
}: VoicesProps) {
  const ids = useMemo(() => voice_ids ?? [], [voice_ids]);
  const show = show_voices ?? false;
  const allVoices = useMemo(() => voices ?? [], [voices]);
  const suggestionsList = useMemo(
    () => voice_suggestions ?? [],
    [voice_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: _aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<{
    id: string | null;
    voice: string | null;
  }>({
    resourceType: "voices",
    groupId: group_id,
    extractSuggestion: (data) => {
      if (!data.success && data.success !== undefined) return null;
      return { id: (data.id as string) ?? null, voice: (data.voice as string) ?? null };
    },
    accumulate: true,
  });
  const filteredVoices = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allVoices;
    }
    const term = searchTerm.toLowerCase();
    return allVoices.filter((voice) => {
      const name = voice.voice?.toLowerCase() ?? "";
      return name.includes(term);
    });
  }, [allVoices, searchTerm]);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<FlushResult>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<FlushResult> => {
    // For Voices, the flush returns the current selection
    // Resources are selected from existing voices, so just return current IDs
    if (!group_id) {
      return;
    }
    return { voice_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert voices array to VoiceItem format for GenericPicker
  const voiceItems = useMemo(() => {
    return filteredVoices
      .filter((v) => v.id && v.voice) // Filter out nulls
      .map((v) => ({
        id: v.id!,
        voice: v.voice!,
      }));
  }, [filteredVoices]);

  // Check if a voice is suggested
  const isSuggested = useCallback(
    (voiceId: string) => suggestionsList.includes(voiceId),
    [suggestionsList]
  );

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
    acceptAi();
  }, [aiSuggestions, ids, onVoiceIdsChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

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

      <GenericPicker<VoiceItem>
        items={voiceItems}
        itemIds={filteredVoices
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
