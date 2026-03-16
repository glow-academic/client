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
  horizontal?: boolean; // Enable horizontal scrolling with 5 items visible
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
  horizontal = false,
}: SelectableGridProps<T>) {
  const handleSelect = (item: T) => {
    if (disabled) return;
    const id = getId(item);
    onSelect(id);
  };
  const idCounts = new Map<string, number>();
  for (const item of items) {
    const id = getId(item);
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  if (horizontal) {
    return (
      <div
        className={cn(
          "flex gap-3 overflow-x-auto py-2 pb-3 px-2 w-0 min-w-full",
          className
        )}
      >
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground w-full">
            {emptyMessage}
          </div>
        ) : (
          items.map((item, index) => {
            const id = getId(item);
            const isSelected =
              selectedId === id || (selectedIds?.includes(id) ?? false);
            const key = (idCounts.get(id) ?? 0) > 1 ? `${id}-${index}` : id;

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelect(item)}
                disabled={disabled ?? false}
                className={cn(
                  "relative text-left flex-shrink-0 w-[200px]",
                  disabled && "pointer-events-none opacity-50"
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

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto py-2 px-2",
        maxHeight,
        className
      )}
    >
      {items.length === 0 ? (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        items.map((item, index) => {
          const id = getId(item);
          const isSelected =
            selectedId === id || (selectedIds?.includes(id) ?? false);
          const key = (idCounts.get(id) ?? 0) > 1 ? `${id}-${index}` : id;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(item)}
              disabled={disabled ?? false}
              className={cn(
                "relative text-left w-full",
                disabled && "pointer-events-none opacity-50"
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
