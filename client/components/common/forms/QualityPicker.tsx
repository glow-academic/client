/**
 * QualityPicker.tsx
 * Used to pick quality levels for image models
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

// Quality level options
const QUALITIES = [
  { id: "low", name: "Low", description: "Lower quality, faster generation" },
  {
    id: "medium",
    name: "Medium",
    description: "Balanced quality and speed",
  },
  {
    id: "high",
    name: "High",
    description: "Highest quality, slower generation",
  },
] as const;

export interface QualityPickerProps extends PopoverProps {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function QualityPicker({
  selectedIds,
  onSelect,
  multiSelect = true,
  placeholder = "Select qualities...",
  hideSelectedChips = true,
  buttonClassName,
  disabled = false,
  ...props
}: QualityPickerProps) {
  const [open, setOpen] = React.useState(false);

  const validIds = QUALITIES.map((q) => q.id);
  const mapping = Object.fromEntries(
    QUALITIES.map((q) => [q.id, { name: q.name, description: q.description }])
  );

  const qualities = React.useMemo(() => {
    return validIds
      .map((id) => {
        const item = mapping[id];
        if (!item) return null;
        return {
          id,
          ...item,
        };
      })
      .filter((q) => q !== null);
  }, [validIds, mapping]);

  const [peekedQuality, setPeekedQuality] = React.useState<
    { id: string; name: string; description: string } | undefined
  >(qualities[0] || undefined);

  const handleSelect = (qualityId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(qualityId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== qualityId)
        : [...selectedIds, qualityId];
      onSelect(newIds);
    } else {
      onSelect([qualityId]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  const handleRemoveItem = (qualityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== qualityId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const quality = mapping[selectedIds[0]!];
      return quality?.name || placeholder;
    }
    return `${selectedIds.length} qualities selected`;
  };

  return (
    <div>
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const quality = mapping[id];
            if (!quality) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{quality.name}</span>
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
            aria-label="Select qualities"
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
                  {peekedQuality?.name || "No quality selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedQuality?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search qualities..." />
                <CommandEmpty>No qualities found.</CommandEmpty>
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
                <CommandGroup heading="Qualities">
                  {qualities.map((quality) => (
                    <QualityItem
                      key={quality.id}
                      quality={quality}
                      isSelected={selectedIds.includes(quality.id)}
                      onPeek={(quality) => setPeekedQuality(quality)}
                      onSelect={() => handleSelect(quality.id)}
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

interface QualityItemProps {
  quality: { id: string; name: string; description: string };
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (quality: { id: string; name: string; description: string }) => void;
}

function QualityItem({
  quality,
  isSelected,
  onSelect,
  onPeek,
}: QualityItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(quality);
      }
    });
  });

  return (
    <CommandItem
      key={quality.id}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{quality.name}</div>
            {quality.description && (
              <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                {quality.description}
              </div>
            )}
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
            isSelected ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </CommandItem>
  );
}

