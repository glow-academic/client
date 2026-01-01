/**
 * ReorderableList.tsx
 * Drag-and-drop list with autocomplete suggestions
 */
"use client";

import { GripVertical, PlusCircle, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ReorderableListProps<T extends string = string> {
  items: T[];
  onItemsChange: (items: T[]) => void;
  renderItem?: (item: T, index: number, handlers: {
    onDragStart: (e: React.DragEvent) => void;
    onRemove: () => void;
  }) => React.ReactNode;
  suggestions?: string[];
  maxItems?: number;
  addButtonLabel?: string;
  disabled?: boolean;
  itemPlaceholder?: string;
}

// Component for item input with autocomplete
function ItemInputWithAutocomplete({
  index,
  value,
  onChange,
  placeholder,
  suggestions,
  disabled,
  draggedIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  totalItems,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  disabled: boolean;
  draggedIndex: number | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  totalItems: number;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on current input value
  const filteredSuggestions = useMemo(() => {
    if (!value.trim() || !suggestions.length) return [];

    const valueLower = value.toLowerCase().trim();

    // Filter suggestions that start with or contain the typed text
    // Exclude exact matches (case-insensitive) to avoid distraction
    const matching = suggestions
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        // Skip exact matches
        if (sLower === valueLower) return false;
        // Include if starts with or contains the typed text
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5); // Show top 5 matches

    return matching;
  }, [suggestions, value]);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        draggedIndex === index && "opacity-50",
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2">
        <div
          draggable={!disabled}
          onDragStart={onDragStart}
          className="cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1"
            disabled={disabled}
            onDragStart={(e) => e.preventDefault()} // Prevent dragging from input
          />
          {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
              <div className="p-1">
                {filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(suggestion)}
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {totalItems > 1 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ReorderableList<T extends string>({
  items,
  onItemsChange,
  renderItem,
  suggestions = [],
  maxItems = 10,
  addButtonLabel = "Add item",
  disabled = false,
  itemPlaceholder = "Item",
}: ReorderableListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addItem = () => {
    if (items.length >= maxItems) {
      return;
    }
    onItemsChange([...items, "" as T]);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value as T;
    onItemsChange(newItems);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed || ("" as T));
    onItemsChange(newItems);
    setDraggedIndex(null);
  };

  // If renderItem is not provided, use default string rendering
  const defaultRenderItem = (item: T, index: number) => (
    <ItemInputWithAutocomplete
      key={`item-${index}`}
      index={index}
      value={item || ""}
      onChange={(value) => updateItem(index, value)}
      placeholder={`${itemPlaceholder} ${index + 1}`}
      suggestions={suggestions}
      disabled={disabled}
      draggedIndex={draggedIndex}
      onDragStart={(e) => handleDragStart(e, index)}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, index)}
      onRemove={() => removeItem(index)}
      totalItems={items.length}
    />
  );

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={addItem}
            disabled={disabled}
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> {addButtonLabel}
          </Button>
        </div>
      )}
      {items.map((item, index) =>
        renderItem
          ? renderItem(
              item,
              index,
              {
                onDragStart: (e) => handleDragStart(e, index),
                onRemove: () => removeItem(index),
              }
            )
          : defaultRenderItem(item, index)
      )}

      {items.length < maxItems && items.length > 0 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={addItem}
            disabled={disabled}
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> {addButtonLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

