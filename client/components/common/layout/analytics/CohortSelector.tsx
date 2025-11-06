/**
 * CohortPicker.tsx
 * Used to pick cohorts for filtering the progress view
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
import { cn } from "@/lib/utils";

export interface Cohort {
  id: string;
  title: string | React.ReactNode;
  description?: string;
  memberCount?: number;
}

export interface CohortSelectorProps extends PopoverProps {
  cohorts: Cohort[];
  placeholder?: string;
  onSelect?: (cohorts: Cohort[]) => void;
  selectedCohorts?: Cohort[];
  hideSelectedChips?: boolean;
}

export function CohortSelector({
  cohorts,
  placeholder = "Select cohorts...",
  onSelect,
  selectedCohorts = [],
  hideSelectedChips = true,
  ...props
}: CohortSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [peekedCohort, setPeekedCohort] = React.useState<Cohort | undefined>(
    cohorts[0],
  );

  const handleSelect = (cohort: Cohort) => {
    const isSelected = selectedCohorts.some((c) => c.id === cohort.id);
    let newSelectedCohorts: Cohort[];

    if (isSelected) {
      // Remove from selection
      newSelectedCohorts = selectedCohorts.filter((c) => c.id !== cohort.id);
    } else {
      // Add to selection
      newSelectedCohorts = [...selectedCohorts, cohort];
    }

    onSelect?.(newSelectedCohorts);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect?.([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (cohortToRemove: Cohort, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedCohorts = selectedCohorts.filter(
      (c) => c.id !== cohortToRemove.id,
    );
    onSelect?.(newSelectedCohorts);
  };

  const getButtonText = () => {
    if (selectedCohorts.length === 0) {
      return placeholder;
    }
    if (selectedCohorts.length === 1) {
      const title = selectedCohorts[0]!.title;
      return typeof title === "string" ? title : "Cohort selected";
    }
    return `${selectedCohorts.length} cohorts selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No cohorts found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedCohorts.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedCohorts.map((cohort) => (
            <div
              key={cohort.id}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{cohort.title}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveItem(cohort, e)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
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
                  {typeof peekedCohort?.title === "string"
                    ? peekedCohort.title
                    : "Cohort selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedCohort?.description || "No description available"}
                </div>
                {peekedCohort?.memberCount !== undefined && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {peekedCohort.memberCount} member
                    {peekedCohort.memberCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search cohorts..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedCohorts.length > 0 && (
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
                      cohort={cohort}
                      isSelected={selectedCohorts.some(
                        (c) => c.id === cohort.id,
                      )}
                      onPeek={(cohort) => setPeekedCohort(cohort)}
                      onSelect={() => handleSelect(cohort)}
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

interface CohortItemProps {
  cohort: Cohort;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (cohort: Cohort) => void;
}

function CohortItem({ cohort, isSelected, onSelect, onPeek }: CohortItemProps) {
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
        <div className="flex items-center gap-2">{cohort.title}</div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
