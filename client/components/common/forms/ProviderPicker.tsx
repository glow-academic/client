/**
 * ProviderPicker.tsx
 * Used to pick providers for model assignment (provider enum)
 * Based on AgentRolePicker pattern
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
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

// Provider enum values (from database schema)
export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "OpenAI language models",
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Google Gemini language models",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Custom model with custom endpoint",
  },
] as const;

export type Provider = (typeof PROVIDERS)[number]["id"];

export interface ProviderPickerProps extends PopoverProps {
  selectedProvider: string;
  onSelect: (provider: string) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function ProviderPicker({
  selectedProvider,
  onSelect,
  placeholder = "Select provider...",
  disabled = false,
  buttonClassName,
  ...props
}: ProviderPickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (providerId: string) => {
    onSelect(providerId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedProvider) {
      return placeholder;
    }
    const provider = PROVIDERS.find((p) => p.id === selectedProvider);
    return provider?.name || placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select provider"
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
            <CommandInput placeholder="Search providers..." />
            <CommandEmpty>No providers found.</CommandEmpty>
            <CommandGroup heading="Providers">
              {PROVIDERS.map((provider) => (
                <CommandItem
                  key={provider.id}
                  onSelect={() => handleSelect(provider.id)}
                  className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                  data-testid="provider-option"
                  data-provider-id={provider.id}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{provider.name}</div>
                        {provider.description && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {provider.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto flex-shrink-0",
                        selectedProvider === provider.id
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
