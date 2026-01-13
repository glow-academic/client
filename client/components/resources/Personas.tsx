/**
 * Personas.tsx
 * Resource component for persona selection
 * Uses GenericPicker to select existing persona artifacts
 * Manages persona_ids array and reports to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftPersonasIn = InputOf<"/api/v4/resources/personas", "post">;
type CreateDraftPersonasOut = OutputOf<"/api/v4/resources/personas", "post">;

export interface PersonaItem {
  id: string;
  name: string;
  description?: string;
}

export interface PersonasProps {
  persona_ids?: string[]; // Current persona artifact IDs (standardized prop name)
  persona_resources?: Array<{
    persona_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected persona resources (each includes generated field)
  show_personas?: boolean; // Whether to show this resource picker
  persona_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  personas?: Array<{
    persona_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available personas from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update persona_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  personas_agent_id?: string | null; // Agent ID for resource creation
  createPersonasAction?:
    | ((input: CreateDraftPersonasIn) => Promise<CreateDraftPersonasOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Personas({
  persona_ids,
  persona_resources,
  show_personas = false,
  persona_suggestions,
  personas,
  disabled = false,
  onChange,
  label = "Personas",
  id = "personas",
  required = false,
  placeholder = "Select personas...",
  description,
  group_id,
  personas_agent_id,
  createPersonasAction,
  onGenerate,
  isGenerating = false,
}: PersonasProps) {
  const ids = useMemo(() => persona_ids ?? [], [persona_ids]);
  const show = show_personas ?? false;
  const allPersonas = useMemo(() => personas ?? [], [personas]);
  const suggestionsList = useMemo(
    () => persona_suggestions ?? [],
    [persona_suggestions]
  );

  // Track which persona IDs have already had resources created
  const createdPersonaIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdPersonaIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdPersonaIdsRef.current.add(id));
  }, [ids]);

  // Convert personas array to PersonaItem format for GenericPicker
  const personaItems = useMemo(() => {
    return allPersonas
      .filter((p) => p.persona_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.persona_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}), // Only include if not null/undefined
      }));
  }, [allPersonas]);

  // Check if a persona is suggested
  const isSuggested = useCallback(
    (personaId: string) => suggestionsList.includes(personaId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdPersonaIdsRef.current.has(id)
      );

      // Create resources for newly selected personas
      if (
        newlySelected.length > 0 &&
        createPersonasAction &&
        personas_agent_id &&
        group_id
      ) {
        for (const personaId of newlySelected) {
          try {
            await createPersonasAction({
              body: {
                agent_id: personas_agent_id,
                group_id: group_id,
                persona_id: personaId,
                mcp: false,
              },
            });
            createdPersonaIdsRef.current.add(personaId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create persona resource for ${personaId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createPersonasAction, personas_agent_id, group_id]
  );

  // Check if any persona resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return persona_resources?.some((p) => p.generated) ?? false;
  }, [persona_resources]);

  // Don't render if show_personas is false (AFTER all hooks)
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
          {onGenerate && personas_agent_id && (
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
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <GenericPicker<PersonaItem>
        items={personaItems}
        itemIds={allPersonas
          .map((p) => p.persona_id)
          .filter((id): id is string => id !== null)} // All persona IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
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
