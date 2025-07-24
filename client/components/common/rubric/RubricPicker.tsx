/**
 * RubricPicker.tsx
 * Used to pick rubrics for filtering analytics views
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
import { cn } from "@/lib/utils";

export interface Rubric {
  id: string;
  name: string;
  description?: string;
  points?: number;
  active?: boolean;
}

export interface RubricPickerProps extends PopoverProps {
  rubrics: Rubric[];
  placeholder?: string;
  onSelect?: (rubrics: Rubric[]) => void;
  selectedRubrics?: Rubric[];
  hideSelectedChips?: boolean;
  multiSelect?: boolean;
  buttonClassName?: string;
}

export function RubricPicker({
  rubrics,
  placeholder = "Select rubrics...",
  onSelect,
  selectedRubrics = [],
  hideSelectedChips = true,
  multiSelect = false,
  buttonClassName,
  ...props
}: RubricPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [peekedRubric, setPeekedRubric] = React.useState<Rubric | undefined>(
    rubrics[0]
  );

  const handleSelect = (rubric: Rubric) => {
    if (multiSelect) {
      const isSelected = selectedRubrics.some((r) => r.id === rubric.id);
      let newSelectedRubrics: Rubric[];

      if (isSelected) {
        // Remove from selection
        newSelectedRubrics = selectedRubrics.filter((r) => r.id !== rubric.id);
      } else {
        // Add to selection
        newSelectedRubrics = [...selectedRubrics, rubric];
      }

      onSelect?.(newSelectedRubrics);
      // Don't close popover in multi-select mode
    } else {
      // Single select mode
      onSelect?.([rubric]);
      setOpen(false);
    }
  };

  // Remove individual item
  const handleRemoveItem = (rubricToRemove: Rubric, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedRubrics = selectedRubrics.filter(
      (r) => r.id !== rubricToRemove.id
    );
    onSelect?.(newSelectedRubrics);
  };

  const getButtonText = () => {
    if (selectedRubrics.length === 0) {
      return placeholder;
    }
    if (selectedRubrics.length === 1) {
      return selectedRubrics[0]!.name;
    }
    return `${selectedRubrics.length} rubrics selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No rubrics found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedRubrics.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedRubrics.map((rubric) => (
            <div
              key={rubric.id}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
            >
              <span className="truncate">{rubric.name}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveItem(rubric, e)}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
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
                {peekedRubric?.points !== undefined && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {peekedRubric.points} points
                  </div>
                )}
                {peekedRubric?.active !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    Status: {peekedRubric.active ? "Active" : "Inactive"}
                  </div>
                )}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search rubrics..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />

                <CommandGroup heading="Rubrics">
                  {rubrics.map((rubric) => (
                    <RubricItem
                      key={rubric.id}
                      rubric={rubric}
                      isSelected={selectedRubrics.some(
                        (r) => r.id === rubric.id
                      )}
                      onPeek={(rubric) => setPeekedRubric(rubric)}
                      onSelect={() => handleSelect(rubric)}
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

interface RubricItemProps {
  rubric: Rubric;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (rubric: Rubric) => void;
}

function RubricItem({ rubric, isSelected, onSelect, onPeek }: RubricItemProps) {
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
            {rubric.points && (
              <div className="text-xs text-muted-foreground mt-1">
                {rubric.points} points
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
