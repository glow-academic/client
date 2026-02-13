/**
 * Personas.tsx
 * Resource component for persona selection
 * Uses SelectableGrid to select existing persona artifacts
 * Manages persona_ids array and reports to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { getIconComponent } from "@/utils/icons";
import { Brain, Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

type CreateDraftPersonasIn = InputOf<"/api/v4/resources/personas", "post">;
type CreateDraftPersonasOut = OutputOf<"/api/v4/resources/personas", "post">;

// Derive resource item type from the GET endpoint response
type PersonaGetResponse = OutputOf<"/api/v4/resources/personas/get", "post">;
export type PersonaResourceItem = NonNullable<PersonaGetResponse["items"]>[number];

export interface PersonaItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface PersonasProps {
  persona_ids?: string[]; // Current persona artifact IDs (standardized prop name)
  persona_resources?: PersonaResourceItem[]; // Selected persona resources (each includes generated field)
  show_personas?: boolean; // Whether to show this resource picker
  persona_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  personas?: PersonaResourceItem[]; // All available personas from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update persona_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createPersonasAction?:
    | ((input: CreateDraftPersonasIn) => Promise<CreateDraftPersonasOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  isGenerating?: boolean;
  videoEnabled?: boolean; // Whether video mode is enabled (for filtering)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ persona_ids: string[] } | void>) => void;
  // AI diff view props
  aiPersonaResources?: Pick<PersonaResourceItem, "persona_id" | "name">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  placeholder: _placeholder = "Select personas...",
  description,
  group_id,
  create_tool_id,
  createPersonasAction,
  onGenerate,
  showAiGenerate = false,
  isGenerating = false,
  videoEnabled = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiPersonaResources,
  onAccept,
  onReject,
}: PersonasProps) {
  const ids = useMemo(() => persona_ids ?? [], [persona_ids]);
  const show = show_personas ?? false;
  const allPersonas = useMemo(() => personas ?? [], [personas]);

  // Filter personas based on video mode
  // Include if: video mode ON and has video_persona, OR video mode OFF and has non_video_persona
  // Always include if neither flag is set (backward compatibility)
  const filteredPersonas = useMemo(() => {
    return allPersonas.filter((p) => {
      const hasVideoFlag = p.video_persona === true;
      const hasNonVideoFlag = p.non_video_persona === true;
      // If neither flag is set, always show (backward compatibility)
      if (!hasVideoFlag && !hasNonVideoFlag) {
        return true;
      }
      // If video mode is on, show if video_persona is true
      if (videoEnabled) {
        return hasVideoFlag;
      }
      // If video mode is off, show if non_video_persona is true
      return hasNonVideoFlag;
    });
  }, [allPersonas, videoEnabled]);
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
    return filteredPersonas
      .filter((p) => p.persona_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.persona_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}), // Only include if not null/undefined
        ...(p.icon ? { icon: p.icon } : {}),
        ...(p.color ? { color: p.color } : {}),
      }));
  }, [filteredPersonas]);

  // Ref for flush function
  const flushRef = useRef<(() => Promise<{ persona_ids: string[] } | void>) | undefined>(undefined);

  // Check if a persona is suggested
  const isSuggested = useCallback(
    (personaId: string) => suggestionsList.includes(personaId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (personaId: string) => {
      // Toggle selection
      const isCurrentlySelected = ids.includes(personaId);
      const newIds = isCurrentlySelected
        ? ids.filter((id) => id !== personaId)
        : [...ids, personaId];

      // Create resource if newly selected (only if autosave is enabled)
      if (
        isAutosaveEnabled &&
        !isCurrentlySelected &&
        !createdPersonaIdsRef.current.has(personaId) &&
        createPersonasAction &&
        group_id
      ) {
        try {
          await createPersonasAction({
            body: {
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
        }
      }

      // Update parent state
      onChange(newIds);
    },
    [ids, onChange, createPersonasAction, group_id, isAutosaveEnabled]
  );

  // Flush function for manual save mode - creates pending resources and returns all IDs
  flushRef.current = async (): Promise<{ persona_ids: string[] } | void> => {
    if (!createPersonasAction || !group_id) {
      return { persona_ids: ids };
    }

    // Create resources for any selected personas that haven't been created yet
    for (const personaId of ids) {
      if (!createdPersonaIdsRef.current.has(personaId)) {
        try {
          await createPersonasAction({
            body: {
              group_id: group_id,
              persona_id: personaId,
              mcp: false,
            },
          });
          createdPersonaIdsRef.current.add(personaId);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to create persona resource for ${personaId}:`, error);
        }
      }
    }

    return { persona_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Check if any persona resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return persona_resources?.some((p) => p.generated) ?? false;
  }, [persona_resources]);

  // AI suggestion state
  const showDiff = !!aiPersonaResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiPersonaResources
          ?.map((p) => p.persona_id)
          .filter(Boolean) as string[]
      ),
    [aiPersonaResources]
  );

  // Accept AI suggestion - add AI-suggested personas to selection
  const handleAccept = useCallback(() => {
    if (!aiPersonaResources?.length) return;
    const newIds = aiPersonaResources
      .map((p) => p.persona_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiPersonaResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_personas is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
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
      )}

      <SelectableGrid<PersonaItem>
        items={personaItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        horizontal={true}
        renderItem={(item, isSelected) => {
          const suggested = isSuggested(item.id);
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);
          const IconComponent = getPersonaIconComponent(item.icon || "") || Brain;
          const hexColor = item.color || "#64748b";

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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

              {/* AI suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {/* Suggested badge - top right */}
              {suggested && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  Suggested
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg shadow-lg flex-shrink-0"
                  style={{
                    background: generateGradientFromHex(hexColor),
                  }}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm leading-tight">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage="No personas found."
        disabled={disabled}
      />
    </div>
  );
}
