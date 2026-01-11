/**
 * Descriptions.tsx
 * Resource component for description textarea fields
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { GenericPicker } from "@/components/common/forms/GenericPicker";

type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;

export interface DescriptionsProps {
  description_id?: string | null; // Current description_id (standardized prop name)
  description_resource?: {
    id: string | null;
    description: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_description?: boolean; // Whether to show this resource picker
  description_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  descriptions?: Array<{
    id: string | null;
    description: string | null;
    generated?: boolean | null;
  }>; // Array of suggested description resources (only suggested options, not all)
  disabled?: boolean; // Based on can_edit flag
  onDescriptionIdChange: (descriptionId: string | null) => void; // Update description_id in parent form state
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
  createDescriptionsAction?:
    | ((
        input: CreateDraftDescriptionsIn
      ) => Promise<CreateDraftDescriptionsOut>)
    | undefined;
  searchTerm?: string; // Search term for filtering descriptions
  onSearchChange?: (term: string) => void; // Callback when search term changes
  // Legacy props for backward compatibility
  descriptionResource?: {
    id: string;
    description: string;
    generated?: boolean | null;
  } | null;
  descriptionId?: string | null;
  suggestions?: string[];
}

export function Descriptions({
  description_id,
  description_resource,
  show_description = true,
  description_suggestions,
  descriptions,
  disabled = false,
  onDescriptionIdChange,
  onGenerate,
  isGenerating = false,
  label = "Description",
  placeholder = "Enter description",
  required = false,
  rows = 4,
  id = "description",
  "data-testid": dataTestId,
  helpText,
  group_id,
  agent_id,
  createDescriptionsAction,
  searchTerm,
  onSearchChange,
  // Legacy props for backward compatibility
  descriptionResource,
  descriptionId,
  suggestions,
}: DescriptionsProps) {
  // Use standardized props with fallback to legacy props
  const resource = description_resource ?? descriptionResource ?? null;
  const resourceId = description_id ?? descriptionId ?? null;
  const show = show_description ?? true;
  const suggestionsList = description_suggestions ?? suggestions ?? [];

  // Handle nullable resource properties - normalize to string
  const resourceDescription = resource?.description ?? "";
  const [internalValue, setInternalValue] = useState(resourceDescription);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceDescription);
  const isInitialMountRef = useRef(true);
  const saveSeqRef = useRef(0);

  // Track whether user has diverged from last saved value
  const isDirtyRef = useRef(false);

  // Keep a stable "server identity" for when we should accept server as source of truth
  const lastServerTextRef = useRef<string>(resourceDescription);

  // Use resourceId for validation/debugging
  useEffect(() => {
    if (resourceId && !resource?.id) {
      // Handle mismatch case - resourceId exists but resource doesn't match
      // This can happen during transitions
    }
  }, [resourceId, resource]);

  // Use suggestionsList for autocomplete (if needed in future)
  // Currently suggestions are handled by parent, but we track them here
  const _hasSuggestions = suggestionsList.length > 0;

  // Update internal value when description_resource changes
  // Only sync if server text actually changed AND user is not actively editing
  useEffect(() => {
    // If server is pushing the same text again, ignore.
    if (resourceDescription === lastServerTextRef.current) return;

    // If user is editing (dirty), do NOT clobber their input.
    // Only sync if we are not dirty.
    if (!isDirtyRef.current) {
      setInternalValue(resourceDescription);
      lastSavedValueRef.current = resourceDescription;
    }

    lastServerTextRef.current = resourceDescription;
  }, [resourceDescription]);

  // Debounced resource creation
  useEffect(() => {
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
    if (!createDescriptionsAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      const seq = ++saveSeqRef.current;
      try {
        if (internalValue.trim()) {
          if (!agent_id || !group_id) {
            return;
          }
          const result = await createDescriptionsAction({
            body: {
              agent_id: agent_id,
              group_id: group_id,
              description: internalValue,
            },
          });
          // Ignore stale response if user typed more
          if (seq !== saveSeqRef.current) return;
          if (result.description_id) {
            onDescriptionIdChange(result.description_id);
          }
        } else {
          // Ignore stale response if user typed more
          if (seq !== saveSeqRef.current) return;
          // Clear resource ID if value is empty
          onDescriptionIdChange(null);
        }
        lastSavedValueRef.current = internalValue;
        isDirtyRef.current = false;
      } catch (error) {
        console.error("Failed to create description resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createDescriptionsAction, onDescriptionIdChange]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    isDirtyRef.current = newValue !== lastSavedValueRef.current;
  }, []);

  // Use descriptions array if available, otherwise create placeholder mapping
  const suggestionsMapping = useMemo(() => {
    if (descriptions && descriptions.length > 0) {
      const mapping: Record<string, { id: string; description: string }> = {};
      descriptions.forEach((desc) => {
        if (desc.id) {
          mapping[desc.id] = {
            id: desc.id,
            description: desc.description || `Description ${desc.id.slice(0, 8)}...`,
          };
        }
      });
      return mapping;
    }
    // Fallback: create placeholder mapping from suggestion IDs
    const mapping: Record<string, { id: string; description: string }> = {};
    suggestionsList.forEach((suggestionId) => {
      mapping[suggestionId] = {
        id: suggestionId,
        description: `Description ${suggestionId.slice(0, 8)}...`,
      };
    });
    return mapping;
  }, [descriptions, suggestionsList]);
  
  // Use descriptions array for GenericPicker items if available
  const pickerItems = descriptions && descriptions.length > 0 
    ? descriptions 
    : Object.values(suggestionsMapping);

  // Don't render if show_description is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {onGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
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
            onDescriptionIdChange(ids[0] || null);
          }}
          getId={(item) => (typeof item === 'string' ? item : item.id)}
          getLabel={(item) => {
            if (typeof item === 'string') {
              return `Description ${item.slice(0, 8)}...`;
            }
            return item.description || `Description ${item.id.slice(0, 8)}...`;
          }}
          placeholder="Descriptions"
          disabled={disabled}
          multiSelect={false}
          compact={true}
          buttonClassName="h-8"
          showLabel={false}
          initialSearchTerm={searchTerm}
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
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
