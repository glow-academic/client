/**
 * SelectableGrid.tsx
 * Generic grid of selectable cards with function-based rendering
 */
"use client";

import { cn } from "@/lib/utils";

export interface SelectableGridProps<T> {
  items: T[];
  selectedId: string | null; // For single-select
  selectedIds?: string[]; // For multi-select
  onSelect: (id: string) => void;
  getId: (item: T) => string;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
  disabled?: boolean;
}

export function SelectableGrid<T>({
  items,
  selectedId,
  selectedIds,
  onSelect,
  getId,
  renderItem,
  emptyMessage = "No items found.",
  maxHeight = "max-h-[272px]",
  className,
  disabled = false,
}: SelectableGridProps<T>) {
  const handleSelect = (item: T) => {
    if (disabled) return;
    const id = getId(item);
    onSelect(id);
  };

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto py-2 px-2",
        maxHeight,
        className,
      )}
    >
      {items.length === 0 ? (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        items.map((item) => {
          const id = getId(item);
          const isSelected =
            selectedId === id || (selectedIds && selectedIds.includes(id));

          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(item)}
              disabled={disabled}
              className={cn(
                "relative w-full text-left",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              {renderItem(item, isSelected)}
            </button>
          );
        })
      )}
    </div>
  );
}

