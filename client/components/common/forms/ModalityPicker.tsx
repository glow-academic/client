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
  { id: "text", name: "Text", description: "Text input/output" },
  { id: "audio", name: "Audio", description: "Audio input/output" },
  { id: "video", name: "Video", description: "Video input/output" },
  { id: "image", name: "Image", description: "Image input/output" },
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
      return "Select input modalities...";
    }
    if (inputModalities.length === 1) {
      const mod = MODALITIES.find((m) => m.id === inputModalities[0]);
      return mod?.name || "Select input modalities...";
    }
    return `${inputModalities.length} input modalities`;
  };

  const getOutputButtonText = () => {
    if (outputModalities.length === 0) {
      return "Select output modalities...";
    }
    if (outputModalities.length === 1) {
      const mod = MODALITIES.find((m) => m.id === outputModalities[0]);
      return mod?.name || "Select output modalities...";
    }
    return `${outputModalities.length} output modalities`;
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {/* Input Modalities */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Input Modalities</label>
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
                            {modality.description && (
                              <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                {modality.description}
                              </div>
                            )}
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
        {inputModalities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {inputModalities.map((id) => {
              const mod = MODALITIES.find((m) => m.id === id);
              if (!mod) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
                >
                  <span>{mod.name}</span>
                  <button
                    type="button"
                    onClick={() => handleInputSelect(id)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Output Modalities */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Output Modalities</label>
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
                            {modality.description && (
                              <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                {modality.description}
                              </div>
                            )}
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
        {outputModalities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {outputModalities.map((id) => {
              const mod = MODALITIES.find((m) => m.id === id);
              if (!mod) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
                >
                  <span>{mod.name}</span>
                  <button
                    type="button"
                    onClick={() => handleOutputSelect(id)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

