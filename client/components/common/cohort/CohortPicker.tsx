/**
 * CohortPicker.tsx
 * Used to pick cohorts for filtering the progress view
 * Refactored to use mapping-based API pattern
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
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

export interface CohortPickerProps<T extends MappingItem = MappingItem>
  extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  placeholder?: string;
  hideSelectedChips?: boolean;
}

export function CohortPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  placeholder = "Select cohorts...",
  hideSelectedChips = true,
  ...props
}: CohortPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build cohorts from mapping
  const cohorts = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  const [peekedCohort, setPeekedCohort] = React.useState<
    ({ id: string } & T) | undefined
  >(cohorts[0] as ({ id: string } & T) | undefined);

  const handleSelect = (cohortId: string) => {
    const isSelected = selectedIds.includes(cohortId);
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== cohortId)
      : [...selectedIds, cohortId];
    onSelect(newIds);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (cohortId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== cohortId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const cohort = mapping[selectedIds[0]!];
      return cohort?.name || placeholder;
    }
    return `${selectedIds.length} cohorts selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No cohorts found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const cohort = mapping[id];
            if (!cohort) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{cohort.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
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
            variant="secondary"
            role="combobox"
            aria-expanded={open}
            aria-label="Select cohorts"
            className="w-full justify-between"
            size="sm"
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
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
                  {peekedCohort?.name || "Cohort selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedCohort?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search cohorts..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Cohorts">
                  {cohorts.map((cohort) => (
                    <CohortItem
                      key={cohort.id}
                      cohort={cohort as { id: string } & T}
                      isSelected={selectedIds.includes(cohort.id)}
                      onPeek={(c) => setPeekedCohort(c)}
                      onSelect={() => handleSelect(cohort.id)}
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

interface CohortItemProps<T extends MappingItem> {
  cohort: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (cohort: { id: string } & T) => void;
}

function CohortItem<T extends MappingItem>({
  cohort,
  isSelected,
  onSelect,
  onPeek,
}: CohortItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(cohort);
      }
    });
  });

  return (
    <CommandItem
      key={cohort.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">{cohort.name}</div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
