/**
 * PersonaPicker.tsx
 * Used to pick a persona as part of the scenario
 * Refactored to use mapping-based API pattern
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Brain, Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import type { PersonaMappingItem } from "@/lib/api/v2/schemas/base";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";

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

export interface PersonaPickerProps<
  T extends PersonaMappingItem = PersonaMappingItem,
> extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  multiSelect?: boolean;
  onSelect: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  disabled?: boolean;
}

export function PersonaPicker<
  T extends PersonaMappingItem = PersonaMappingItem,
>({
  mapping,
  validIds,
  selectedIds,
  multiSelect = false,
  onSelect,
  label = "Persona",
  placeholder = "Select a persona...",
  description = "Choose the persona that will interact with students in this scenario.",
  hideSelectedChips = false,
  disabled = false,
  ...props
}: PersonaPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build personas from mapping
  const personas = React.useMemo(() => {
    return validIds
      .map((id) => {
        const item = mapping[id];
        if (!item) return null;
        return { id, ...item } as { id: string } & T;
      })
      .filter((p): p is { id: string } & T => p !== null);
  }, [validIds, mapping]);

  const [peekedPersona, setPeekedPersona] = React.useState<
    ({ id: string } & T) | undefined
  >(undefined);

  const handleSelect = (personaId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(personaId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== personaId)
        : [...selectedIds, personaId];
      onSelect(newIds);
    } else {
      onSelect([personaId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item in multi-select mode
  const handleRemoveItem = (personaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiSelect) {
      const newIds = selectedIds.filter((id) => id !== personaId);
      onSelect(newIds);
    }
  };

  const getButtonText = () => {
    if (multiSelect) {
      if (selectedIds.length === 0) {
        return placeholder;
      }
      if (selectedIds.length === 1) {
        const persona = mapping[selectedIds[0]!];
        return persona?.name || placeholder;
      }
      return `${selectedIds.length} selected`;
    }
    if (selectedIds.length === 0) {
      return placeholder;
    }
    const persona = mapping[selectedIds[0]!];
    return persona?.name || placeholder;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  return (
    <div className="grid gap-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <Label htmlFor="persona">{label}</Label>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {description}
        </HoverCardContent>
      </HoverCard>

      {/* Show selected items in multi-select mode */}
      {multiSelect && selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const persona = mapping[id];
            if (!persona) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{persona.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
        {...props}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a persona"
            className="w-full justify-between"
            disabled={disabled}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[280px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedPersona?.name || "No persona selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedPersona?.description || "No description available"}
                </div>
                {"reasoning" in (peekedPersona || {}) &&
                  (peekedPersona as T & { reasoning?: string }).reasoning && (
                    <div className="mt-4 grid gap-2">
                      <h5 className="text-sm font-medium leading-none">
                        Reasoning Level
                      </h5>
                      <div className="text-sm text-muted-foreground">
                        {
                          (peekedPersona as T & { reasoning?: string })
                            .reasoning
                        }
                      </div>
                    </div>
                  )}
                {"temperature" in (peekedPersona || {}) &&
                  (peekedPersona as T & { temperature?: number })
                    .temperature !== undefined && (
                    <div className="mt-2 grid gap-2">
                      <h5 className="text-sm font-medium leading-none">
                        Temperature
                      </h5>
                      <div className="text-sm text-muted-foreground">
                        {(
                          (peekedPersona as T & { temperature?: number })
                            .temperature! / 100
                        ).toFixed(2)}
                      </div>
                    </div>
                  )}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search personas..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear {multiSelect ? "All" : "Selection"}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Personas">
                  {personas.map((persona) => (
                    <PersonaItem
                      key={persona.id}
                      persona={persona}
                      isSelected={selectedIds.includes(persona.id)}
                      onPeek={(persona) =>
                        setPeekedPersona(persona as { id: string } & T)
                      }
                      onSelect={() => handleSelect(persona.id)}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface PersonaItemProps<T extends PersonaMappingItem> {
  persona: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (persona: { id: string } & T) => void;
}

function PersonaItem<T extends PersonaMappingItem>({
  persona,
  isSelected,
  onSelect,
  onPeek,
}: PersonaItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(persona);
      }
    });
  });

  // Get the icon component from the persona's stored icon name
  const IconComponent = getPersonaIconComponent(persona.icon) || Brain;

  // Use the hex color directly with CSS custom properties
  const hexColor = persona.color || "#64748b"; // Default to slate if no color

  // Generate gradient from hex color
  const gradientStyle = generateGradientFromHex(hexColor);

  return (
    <CommandItem
      key={persona.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className="p-2 rounded-lg shadow-lg flex-shrink-0"
          style={{
            background: gradientStyle,
          }}
        >
          <IconComponent className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{persona.name}</div>
          {persona.description && (
            <div className="text-sm text-muted-foreground truncate">
              {persona.description}
            </div>
          )}
        </div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
