/**
 * GenericPicker.tsx
 * Truly generic picker component that works with ANY data type
 * Uses function-based extraction to support any data structure
 * @AshokSaravanan222
 * 12/2025
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

export interface GenericPickerProps<T> extends PopoverProps {
  // Data: can be array or record
  items: T[] | Record<string, T>;
  itemIds?: string[]; // Required if items is Record<string, T>

  // Selection
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;

  // Extractors: functions to get what we need from ANY data type
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSearchText?: (item: T) => string; // Defaults to getLabel

  // Optional render functions for customization
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  renderPreview?: (item: T) => React.ReactNode; // Hover card content
  renderButton?: (selectedItems: T[]) => React.ReactNode; // Button content
  renderChip?: (item: T, onRemove: () => void) => React.ReactNode; // Multi-select chips

  // UI props
  placeholder?: string;
  disabled?: boolean;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  groupHeading?: string;
  showLabel?: boolean;
  label?: string;
  description?: string;
  compact?: boolean;
  showClearAction?: boolean;
  clearActionLabel?: string; // Custom label for clear action (e.g., "New Statement", "New Image")
  popoverContentClassName?: string;
  maxHeight?: string;
  /** Where to render the selected badges relative to the button */
  badgesPosition?: "above" | "below";
  /** Show a Clear All button when items are selected (only for multi-select) */
  showClearAll?: boolean;
}

export function GenericPicker<T>({
  items,
  itemIds,
  selectedIds,
  onSelect,
  multiSelect = false,
  getId,
  getLabel,
  getSearchText,
  renderItem,
  renderPreview,
  renderButton,
  renderChip,
  placeholder = "Select item...",
  disabled = false,
  hideSelectedChips = true,
  buttonClassName,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  groupHeading = "Items",
  showLabel = false,
  label,
  description,
  compact = false,
  showClearAction = true,
  clearActionLabel,
  popoverContentClassName,
  maxHeight = "max-h-[250px]",
  badgesPosition = "below",
  showClearAll = false,
  ...props
}: GenericPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Normalize items to array format with id attached
  // When items is Record<string, T>, we add id property from the key
  type ItemWithId = T & { id: string };

  const itemsArray = React.useMemo(() => {
    if (Array.isArray(items)) {
      // For arrays, items should already have id extractable via getId
      return items;
    }
    // For Record types, add id from the key
    if (itemIds) {
      return itemIds
        .map((id) => {
          const item = items[id];
          if (!item) return null;
          // Add id property for Record types
          return { ...item, id } as ItemWithId;
        })
        .filter((item): item is ItemWithId => item !== null);
    }
    return Object.entries(items).map(([id, item]) => ({
      ...item,
      id,
    })) as ItemWithId[];
  }, [items, itemIds]);

  // Get selected items
  const selectedItems = React.useMemo(() => {
    return selectedIds
      .map((id) => {
        if (Array.isArray(items)) {
          return items.find((item) => getId(item) === id);
        }
        return items[id];
      })
      .filter((item): item is T => item !== undefined);
  }, [selectedIds, items, getId]);

  const [peekedItem, setPeekedItem] = React.useState<T | undefined>(
    itemsArray[0],
  );

  const handleSelect = (itemId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(itemId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== itemId)
        : [...selectedIds, itemId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([itemId]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  const handleRemoveItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== itemId);
    onSelect(newIds);
  };

  // Default button text
  const getDefaultButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1 && selectedItems[0]) {
      return getLabel(selectedItems[0]);
    }
    return `${selectedIds.length} selected`;
  };

  // Default chip renderer
  const defaultRenderChip = (item: T, onRemove: () => void) => (
    <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full">
      <span className="truncate">{getLabel(item)}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-muted-foreground hover:text-destructive flex-shrink-0"
        disabled={disabled}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  // Default item renderer
  const defaultRenderItem = (item: T, isSelected: boolean) => {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{getLabel(item)}</div>
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    );
  };

  // Default preview renderer
  const defaultRenderPreview = (item: T) => (
    <div className="grid gap-2">
      <h4 className="font-medium leading-none">{getLabel(item)}</h4>
    </div>
  );

  const buttonClasses = cn(
    compact ? "h-8 justify-between" : "w-full justify-between",
    buttonClassName,
  );

  return (
    <div>
      {showLabel && label && (
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <label className="text-sm font-medium">{label}</label>
          </HoverCardTrigger>
          {description && (
            <HoverCardContent
              align="start"
              className="w-[260px] text-sm"
              side="left"
            >
              {description}
            </HoverCardContent>
          )}
        </HoverCard>
      )}

      {/* Show selected chips above button if configured */}
      {multiSelect &&
        selectedIds.length > 0 &&
        !hideSelectedChips &&
        badgesPosition === "above" && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedItems.map((item) => {
              const itemId = getId(item);
              const chipRenderer = renderChip || defaultRenderChip;
              return (
                <React.Fragment key={itemId}>
                  {chipRenderer(item, () =>
                    handleRemoveItem(itemId, {} as React.MouseEvent),
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

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
            className={buttonClasses}
            disabled={disabled}
          >
            {renderButton ? (
              renderButton(selectedItems)
            ) : (
              <span className="truncate text-left">
                {getDefaultButtonText()}
              </span>
            )}
            <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={cn("w-[300px] p-0", popoverContentClassName)}
        >
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              {peekedItem
                ? renderPreview
                  ? renderPreview(peekedItem)
                  : defaultRenderPreview(peekedItem)
                : "No item selected"}
            </HoverCardContent>
            <Command loop>
              <CommandList
                className={cn("h-[var(--cmdk-list-height)]", maxHeight)}
              >
                <CommandInput placeholder={searchPlaceholder} />
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <HoverCardTrigger />
                {selectedIds.length > 0 && showClearAction && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      {clearActionLabel ||
                        `Clear ${multiSelect ? "All" : "Selection"}`}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading={groupHeading}>
                  {itemsArray.map((item) => {
                    // For Record types, item has id property added during normalization
                    // For array types, getId extracts id from item structure
                    const itemId = Array.isArray(items)
                      ? getId(item)
                      : (item as ItemWithId).id;
                    const isSelected = selectedIds.includes(itemId);
                    const itemRenderer = renderItem || defaultRenderItem;
                    const searchText = getSearchText
                      ? getSearchText(item)
                      : getLabel(item);
                    return (
                      <PickerItem
                        key={itemId}
                        item={item}
                        isSelected={isSelected}
                        onSelect={() => handleSelect(itemId)}
                        onPeek={() => setPeekedItem(item)}
                        searchText={searchText}
                      >
                        {itemRenderer(item, isSelected)}
                      </PickerItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>

      {/* Show selected chips below button if configured */}
      {multiSelect &&
        selectedIds.length > 0 &&
        !hideSelectedChips &&
        !compact &&
        badgesPosition === "below" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 flex flex-wrap gap-1">
              {selectedItems.map((item) => {
                const itemId = getId(item);
                const chipRenderer = renderChip || defaultRenderChip;
                return (
                  <React.Fragment key={itemId}>
                    {chipRenderer(item, () =>
                      handleRemoveItem(itemId, {} as React.MouseEvent),
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {showClearAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onSelect([]);
                  if (!multiSelect) {
                    setOpen(false);
                  }
                }}
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

interface PickerItemProps<T> {
  item: T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: () => void;
  searchText: string;
  children: React.ReactNode;
}

function PickerItem<T>({
  item: _item,
  isSelected: _isSelected,
  onSelect,
  onPeek,
  searchText,
  children,
}: PickerItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek();
      }
    });
  });

  return (
    <CommandItem
      value={searchText}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      {children}
    </CommandItem>
  );
}
