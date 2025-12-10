/**
 * PersonaSection.tsx
 * Reusable persona selection section component
 */
"use client";
import { Brain, Check, RotateCcw, Search, Shuffle } from "lucide-react";
import { useMemo } from "react";

import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";

type PersonaMappingItem = components["schemas"]["PersonaMappingItem"];

type StepStatus = "pending" | "active" | "completed";

export interface PersonaSectionProps {
  // Data
  validPersonaIds: string[];
  personaMapping: Record<string, PersonaMappingItem>;
  selectedPersonaIds: string[];

  // State
  searchTerm: string;
  minMax: { min: number; max: number };

  // Callbacks
  onPersonaIdsChange: (ids: string[]) => void;
  onSearchTermChange: (term: string) => void;
  onMinMaxChange: (minMax: { min: number; max: number }) => void;
  onRandomize: () => void;
  onReset: () => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  disabled?: boolean;
  isEditMode?: boolean;
}

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

export function PersonaSection({
  validPersonaIds,
  personaMapping,
  selectedPersonaIds,
  searchTerm,
  minMax,
  onPersonaIdsChange,
  onSearchTermChange,
  onMinMaxChange,
  onRandomize,
  onReset,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  disabled = false,
  isEditMode = false,
}: PersonaSectionProps) {
  // Filter personas based on search term
  const filteredPersonaIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return validPersonaIds;
    }
    const searchLower = searchTerm.toLowerCase();
    return validPersonaIds.filter((personaId) => {
      const persona = personaMapping[personaId];
      if (!persona) return false;
      const searchText =
        `${persona.name} ${persona.description || ""}`.toLowerCase();
      return searchText.includes(searchLower);
    });
  }, [validPersonaIds, personaMapping, searchTerm]);

  return (
    <Card
      className={cn(
        "transition-all",
        !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
        !isEditMode && stepStatus === "pending" && "opacity-50"
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div>
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
        <div className="flex items-center">
          <RangeSlider
            min={1}
            max={Math.min(5, validPersonaIds.length)}
            value={[
              minMax.min ?? 1,
              Math.min(Math.min(5, validPersonaIds.length), minMax.max ?? 2),
            ]}
            onValueChange={([min, max]) =>
              onMinMaxChange({
                min: min ?? 1,
                max: Math.min(Math.min(5, validPersonaIds.length), max ?? 2),
              })
            }
            disabled={isReadonly || disabled}
            className="w-[200px] mr-4"
          />
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRandomize}
                  disabled={isReadonly || disabled}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Randomize</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isReadonly || disabled}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-6">
        {/* Search bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search personas..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly || disabled}
          />
        </div>

        {/* Filtered personas grid */}
        <div className="grid grid-cols-2 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
          {filteredPersonaIds.map((personaId) => {
            const persona = personaMapping[personaId];
            if (!persona) return null;

            const IconComponent =
              getPersonaIconComponent(persona.icon) || Brain;
            const hexColor = persona.color || "#64748b";
            const isSelected = selectedPersonaIds.includes(personaId);

            return (
              <button
                key={personaId}
                type="button"
                onClick={() => {
                  if (isReadonly || disabled) return;
                  const newIds = isSelected
                    ? selectedPersonaIds.filter((id) => id !== personaId)
                    : [...selectedPersonaIds, personaId];
                  onPersonaIdsChange(newIds);
                }}
                disabled={isReadonly || disabled}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "ring-2 ring-primary bg-accent"
                )}
              >
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
                    <div className="font-medium text-sm">{persona.name}</div>
                    {persona.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {persona.description}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
