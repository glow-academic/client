/**
 * ScenarioFormSelector.tsx
 * Used to select a certain item as part of the scenario form
 * Refactored to use mapping-based API pattern
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";
import { ModelType } from "@/utils/scenario-helpers";

type MappingItem = {
  name: string;
  description: string;
};

// Extended mapping item for scenarios/models with type grouping
export interface ScenarioModelMappingItem extends MappingItem {
  type: ModelType;
  strengths?: string;
}

export interface ScenarioFormSelectorProps<
  T extends ScenarioModelMappingItem = ScenarioModelMappingItem,
> extends PopoverProps {
  types: readonly ModelType[];
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  disabled?: boolean;
}

export function ScenarioFormSelector<
  T extends ScenarioModelMappingItem = ScenarioModelMappingItem,
>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  types,
  multiSelect = false,
  label = "Model",
  placeholder = "Select a model...",
  description = "The model which will generate the completion. Some models are suitable for natural language tasks, others specialize in code. Learn more.",
  hideSelectedChips = false,
  disabled = false,
  ...props
}: ScenarioFormSelectorProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build models from mapping
  const models = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  const [peekedModel, setPeekedModel] = React.useState<
    ({ id: string } & T) | undefined
  >(models[0] as ({ id: string } & T) | undefined);

  // Generate search placeholder based on types
  const getSearchPlaceholder = () => {
    if (types.length === 1) {
      return `Search ${types[0]?.toLowerCase()}...`;
    }
    if (types.length === 2) {
      return `Search ${types[0]?.toLowerCase()} & ${types[1]?.toLowerCase()}...`;
    }
    const lastType = types[types.length - 1];
    const otherTypes = types.slice(0, -1);
    return `Search ${otherTypes.map((t) => t.toLowerCase()).join(", ")} & ${lastType?.toLowerCase()}...`;
  };

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

  // Remove individual item in multi-select mode
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
    return `${selectedIds.length} selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  return (
    <div className="grid gap-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <Label htmlFor="model">{label}</Label>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {description}
        </HoverCardContent>
      </HoverCard>

      {/* Show selected items in multi-select mode */}
      {multiSelect && selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const model = mapping[id];
            if (!model) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{model.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
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
            aria-label="Select a model"
            className="w-full justify-between"
            disabled={disabled}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[250px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[280px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedModel?.name || "No model selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedModel?.description || "No description available"}
                </div>
                {peekedModel?.strengths ? (
                  <div className="mt-4 grid gap-2">
                    <h5 className="text-sm font-medium leading-none">
                      Strengths
                    </h5>
                    <ul className="text-sm text-muted-foreground">
                      {peekedModel.strengths}
                    </ul>
                  </div>
                ) : null}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder={getSearchPlaceholder()} />
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
                {types.map((type) => (
                  <CommandGroup key={type} heading={type}>
                    {models
                      .filter((model) => model.type === type)
                      .map((model) => (
                        <ModelItem
                          key={model.id}
                          model={model as { id: string } & T}
                          isSelected={selectedIds.includes(model.id)}
                          onPeek={(m) => setPeekedModel(m)}
                          onSelect={() => handleSelect(model.id)}
                        />
                      ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ModelItemProps<T extends ScenarioModelMappingItem> {
  model: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (model: { id: string } & T) => void;
}

function ModelItem<T extends ScenarioModelMappingItem>({
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
      {model.name}
      <Check
        className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
      />
    </CommandItem>
  );
}
