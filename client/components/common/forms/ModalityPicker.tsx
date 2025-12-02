/**
 * ModalityPicker.tsx
 * Used to pick input/output modalities for models
 * Based on ReasoningPicker pattern
 * @AshokSaravanan222
 * 12/02/2025
 */

"use client";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Modality options
const MODALITIES = [
  { id: "text", name: "Text" },
  { id: "audio", name: "Audio" },
  { id: "video", name: "Video" },
  { id: "image", name: "Image" },
] as const;

export interface ModalityPickerProps {
  inputModalities: string[];
  outputModalities: string[];
  onInputChange: (modalities: string[]) => void;
  onOutputChange: (modalities: string[]) => void;
  disabled?: boolean;
}

export function ModalityPicker({
  inputModalities,
  outputModalities,
  onInputChange,
  onOutputChange,
  disabled = false,
}: ModalityPickerProps) {
  const [inputOpen, setInputOpen] = React.useState(false);
  const [outputOpen, setOutputOpen] = React.useState(false);

  const handleInputSelect = (modalityId: string) => {
    const isSelected = inputModalities.includes(modalityId);
    const newModalities = isSelected
      ? inputModalities.filter((id) => id !== modalityId)
      : [...inputModalities, modalityId];
    onInputChange(newModalities);
  };

  const handleOutputSelect = (modalityId: string) => {
    const isSelected = outputModalities.includes(modalityId);
    const newModalities = isSelected
      ? outputModalities.filter((id) => id !== modalityId)
      : [...outputModalities, modalityId];
    onOutputChange(newModalities);
  };

  const handleInputClear = () => {
    onInputChange([]);
    setInputOpen(false);
  };

  const handleOutputClear = () => {
    onOutputChange([]);
    setOutputOpen(false);
  };

  const getInputButtonText = () => {
    if (inputModalities.length === 0) {
      return "Select input...";
    }
    const selectedNames = inputModalities
      .map((id) => MODALITIES.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(", ");
    return selectedNames || "Select input...";
  };

  const getOutputButtonText = () => {
    if (outputModalities.length === 0) {
      return "Select output...";
    }
    const selectedNames = outputModalities
      .map((id) => MODALITIES.find((m) => m.id === id)?.name)
      .filter(Boolean)
      .join(", ");
    return selectedNames || "Select output...";
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {/* Input Modalities */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Input</label>
        <Popover open={inputOpen} onOpenChange={setInputOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={inputOpen}
              aria-label="Select input modalities"
              className="w-full justify-between"
              disabled={disabled}
            >
              <span className="truncate text-left">{getInputButtonText()}</span>
              <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-0">
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search modalities..." />
                <CommandEmpty>No modalities found.</CommandEmpty>
                {inputModalities.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleInputClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Input Modalities">
                  {MODALITIES.map((modality) => (
                    <CommandItem
                      key={modality.id}
                      onSelect={() => handleInputSelect(modality.id)}
                      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{modality.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {`${modality.name} input`}
                            </div>
                          </div>
                        </div>
                        <Check
                          className={cn(
                            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
                            inputModalities.includes(modality.id)
                              ? "opacity-100"
                              : "opacity-0"
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
      </div>

      {/* Output Modalities */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Output</label>
        <Popover open={outputOpen} onOpenChange={setOutputOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={outputOpen}
              aria-label="Select output modalities"
              className="w-full justify-between"
              disabled={disabled}
            >
              <span className="truncate text-left">
                {getOutputButtonText()}
              </span>
              <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-0">
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search modalities..." />
                <CommandEmpty>No modalities found.</CommandEmpty>
                {outputModalities.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleOutputClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Output Modalities">
                  {MODALITIES.map((modality) => (
                    <CommandItem
                      key={modality.id}
                      onSelect={() => handleOutputSelect(modality.id)}
                      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{modality.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {`${modality.name} output`}
                            </div>
                          </div>
                        </div>
                        <Check
                          className={cn(
                            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
                            outputModalities.includes(modality.id)
                              ? "opacity-100"
                              : "opacity-0"
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
      </div>
    </div>
  );
}

