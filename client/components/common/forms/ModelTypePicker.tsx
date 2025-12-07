/**
 * ModelTypePicker.tsx
 * Used to pick model types for model assignment (model_type enum)
 * Based on ProviderPicker pattern
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

// Model type enum values (from database schema)
export const MODEL_TYPES = [
  {
    id: "text",
    name: "Text",
    description: "Text-based language models",
  },
  {
    id: "audio",
    name: "Audio",
    description: "Audio-based conversational models",
  },
  {
    id: "video",
    name: "Video",
    description: "Video generation models",
  },
] as const;

export type ModelType = (typeof MODEL_TYPES)[number]["id"];

export interface ModelTypePickerProps extends PopoverProps {
  selectedModelType: string;
  onSelect: (modelType: string) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function ModelTypePicker({
  selectedModelType,
  onSelect,
  placeholder = "Select model type...",
  disabled = false,
  buttonClassName,
  ...props
}: ModelTypePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (modelTypeId: string) => {
    onSelect(modelTypeId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedModelType) {
      return placeholder;
    }
    const modelType = MODEL_TYPES.find((mt) => mt.id === selectedModelType);
    return modelType?.name || placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select model type"
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
            <CommandInput placeholder="Search model types..." />
            <CommandEmpty>No model types found.</CommandEmpty>
            <CommandGroup heading="Model Types">
              {MODEL_TYPES.map((modelType) => (
                <CommandItem
                  key={modelType.id}
                  onSelect={() => handleSelect(modelType.id)}
                  className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                  data-testid="model-type-option"
                  data-model-type-id={modelType.id}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{modelType.name}</div>
                        {modelType.description && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {modelType.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto flex-shrink-0",
                        selectedModelType === modelType.id
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
