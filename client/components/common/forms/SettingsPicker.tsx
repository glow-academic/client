/**
 * SettingsPicker.tsx
 * Used to pick settings versions by timestamp
 * Similar to ProblemStatementPicker but for settings
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

type SettingsInfo = {
  settings_id: string;
  created_at: string;
  active: boolean;
  organization_name: string;
};

export interface SettingsPickerProps extends PopoverProps {
  settingsMapping: Record<string, SettingsInfo>;
  selectedSettingsId: string | null;
  onSelect: (settingsId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function SettingsPicker({
  settingsMapping,
  selectedSettingsId,
  onSelect,
  placeholder = "Select settings version...",
  disabled = false,
  buttonClassName,
  ...props
}: SettingsPickerProps) {
  const [open, setOpen] = React.useState(false);

  const settings = React.useMemo(() => {
    // Convert mapping to array
    return Object.entries(settingsMapping).map(([id, info]) => ({
      id,
      ...info,
    }));
  }, [settingsMapping]);

  // Sort by created_at descending (newest first), then by id for stable sort
  const sortedSettings = React.useMemo(() => {
    return [...settings].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // If same timestamp, sort by ID for stable ordering
      return a.id.localeCompare(b.id);
    });
  }, [settings]);

  const handleSelect = (settingsId: string) => {
    onSelect(settingsId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedSettingsId) {
      return placeholder;
    }
    const setting = settingsMapping[selectedSettingsId];
    if (!setting) {
      return placeholder;
    }
    const date = new Date(setting.created_at);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select settings version"
          className={cn("justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <Command loop>
          <CommandList className="max-h-[300px]">
            <CommandInput placeholder="Search settings..." />
            <CommandEmpty>No settings found.</CommandEmpty>
            {sortedSettings.length > 0 && (
              <CommandGroup heading="Settings History">
                {sortedSettings.map((setting) => {
                  const date = new Date(setting.created_at);
                  const isSelected = selectedSettingsId === setting.id;
                  return (
                    <CommandItem
                      key={setting.id}
                      value={setting.id}
                      onSelect={() => handleSelect(setting.id)}
                      className="flex flex-col items-start py-3"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="font-medium">
                            {date.toLocaleDateString()}{" "}
                            {date.toLocaleTimeString()}
                          </span>
                          {setting.active && (
                            <span className="text-xs text-muted-foreground">
                              (Active)
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {setting.organization_name}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

