/**
 * PersonaPicker.tsx
 * Used to pick a persona as part of the scenario
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Brain, Check, ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Persona } from "@/types";
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

export interface PersonaPickerProps extends PopoverProps {
  personas: Persona[];
  label?: string;
  placeholder?: string;
  description?: string;
  onSelect?: (persona: Persona) => void;
  selectedPersona?: Persona | undefined;
  disabled?: boolean; // Disable the picker
}

export function PersonaPicker({
  personas,
  label = "Persona",
  placeholder = "Select a persona...",
  description = "Choose the persona that will interact with students in this scenario.",
  onSelect,
  selectedPersona: externalSelectedPersona,
  disabled = false,
  ...props
}: PersonaPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalSelectedPersona, setInternalSelectedPersona] = React.useState<
    Persona | undefined
  >(undefined);
  const [peekedPersona, setPeekedPersona] = React.useState<Persona | undefined>(
    personas.find((p) => p.active) || personas[0]
  );

  // Use external selectedPersona if provided, otherwise use internal state
  const selectedPersona = externalSelectedPersona || internalSelectedPersona;

  const handleSelect = (persona: Persona) => {
    if (!externalSelectedPersona) {
      setInternalSelectedPersona(persona);
    }
    onSelect?.(persona);
    setOpen(false);
  };

  // Allow clearing selection
  const handleClear = () => {
    if (!externalSelectedPersona) {
      setInternalSelectedPersona(undefined);
    }
    // Call onSelect with a special "clear" persona to indicate clearing
    onSelect?.({
      id: "",
      name: "",
      description: "",
      color: "#64748b",
      icon: "Brain",
      reasoning: "low",
      temperature: 50,
      defaultPersona: false,
      active: true,
      createdAt: "",
      updatedAt: "",
      systemPrompt: "",
      modelId: "",
    });
    setOpen(false);
  };

  const getButtonText = () => {
    return selectedPersona ? selectedPersona.name : placeholder;
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
                {peekedPersona?.reasoning && (
                  <div className="mt-4 grid gap-2">
                    <h5 className="text-sm font-medium leading-none">
                      Reasoning Level
                    </h5>
                    <div className="text-sm text-muted-foreground">
                      {peekedPersona.reasoning}
                    </div>
                  </div>
                )}
                {peekedPersona?.temperature !== undefined && (
                  <div className="mt-2 grid gap-2">
                    <h5 className="text-sm font-medium leading-none">
                      Temperature
                    </h5>
                    <div className="text-sm text-muted-foreground">
                      {(peekedPersona.temperature / 100).toFixed(2)}
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
                {selectedPersona && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear Selection
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Personas">
                  {personas
                    .filter((persona) => persona.active)
                    .map((persona) => (
                      <PersonaItem
                        key={persona.id}
                        persona={persona}
                        isSelected={selectedPersona?.id === persona.id}
                        onPeek={(persona) => setPeekedPersona(persona)}
                        onSelect={() => handleSelect(persona)}
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

interface PersonaItemProps {
  persona: Persona;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (persona: Persona) => void;
}

function PersonaItem({
  persona,
  isSelected,
  onSelect,
  onPeek,
}: PersonaItemProps) {
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
