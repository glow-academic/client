/**
 * Instructions.tsx
 * Resource component for instructions textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import type { InputOf, OutputOf } from "@/lib/api/types";

type CreateDraftInstructionsIn = InputOf<
  "/api/v4/resources/instructions",
  "post"
>;
type CreateDraftInstructionsOut = OutputOf<
  "/api/v4/resources/instructions",
  "post"
>;

export interface InstructionsProps {
  instructions_id?: string | null; // Current instructions_id (standardized prop name)
  instructions_resource?: { id: string | null; template: string | null; generated?: boolean | null } | null; // Resource data from server (standardized prop name; includes generated field)
  show_instructions?: boolean; // Whether to show this resource picker
  instructions_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  instructions?: Array<{
    id: string | null;
    template: string | null;
    generated?: boolean | null;
  }>; // Array of suggested instruction resources (only suggested options, not all)
  disabled?: boolean; // Based on can_edit flag
  onInstructionsIdChange: (instructionsId: string | null) => void; // Update instructions_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createInstructionsAction?: ((input: CreateDraftInstructionsIn) => Promise<CreateDraftInstructionsOut>) | undefined;
  searchTerm?: string; // Search term for filtering instructions
  onSearchChange?: (term: string) => void; // Callback when search term changes
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save */
  registerFlush?: (flush: () => Promise<void>) => void;
  // Legacy props for backward compatibility
  instructionsResource?: { id: string; template: string; generated?: boolean | null } | null;
  instructionsId?: string | null;
  suggestions?: string[];
}

export function Instructions({
  instructions_id,
  instructions_resource,
  show_instructions = true,
  instructions_suggestions,
  instructions,
  disabled = false,
  onInstructionsIdChange,
  onGenerate,
  isGenerating = false,
  label = "Instructions",
  placeholder = "Enter instructions",
  required = false,
  rows = 8,
  id = "instructions",
  "data-testid": dataTestId,
  helpText,
  group_id,
  agent_id,
  createInstructionsAction,
  searchTerm,
  onSearchChange,
  isAutosaveEnabled = true,
  registerFlush,
  // Legacy props for backward compatibility
  instructionsResource,
  instructionsId,
  suggestions,
}: InstructionsProps) {
  // Use standardized props with fallback to legacy props
  const resource = instructions_resource ?? instructionsResource ?? null;
  const resourceId = instructions_id ?? instructionsId ?? null;
  const show = show_instructions ?? true;
  const suggestionsList = useMemo(
    () => instructions_suggestions ?? suggestions ?? [],
    [instructions_suggestions, suggestions]
  );

  // Handle nullable resource properties
  const resourceTemplate = resource?.template ?? "";
  const [internalValue, setInternalValue] = useState(resourceTemplate);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceTemplate);
  const isInitialMountRef = useRef(true);
  const saveSeqRef = useRef(0);
  const isDirtyRef = useRef(false);
  const lastServerTextRef = useRef<string>(resourceTemplate);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async () => {
    // Skip if no change or no action
    if (internalValue === lastSavedValueRef.current) return;
    if (!createInstructionsAction || !agent_id || !group_id) return;

    const seq = ++saveSeqRef.current;
    try {
      if (internalValue.trim()) {
        const result = await createInstructionsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            template: internalValue,
            mcp: false,
          },
        });
        if (seq !== saveSeqRef.current) return;
        if (result.instruction_id) {
          onInstructionsIdChange(result.instruction_id);
        }
      } else {
        if (seq !== saveSeqRef.current) return;
        onInstructionsIdChange(null);
      }
      lastSavedValueRef.current = internalValue;
      isDirtyRef.current = false;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create instructions resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Use resourceId for validation/debugging
  useEffect(() => {
    if (resourceId && !resource?.id) {
      // Handle mismatch case - resourceId exists but resource doesn't match
      // This can happen during transitions
    }
  }, [resourceId, resource]);

  const instructionsById = useMemo(() => {
    const mapping: Record<string, string> = {};
    (instructions ?? []).forEach((inst) => {
      if (inst.id && inst.template) {
        mapping[inst.id] = inst.template;
      }
    });
    return mapping;
  }, [instructions]);

  // Update internal value when instructions_resource changes
  useEffect(() => {
    const resourceMatchesId =
      (resourceId && resource?.id && resourceId === resource.id) ||
      (resourceId === null &&
        (resource?.id === null || resource?.id === undefined));
    const resourceValue = resourceMatchesId ? resourceTemplate : "";
    const mappedValue = resourceId ? instructionsById[resourceId] : undefined;
    const hasServerValue =
      resourceValue !== "" || mappedValue !== undefined || resourceId === null;
    if (!hasServerValue) return;
    const serverValue =
      resourceValue !== "" ? resourceValue : mappedValue ?? "";
    if (serverValue === lastServerTextRef.current) return;
    if (!isDirtyRef.current) {
      setInternalValue(serverValue);
      lastSavedValueRef.current = serverValue;
    }
    lastServerTextRef.current = serverValue;
  }, [resourceTemplate, resourceId, instructionsById]);

  // Debounced resource creation - only when autosave is enabled
  useEffect(() => {
    // Skip if autosave is disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    // Skip if value hasn't changed
    if (internalValue === lastSavedValueRef.current) {
      return;
    }

    // Skip if no action
    if (!createInstructionsAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createInstructionsAction, isAutosaveEnabled]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    isDirtyRef.current = newValue !== lastSavedValueRef.current;
  }, []);

  // Use instructions array if available, otherwise create placeholder mapping
  const suggestionsMapping = useMemo(() => {
    if (instructions && instructions.length > 0) {
      const mapping: Record<string, { id: string; template: string }> = {};
      instructions.forEach((inst) => {
        if (inst.id) {
          mapping[inst.id] = {
            id: inst.id,
            template: inst.template || `Instructions ${inst.id.slice(0, 8)}...`,
          };
        }
      });
      return mapping;
    }
    // Fallback: create placeholder mapping from suggestion IDs
    const mapping: Record<string, { id: string; template: string }> = {};
    suggestionsList.forEach((suggestionId) => {
      mapping[suggestionId] = {
        id: suggestionId,
        template: `Instructions ${suggestionId.slice(0, 8)}...`,
      };
    });
    return mapping;
  }, [instructions, suggestionsList]);
  
  // Use instructions array for GenericPicker items if available
  const pickerItems = instructions && instructions.length > 0 
    ? instructions 
    : Object.values(suggestionsMapping);

  // Don't render if show_instructions is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {resource?.generated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {/* GenericPicker for suggestions - always show */}
        <GenericPicker
          items={pickerItems}
          selectedIds={resourceId ? [resourceId] : []}
          onSelect={(ids) => {
            const selectedId = ids[0] || null;
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            saveSeqRef.current += 1;
            if (selectedId) {
              const nextValue = instructionsById[selectedId] ?? "";
              setInternalValue(nextValue);
              lastSavedValueRef.current = nextValue;
              lastServerTextRef.current = nextValue;
            } else {
              setInternalValue("");
              lastSavedValueRef.current = "";
              lastServerTextRef.current = "";
            }
            isDirtyRef.current = false;
            onInstructionsIdChange(selectedId);
          }}
          getId={(item) => item.id || ''}
          getLabel={(item) => {
            return item.template || `Instructions ${(item.id || '').slice(0, 8)}...`;
          }}
          placeholder="Instructions"
          disabled={disabled}
          multiSelect={false}
          compact={true}
          buttonClassName="h-8"
          showLabel={false}
          initialSearchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
      </div>
      {/* Textarea without generate button inside */}
      <Textarea
        id={id}
        data-testid={dataTestId}
        value={internalValue || ""}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
      />
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
