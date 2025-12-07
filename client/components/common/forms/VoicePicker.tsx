/**
 * VoicePicker.tsx
 * Used to pick voice for audio models (voice enum)
 * Based on RolePicker pattern
 * @AshokSaravanan222
 * 11/24/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export interface VoicePickerProps extends PopoverProps {
  selectedVoice: string | null;
  onSelect: (voice: string) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function VoicePicker({
  selectedVoice,
  onSelect,
  placeholder = "Select voice...",
  disabled = false,
  buttonClassName,
  ...props
}: VoicePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (voiceId: string) => {
    onSelect(voiceId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedVoice) {
      return placeholder;
    }
    const voice = VOICES.find((v) => v.id === selectedVoice);
    return voice?.name || placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select voice"
          className={cn("w-full justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate text-left">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <Command loop>
          <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
            <CommandInput placeholder="Search voices..." />
            <CommandEmpty>No voices found.</CommandEmpty>
            <CommandGroup heading="Voices">
              {VOICES.map((voice) => (
                <CommandItem
                  key={voice.id}
                  onSelect={() => handleSelect(voice.id)}
                  className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{voice.name}</div>
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto flex-shrink-0",
                        selectedVoice === voice.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
