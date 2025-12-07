/**
 * ReasoningLevelPicker.tsx
 * Used to pick reasoning levels for model configuration
 * Based on ReasoningPicker pattern
 * @AshokSaravanan222
 * 12/02/2025
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

// Reasoning level options
const REASONING_LEVELS = [
  { id: "none", name: "None", description: "No extended reasoning" },
  {
    id: "minimal",
    name: "Minimal",
    description: "Basic reasoning for straightforward tasks",
  },
  {
    id: "low",
    name: "Low",
    description: "Light reasoning for simple problem-solving",
  },
  {
    id: "medium",
    name: "Medium",
    description: "Balanced reasoning for moderate complexity",
  },
  {
    id: "high",
    name: "High",
    description: "Deep reasoning for complex, multi-step problems",
  },
] as const;

export interface ReasoningLevelPickerProps extends PopoverProps {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function ReasoningLevelPicker({
  selectedIds,
  onSelect,
  multiSelect = true,
  placeholder = "Select reasoning levels...",
  hideSelectedChips = true,
  buttonClassName,
  disabled = false,
  ...props
}: ReasoningLevelPickerProps) {
  const [open, setOpen] = React.useState(false);

  const validIds = REASONING_LEVELS.map((r) => r.id);
  const mapping = Object.fromEntries(
    REASONING_LEVELS.map((r) => [
      r.id,
      { name: r.name, description: r.description },
    ]),
  );

  const levels = React.useMemo(() => {
    return validIds
      .map((id) => {
        const item = mapping[id];
        if (!item) return null;
        return {
          id,
          ...item,
        };
      })
      .filter((r) => r !== null);
  }, [validIds, mapping]);

  const [peekedLevel, setPeekedLevel] = React.useState<
    { id: string; name: string; description: string } | undefined
  >(levels[0] || undefined);

  const handleSelect = (levelId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(levelId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== levelId)
        : [...selectedIds, levelId];
      onSelect(newIds);
    } else {
      onSelect([levelId]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  const handleRemoveItem = (levelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== levelId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const level = mapping[selectedIds[0]!];
      return level?.name || placeholder;
    }
    return `${selectedIds.length} levels selected`;
  };

  return (
    <div>
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const level = mapping[id];
            if (!level) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{level.name}</span>
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
            aria-label="Select reasoning levels"
            className={cn("w-full justify-between", buttonClassName)}
            disabled={disabled}
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
                  {peekedLevel?.name || "No level selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedLevel?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search reasoning levels..." />
                <CommandEmpty>No reasoning levels found.</CommandEmpty>
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
                <CommandGroup heading="Reasoning Levels">
                  {levels.map((level) => (
                    <ReasoningLevelItem
                      key={level.id}
                      level={level}
                      isSelected={selectedIds.includes(level.id)}
                      onPeek={(level) => setPeekedLevel(level)}
                      onSelect={() => handleSelect(level.id)}
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

interface ReasoningLevelItemProps {
  level: { id: string; name: string; description: string };
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (level: { id: string; name: string; description: string }) => void;
}

function ReasoningLevelItem({
  level,
  isSelected,
  onSelect,
  onPeek,
}: ReasoningLevelItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(level);
      }
    });
  });

  return (
    <CommandItem
      key={level.id}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{level.name}</div>
            {level.description && (
              <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                {level.description}
              </div>
            )}
          </div>
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
}
