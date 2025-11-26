/**
 * GenericPicker.tsx
 * Generic picker component that matches SimulationPicker/RubricPicker style
 * Used for picking items with name and description
 * @AshokSaravanan222 & @siladiea
 * 01/26/2025
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

type MappingItem = {
  name: string;
  description: string;
};

export interface GenericPickerProps<T extends MappingItem = MappingItem>
  extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  buttonClassName?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  groupHeading?: string;
}

export function GenericPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedId,
  onSelect,
  placeholder = "Select item...",
  buttonClassName,
  disabled = false,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  groupHeading = "Items",
  ...props
}: GenericPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build items from mapping
  const items = React.useMemo(() => {
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

  const [peekedItem, setPeekedItem] = React.useState<
    ({ id: string } & T) | undefined
  >(items[0]);

  const handleSelect = (itemId: string) => {
    onSelect(itemId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedId) {
      return placeholder;
    }
    const item = mapping[selectedId];
    return item?.name || placeholder;
  };

  return (
    <div>
      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
        {...props}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select item"
            className={cn("w-48 justify-between", buttonClassName)}
            size="sm"
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
                  {peekedItem?.name || "No item selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedItem?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder={searchPlaceholder} />
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <HoverCardTrigger />
                <CommandGroup heading={groupHeading}>
                  {items.map((item) => (
                    <GenericItem
                      key={item.id}
                      item={item}
                      isSelected={selectedId === item.id}
                      onPeek={(item) => setPeekedItem(item)}
                      onSelect={() => handleSelect(item.id)}
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

interface GenericItemProps<T extends MappingItem> {
  item: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (item: { id: string } & T) => void;
}

function GenericItem<T extends MappingItem>({
  item,
  isSelected,
  onSelect,
  onPeek,
}: GenericItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(item);
      }
    });
  });

  return (
    <CommandItem
      key={item.id}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{item.name}</div>
            {item.description && (
              <div className="text-xs mt-1 truncate text-muted-foreground group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                {item.description}
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
