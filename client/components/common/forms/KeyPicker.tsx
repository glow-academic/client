/**
 * KeyPicker.tsx
 * Read-only picker for selecting API keys (similar to PromptPicker)
 */
"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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

export interface KeyMappingItem {
  name: string;
  description: string;
  key_masked: string;
  active: boolean;
  department_ids: string[] | null;
}

export interface KeyPickerProps<T extends KeyMappingItem = KeyMappingItem> {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  defaultKeyId: string | null; // ID of the default key for this model
  onSelect: (ids: string[]) => void;
  disabled?: boolean;
  /** Enable multi-select mode with badge display */
  multiSelect?: boolean;
  /** Where to render the selected badges relative to the button */
  badgesPosition?: "above" | "below";
  /** Show a Clear All button when items are selected */
  showClearAll?: boolean;
  /** Hide the selected badges (for compact display) */
  hideSelectedChips?: boolean;
  /** Compact mode - smaller button, no label */
  compact?: boolean;
  /** Custom button className */
  buttonClassName?: string;
  /** Show required indicator */
  required?: boolean;
  placeholder?: string;
}

export function KeyPicker<T extends KeyMappingItem = KeyMappingItem>({
  mapping,
  validIds,
  selectedIds,
  defaultKeyId,
  onSelect,
  disabled = false,
  multiSelect = false,
  badgesPosition = "below",
  showClearAll = false,
  hideSelectedChips = false,
  compact = false,
  buttonClassName,
  required = false,
  placeholder = "Select key...",
}: KeyPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Build keys from mapping
  const keys = useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  // Sort by name
  const sortedKeys = useMemo(() => {
    return [...keys].sort((a, b) => {
      const nameA = a.name?.toLowerCase() || "";
      const nameB = b.name?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    });
  }, [keys]);

  // Filter keys by search (search by name and description)
  const filteredKeys = useMemo(() => {
    if (!search.trim()) return sortedKeys;
    const searchLower = search.toLowerCase();
    return sortedKeys.filter((key) => {
      const name = key.name?.toLowerCase() || "";
      const description = key.description?.toLowerCase() || "";
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [sortedKeys, search]);

  const handleKeySelect = (keyId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(keyId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== keyId)
        : [...selectedIds, keyId];
      onSelect(newIds);
    } else {
      onSelect([keyId]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelect([]);
    if (!multiSelect) {
      setOpen(false);
    }
  };

  const handleRemoveItem = (keyId: string) => {
    onSelect(selectedIds.filter((id) => id !== keyId));
  };

  const getButtonText = () => {
    const requiredIndicator = required ? " *" : "";
    if (selectedIds.length === 0) {
      return `${placeholder}${requiredIndicator}`;
    }
    if (multiSelect) {
      if (compact) {
        const names = selectedIds
          .map((id) => mapping[id]?.name)
          .filter(Boolean) as string[];
        if (names.length === 0) {
          return `${selectedIds.length} keys selected${requiredIndicator}`;
        }
        return names.join(", ") + requiredIndicator;
      }
      return `${selectedIds.length} keys selected${requiredIndicator}`;
    }
    const selectedKey = mapping[selectedIds[0]!];
    return (
      (selectedKey?.name || `${placeholder}${requiredIndicator}`) +
      requiredIndicator
    );
  };

  const isSelectedDefault = selectedIds.length > 0 && selectedIds[0] === defaultKeyId;


  // Badge display for multi-select mode
  const Badges = (
    <div className="flex flex-wrap gap-1">
      {selectedIds.map((id) => {
        const key = mapping[id];
        if (!key) return null;
        return (
          <Badge
            key={id}
            variant="secondary"
            className="flex items-center gap-1"
          >
            <span className="truncate max-w-[200px]">{key.name}</span>
            <button
              type="button"
              aria-label={`Remove ${key.key_masked}`}
              onClick={() => handleRemoveItem(id)}
              className="inline-flex items-center"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );

  return (
    <div className={compact ? "" : "grid gap-2"}>
      {/* Show badges above button if configured */}
      {multiSelect &&
        !hideSelectedChips &&
        selectedIds.length > 0 &&
        badgesPosition === "above" && <div className="mb-2">{Badges}</div>}

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select key"
            className={cn(
              compact
                ? "h-7 px-2 text-xs justify-between w-full"
                : "w-full justify-between",
              buttonClassName
            )}
            size={compact ? "sm" : "default"}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSelectedDefault && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5 flex-shrink-0">
                  Default
                </Badge>
              )}
              <span className="truncate">{getButtonText()}</span>
            </div>
            <ChevronsUpDown
              className={cn(
                compact ? "h-3 w-3 opacity-50" : "opacity-50",
                "flex-shrink-0 ml-2"
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[400px] p-0">
          <Command loop>
            <CommandList className="max-h-[300px]">
              <CommandInput placeholder="Search keys..." />
              <CommandEmpty>No keys found.</CommandEmpty>
              {filteredKeys.length > 0 && (
                <CommandGroup heading="Keys">
                  {filteredKeys.map((key) => {
                    const isSelected = selectedIds.includes(key.id);
                    const isDefault = key.id === defaultKeyId;
                    return (
                      <CommandItem
                        key={key.id}
                        onSelect={() => handleKeySelect(key.id)}
                        className="flex flex-col items-start py-3"
                        data-testid="key-option"
                        data-key-id={key.id}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isDefault && (
                                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                  Default
                                </Badge>
                              )}
                              <div className="font-medium truncate">
                                {key.name || "Unnamed Key"}
                              </div>
                            </div>
                            {key.description && (
                              <div className="text-sm text-muted-foreground truncate">
                                {key.description}
                              </div>
                            )}
                            {key.department_ids &&
                              key.department_ids.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {key.department_ids.length} department
                                  {key.department_ids.length !== 1 ? "s" : ""}
                                </div>
                              )}
                            {!key.active && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Inactive
                              </div>
                            )}
                          </div>
                          <Check
                            className={cn(
                              "ml-auto",
                              isSelected ? "opacity-100" : "opacity-0"
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

      {/* Show badges below button if configured */}
      {multiSelect &&
        !hideSelectedChips &&
        !compact &&
        selectedIds.length > 0 &&
        badgesPosition === "below" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1">{Badges}</div>
            {showClearAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
              >
                Clear All
              </Button>
            )}
          </div>
        )}

    </div>
  );
}

export default KeyPicker;
