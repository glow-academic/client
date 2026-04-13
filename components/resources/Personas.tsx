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
import { cn } from "@/lib/utils";
import { getIconComponent } from "@/utils/icons";
import { Brain, Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

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

export interface PersonaResourceItem {
  persona_id?: string | null;
  id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
  video_persona?: boolean | null;
  non_video_persona?: boolean | null;
  icon?: string | null;
  color?: string | null;
}

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
  videoEnabled?: boolean; // Whether video mode is enabled (for filtering)
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
  videoEnabled = false,
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

  // Check if a persona is suggested
  const isSuggested = useCallback(
    (personaId: string) => suggestionsList.includes(personaId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (personaId: string) => {
      // Toggle selection
      const isCurrentlySelected = ids.includes(personaId);
      const newIds = isCurrentlySelected
        ? ids.filter((id) => id !== personaId)
        : [...ids, personaId];

      onChange(newIds);
    },
    [ids, onChange]
  );

  // Pending state: items with pending=true from the API
  const pendingItems = useMemo(
    () => personaItems.filter((i) => {
      const full = filteredPersonas.find((p) => p.persona_id === i.id);
      return full?.pending === true;
    }),
    [personaItems, filteredPersonas]
  );
  const pendingIds = useMemo(() => new Set(pendingItems.map((i) => i.id)), [pendingItems]);
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in the list, no-op for selection
  const handleAccept = useCallback(() => {
    // no-op: pending items already in selection
  }, []);

  // Reject pending — remove pending IDs from selection
  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, pendingIds]);

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
          const isPending = showDiff && pendingIds.has(item.id);
          const IconComponent = getIconComponent(item.icon || "") || Brain;
          const hexColor = item.color || "#64748b";

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isPending &&
                  !isSelected &&
                  "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* Pending badge - top right */}
              {isPending && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Suggested
                </div>
              )}

              {/* Suggested dot indicator - top right */}
              {suggested && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
