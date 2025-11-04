/**
 * ModelPicker.tsx
 * Used to pick models with hover card descriptions
 * Follows DepartmentPicker pattern with mapping-based API
 * @AshokSaravanan222 & @siladiea
 * 01/19/2025
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

type MappingItem = {
  name: string;
  description: string;
};

export interface ModelPickerProps<T extends MappingItem = MappingItem>
  extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function ModelPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  multiSelect = false,
  placeholder = "Select model...",
  hideSelectedChips = true,
  buttonClassName,
  disabled = false,
  ...props
}: ModelPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build models from mapping
  const models = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    })) as ({ id: string } & T)[];
  }, [validIds, mapping]);

  const [peekedModel, setPeekedModel] = React.useState<
    ({ id: string } & T) | undefined
  >(models[0]);

  const handleSelect = (modelId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(modelId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== modelId)
        : [...selectedIds, modelId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([modelId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== modelId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const model = mapping[selectedIds[0]!];
      return model?.name || placeholder;
    }
    return `${selectedIds.length} models selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No models found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const model = mapping[id];
            if (!model) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{model.name}</span>
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
            aria-label="Select model"
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
                  {peekedModel?.name || "No model selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedModel?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search models..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
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
                <CommandGroup heading="Models">
                  {models.map((model) => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      isSelected={selectedIds.includes(model.id)}
                      onPeek={(model) => setPeekedModel(model)}
                      onSelect={() => handleSelect(model.id)}
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

interface ModelItemProps<T extends MappingItem> {
  model: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (model: { id: string } & T) => void;
}

function ModelItem<T extends MappingItem>({
  model,
  isSelected,
  onSelect,
  onPeek,
}: ModelItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(model);
      }
    });
  });

  return (
    <CommandItem
      key={model.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{model.name}</div>
            {model.description && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {model.description}
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
