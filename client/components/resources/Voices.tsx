/**
 * Voices.tsx
 * Resource component for voice selection
 * Multi-select resource component with horizontal selectable grid and custom voice creation
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  createVoicesAction?:
    | ((input: CreateDraftVoicesIn) => Promise<CreateDraftVoicesOut>)
    | undefined;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
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
  createVoicesAction,
  isAutosaveEnabled = true,
  registerFlush,
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

  // Track which voice IDs have already had resources created
  const createdVoiceIdsRef = useRef<Set<string>>(new Set());

  // Custom voice creation state
  const [isAddingVoice, setIsAddingVoice] = useState(false);
  const [newVoiceValue, setNewVoiceValue] = useState("");

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<FlushResult>) | undefined>(undefined);

  // Initialize createdVoiceIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdVoiceIdsRef.current.add(id));
  }, [ids]);

  // Helper to create a single voice resource
  const createVoiceResource = useCallback(
    async (voiceText: string): Promise<string | null> => {
      if (!createVoicesAction || !create_tool_id || !group_id) {
        return null;
      }
      const trimmed = voiceText.trim();
      if (!trimmed) return null;

      try {
        const result = await createVoicesAction({
          body: {
            group_id: group_id,
            voice: trimmed,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        return result?.voices_id ?? null;
      } catch {
        return null;
      }
    },
    [createVoicesAction, create_tool_id, group_id]
  );

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<FlushResult> => {
    if (!group_id) {
      return;
    }

    // If there's a pending new voice being added, create it
    if (isAddingVoice && newVoiceValue.trim() && createVoicesAction) {
      const newId = await createVoiceResource(newVoiceValue.trim());
      if (newId) {
        return { voice_ids: [...ids, newId] };
      }
    }

    return { voice_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Build grid items: voice cards + optional "add" card
  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = allVoices
      .filter((v) => v.id && v.voice)
      .map((v) => ({ type: "voice" as const, id: v.id!, voice: v.voice! }));
    if (!disabled && createVoicesAction) {
      items.push({ type: "add" as const });
    }
    return items;
  }, [allVoices, disabled, createVoicesAction]);

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
        (id) => !ids.includes(id) && !createdVoiceIdsRef.current.has(id)
      );

      // Create resources for newly selected voices (only if autosave is enabled)
      if (
        isAutosaveEnabled &&
        newlySelected.length > 0 &&
        createVoicesAction &&
        create_tool_id &&
        group_id
      ) {
        for (const voiceId of newlySelected) {
          try {
            const voiceObj = allVoices.find((v) => v.id === voiceId);
            if (voiceObj?.voice) {
              await createVoicesAction({
                body: {
                  group_id: group_id,
                  voice: voiceObj.voice,
                  mcp: false,
                  tool_id: create_tool_id ?? undefined,
                },
              });
              createdVoiceIdsRef.current.add(voiceId);
            }
          } catch {
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onVoiceIdsChange(selectedIds);
    },
    [ids, onVoiceIdsChange, createVoicesAction, create_tool_id, group_id, allVoices, isAutosaveEnabled]
  );

  // Handle grid card click — multi-select toggle or open custom input
  const handleGridSelect = useCallback(
    (itemId: string) => {
      if (itemId === "__add__") {
        setIsAddingVoice(true);
        return;
      }
      const nextIds = ids.includes(itemId)
        ? ids.filter((i) => i !== itemId)
        : [...ids, itemId];
      void handleSelect(nextIds);
    },
    [ids, handleSelect]
  );

  // Handle adding a custom voice
  const handleAddVoice = useCallback(async () => {
    const trimmed = newVoiceValue.trim();
    if (!trimmed) {
      setIsAddingVoice(false);
      setNewVoiceValue("");
      return;
    }
    const newId = await createVoiceResource(trimmed);
    if (!newId) return;

    const nextIds = [...ids, newId];
    createdVoiceIdsRef.current.add(newId);
    onVoiceIdsChange(nextIds);
    setIsAddingVoice(false);
    setNewVoiceValue("");
  }, [newVoiceValue, createVoiceResource, ids, onVoiceIdsChange]);

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
      {/* Custom voice inline input */}
      {isAddingVoice && (
        <div className="flex items-center gap-2">
          <Input
            value={newVoiceValue}
            onChange={(e) => setNewVoiceValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddVoice();
              } else if (e.key === "Escape") {
                setIsAddingVoice(false);
                setNewVoiceValue("");
              }
            }}
            placeholder="Enter voice name..."
            className="flex-1"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-success hover:text-success"
            onClick={() => void handleAddVoice()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setIsAddingVoice(false);
              setNewVoiceValue("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
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
          if (item.type === "add") {
            return (
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed bg-card text-card-foreground transition-all text-center",
                  "hover:shadow-md hover:bg-accent/50",
                )}
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Custom</span>
              </div>
            );
          }

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
