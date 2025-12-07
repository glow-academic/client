/**
 * SettingsPicker.tsx
 * Used to pick settings for departments
 * @AshokSaravanan222
 * 01/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export interface SettingsInfo {
  settings_id: string;
  created_at: string;
  active: boolean;
  department_ids: string[] | null;
}

type TriggerButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "data-testid"
> & {
  "data-testid"?: string;
};

export interface SettingsPickerProps extends PopoverProps {
  settingsMapping: Record<string, SettingsInfo>;
  selectedSettingsId: string | null;
  defaultSettingsId: string | null; // ID of the default settings
  onSelect: (settingsId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
  triggerProps?: TriggerButtonProps;
}

export function SettingsPicker({
  settingsMapping,
  selectedSettingsId,
  defaultSettingsId,
  onSelect,
  placeholder = "Select settings...",
  disabled = false,
  buttonClassName,
  triggerProps,
  ...props
}: SettingsPickerProps) {
  const [open, setOpen] = React.useState(false);

  const settings = React.useMemo(() => {
    return Object.entries(settingsMapping).map(([id, info]) => ({
      id,
      ...info,
    }));
  }, [settingsMapping]);

  // Sort by created_at descending (newest first)
  const sortedSettings = React.useMemo(() => {
    return [...settings].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
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
    // Format date for display
    const date = new Date(setting.created_at);
    return `Settings (${date.toLocaleDateString()})`;
  };

  const isSelectedDefault = selectedSettingsId === defaultSettingsId;

  const { className: triggerClassName, ...restTriggerProps } =
    triggerProps ?? {};

  const buttonClasses = cn(
    "justify-between",
    buttonClassName,
    triggerClassName,
  );

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select settings"
          className={buttonClasses}
          disabled={disabled}
          {...restTriggerProps}
        >
          <div className="flex items-center gap-2 truncate">
            {isSelectedDefault && (
              <Badge
                variant="secondary"
                className="text-xs h-5 px-1.5 flex-shrink-0"
              >
                Default
              </Badge>
            )}
            <span className="truncate">{getButtonText()}</span>
          </div>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <Command loop>
          <CommandList className="max-h-[300px]">
            <CommandInput placeholder="Search settings..." />
            <CommandEmpty>No settings found.</CommandEmpty>
            {sortedSettings.length > 0 && (
              <CommandGroup heading="Settings">
                {sortedSettings.map((setting) => {
                  const isSelected = selectedSettingsId === setting.id;
                  const isDefault =
                    setting.id === defaultSettingsId ||
                    !setting.department_ids ||
                    setting.department_ids.length === 0;
                  const date = new Date(setting.created_at);
                  return (
                    <CommandItem
                      key={setting.id}
                      onSelect={() => handleSelect(setting.id)}
                      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                      data-testid="settings-option"
                      data-settings-id={setting.id}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isDefault && (
                              <Badge
                                variant="secondary"
                                className="text-xs h-5 px-1.5"
                              >
                                Default
                              </Badge>
                            )}
                            <div className="font-medium truncate">
                              Settings ({date.toLocaleDateString()})
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                            {setting.active ? "Active" : "Inactive"}
                          </div>
                          {setting.department_ids &&
                            setting.department_ids.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {setting.department_ids.length} department
                                {setting.department_ids.length !== 1 ? "s" : ""}
                              </div>
                            )}
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
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
