/**
 * VoiceMultiPicker.tsx
 * Used to pick multiple voices for audio models (voice enum)
 * Based on ReasoningPicker pattern
 * @AshokSaravanan222
 * 12/02/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

// Voice enum values (from database schema)
export const VOICES = [
  { id: "alloy", name: "Alloy" },
  { id: "ash", name: "Ash" },
  { id: "ballad", name: "Ballad" },
  { id: "coral", name: "Coral" },
  { id: "echo", name: "Echo" },
  { id: "fable", name: "Fable" },
  { id: "onyx", name: "Onyx" },
  { id: "nova", name: "Nova" },
  { id: "sage", name: "Sage" },
  { id: "shimmer", name: "Shimmer" },
  { id: "verse", name: "Verse" },
] as const;

export type Voice = (typeof VOICES)[number]["id"];

export interface VoiceMultiPickerProps extends PopoverProps {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function VoiceMultiPicker({
  selectedIds,
  onSelect,
  multiSelect = true,
  placeholder = "Select voices...",
  hideSelectedChips = true,
  buttonClassName,
  disabled = false,
  ...props
}: VoiceMultiPickerProps) {
  const [open, setOpen] = React.useState(false);

  const validIds = VOICES.map((v) => v.id);
  const mapping = Object.fromEntries(
    VOICES.map((v) => [v.id, { name: v.name, description: "" }]),
  );

  const voices = React.useMemo(() => {
    return validIds
      .map((id) => {
        const item = mapping[id];
        if (!item) return null;
        return {
          id,
          ...item,
        };
      })
      .filter((v) => v !== null);
  }, [validIds, mapping]);

  const [peekedVoice, setPeekedVoice] = React.useState<
    { id: string; name: string; description: string } | undefined
  >(voices[0] || undefined);

  const handleSelect = (voiceId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(voiceId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== voiceId)
        : [...selectedIds, voiceId];
      onSelect(newIds);
    } else {
      onSelect([voiceId]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  const handleRemoveItem = (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== voiceId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const voice = mapping[selectedIds[0]!];
      return voice?.name || placeholder;
    }
    return `${selectedIds.length} voices selected`;
  };

  return (
    <div>
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const voice = mapping[id];
            if (!voice) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{voice.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen} {...props}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select voices"
            className={cn("w-full justify-between", buttonClassName)}
            disabled={disabled}
          >
            <span className="truncate text-left">{getButtonText()}</span>
            <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedVoice?.name || "No voice selected"}
                </h4>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search voices..." />
                <CommandEmpty>No voices found.</CommandEmpty>
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
                <CommandGroup heading="Voices">
                  {voices.map((voice) => (
                    <VoiceItem
                      key={voice.id}
                      voice={voice}
                      isSelected={selectedIds.includes(voice.id)}
                      onPeek={(voice) => setPeekedVoice(voice)}
                      onSelect={() => handleSelect(voice.id)}
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

interface VoiceItemProps {
  voice: { id: string; name: string; description: string };
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (voice: { id: string; name: string; description: string }) => void;
}

function VoiceItem({ voice, isSelected, onSelect, onPeek }: VoiceItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(voice);
      }
    });
  });

  return (
    <CommandItem
      key={voice.id}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{voice.name}</div>
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </CommandItem>
  );
}
