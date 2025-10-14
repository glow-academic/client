/**
 * ParameterItemSelector.tsx
 * Multi-select parameter items component using mappings from V2 API
 * @AshokSaravanan222 & @siladiea
 * 10/14/2025
 */
"use client";

import { Check, X } from "lucide-react";
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
import type { ParameterItemMapping } from "@/lib/api/v2/schemas/personas";
import { cn } from "@/lib/utils";

export interface ParameterItemSelectorProps {
  parameterItemMapping: ParameterItemMapping;
  selectedParameterItemIds: string[];
  validParameterItemIds: string[];
  onChange: (parameterItemIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ParameterItemSelector({
  parameterItemMapping,
  selectedParameterItemIds,
  validParameterItemIds,
  onChange,
  placeholder = "Select parameter items",
  disabled = false,
}: ParameterItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Group items by parameter
  const groupedItems = useMemo(() => {
    const groups: Record<
      string,
      { name: string; items: Array<{ id: string; name: string }> }
    > = {};

    validParameterItemIds.forEach((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return;

      const parameterId = item.parameter_id;
      if (!groups[parameterId]) {
        groups[parameterId] = {
          name: item.parameter_name,
          items: [],
        };
      }
      groups[parameterId].items.push({
        id: itemId,
        name: item.name,
      });
    });

    return Object.entries(groups).map(([parameterId, group]) => ({
      parameterId,
      parameterName: group.name,
      items: group.items,
    }));
  }, [parameterItemMapping, validParameterItemIds]);

  // Filter items by search
  const filteredGroups = useMemo(() => {
    if (!search) return groupedItems;

    const lowerSearch = search.toLowerCase();
    return groupedItems
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.name.toLowerCase().includes(lowerSearch) ||
            group.parameterName.toLowerCase().includes(lowerSearch)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedItems, search]);

  const handleSelect = (itemId: string) => {
    const newSelection = selectedParameterItemIds.includes(itemId)
      ? selectedParameterItemIds.filter((id) => id !== itemId)
      : [...selectedParameterItemIds, itemId];
    onChange(newSelection);
  };

  const handleRemove = (itemId: string) => {
    onChange(selectedParameterItemIds.filter((id) => id !== itemId));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate">
              {selectedParameterItemIds.length > 0
                ? `${selectedParameterItemIds.length} selected`
                : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search parameter items..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No parameter items found.</CommandEmpty>
            <CommandList>
              {filteredGroups.map((group) => (
                <CommandGroup
                  key={group.parameterId}
                  heading={group.parameterName}
                >
                  {group.items.map((item) => {
                    const isSelected = selectedParameterItemIds.includes(
                      item.id
                    );
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item.id)}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                        <span className="flex-1">{item.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected items badges */}
      {selectedParameterItemIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedParameterItemIds.map((itemId) => {
            const item = parameterItemMapping[itemId];
            if (!item) return null;
            return (
              <Badge key={itemId} variant="secondary" className="text-xs">
                {item.parameter_name}: {item.name}
                <button
                  type="button"
                  className="ml-1 hover:text-destructive"
                  onClick={() => handleRemove(itemId)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {selectedParameterItemIds.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={handleClearAll}
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
