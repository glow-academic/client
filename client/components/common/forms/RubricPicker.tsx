/**
 * RubricPicker.tsx
 * Used to pick rubrics for filtering analytics views
 * Refactored to use mapping-based API pattern
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
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
import type { MappingItem } from "@/lib/api/v2/schemas/base";
import { cn } from "@/lib/utils";

export interface RubricPickerProps<T extends MappingItem = MappingItem>
  extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
}

export function RubricPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  multiSelect = false,
  placeholder = "Select rubrics...",
  hideSelectedChips = true,
  buttonClassName,
  ...props
}: RubricPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build rubrics from mapping
  const rubrics = React.useMemo(() => {
    return validIds
      .map((id) => {
        const item = mapping[id];
        if (!item) return null;
        return {
          id,
          ...item,
        } as { id: string } & T;
      })
      .filter((r): r is { id: string } & T => r !== null);
  }, [validIds, mapping]);

  const [peekedRubric, setPeekedRubric] = React.useState<
    ({ id: string } & T) | undefined
  >(rubrics[0]);

  const handleSelect = (rubricId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(rubricId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== rubricId)
        : [...selectedIds, rubricId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([rubricId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (rubricId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== rubricId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const rubric = mapping[selectedIds[0]!];
      return rubric?.name || placeholder;
    }
    return `${selectedIds.length} rubrics selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No rubrics found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const rubric = mapping[id];
            if (!rubric) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{rubric.name}</span>
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
            aria-label="Select rubrics"
            className={cn("w-full justify-between", buttonClassName)}
            size="sm"
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
                  {peekedRubric?.name || "No rubric selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedRubric?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search rubrics..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
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
                <CommandGroup heading="Rubrics">
                  {rubrics.map((rubric) => (
                    <RubricItem
                      key={rubric.id}
                      rubric={rubric}
                      isSelected={selectedIds.includes(rubric.id)}
                      onPeek={(rubric) => setPeekedRubric(rubric)}
                      onSelect={() => handleSelect(rubric.id)}
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

interface RubricItemProps<T extends MappingItem> {
  rubric: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (rubric: { id: string } & T) => void;
}

function RubricItem<T extends MappingItem>({
  rubric,
  isSelected,
  onSelect,
  onPeek,
}: RubricItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(rubric);
      }
    });
  });

  return (
    <CommandItem
      key={rubric.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{rubric.name}</div>
            {rubric.description && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {rubric.description}
              </div>
            )}
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0",
            isSelected ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </CommandItem>
  );
}
