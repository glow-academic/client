/**
 * SimulationPicker.tsx
 * Used to pick a certain item as part of the simulation
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
import { Model, ModelType } from "@/utils/scenario";

export interface ScenarioPickerProps extends PopoverProps {
  types: readonly ModelType[];
  models: Model[];
  label?: string;
  placeholder?: string;
  description?: string;
  onSelect?: (model: Model) => void;
  selectedModel?: Model | undefined;
  selectedModels?: Model[]; // For multiple selection
  multiSelect?: boolean; // Enable multiple selection mode
  onMultiSelect?: (models: Model[]) => void; // Callback for multiple selection
  hideSelectedChips?: boolean; // Hide the built-in selected chips display
}

export function ScenarioPicker({
  models,
  types,
  label = "Model",
  placeholder = "Select a model...",
  description = "The model which will generate the completion. Some models are suitable for natural language tasks, others specialize in code. Learn more.",
  onSelect,
  selectedModel: externalSelectedModel,
  selectedModels: externalSelectedModels = [],
  multiSelect = false,
  onMultiSelect,
  hideSelectedChips = false,
  ...props
}: ScenarioPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalSelectedModel, setInternalSelectedModel] = React.useState<
    Model | undefined
  >(undefined);
  const [internalSelectedModels, setInternalSelectedModels] = React.useState<
    Model[]
  >([]);
  const [peekedModel, setPeekedModel] = React.useState<Model | undefined>(
    models[0],
  );

  // Use external selectedModel if provided, otherwise use internal state
  const selectedModel = externalSelectedModel || internalSelectedModel;
  const selectedModels = multiSelect
    ? externalSelectedModels
    : internalSelectedModels;

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

  const handleSelect = (model: Model) => {
    if (multiSelect) {
      const isSelected = selectedModels.some((m) => m.id === model.id);
      let newSelectedModels: Model[];

      if (isSelected) {
        // Remove from selection
        newSelectedModels = selectedModels.filter((m) => m.id !== model.id);
      } else {
        // Add to selection
        newSelectedModels = [...selectedModels, model];
      }

      if (!externalSelectedModels.length) {
        setInternalSelectedModels(newSelectedModels);
      }
      onMultiSelect?.(newSelectedModels);
      // Don't close popover in multi-select mode
    } else {
      if (!externalSelectedModel) {
        setInternalSelectedModel(model);
      }
      onSelect?.(model);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    if (multiSelect) {
      if (!externalSelectedModels.length) {
        setInternalSelectedModels([]);
      }
      onMultiSelect?.([]);
    } else {
      if (!externalSelectedModel) {
        setInternalSelectedModel(undefined);
      }
      // Call onSelect with a special "clear" model to indicate clearing
      onSelect?.({ id: "", name: "", description: "", type: types[0]! });
    }
    setOpen(false);
  };

  // Remove individual item in multi-select mode
  const handleRemoveItem = (modelToRemove: Model, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiSelect) {
      const newSelectedModels = selectedModels.filter(
        (m) => m.id !== modelToRemove.id,
      );
      if (!externalSelectedModels.length) {
        setInternalSelectedModels(newSelectedModels);
      }
      onMultiSelect?.(newSelectedModels);
    }
  };

  const getButtonText = () => {
    if (multiSelect) {
      if (selectedModels.length === 0) {
        return placeholder;
      }
      if (selectedModels.length === 1) {
        return selectedModels[0]!.name;
      }
      return `${selectedModels.length} selected`;
    }
    return selectedModel ? selectedModel.name : placeholder;
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
      {multiSelect && selectedModels.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedModels.map((model) => (
            <div
              key={model.id}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{model.name}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveItem(model, e)}
                className="text-muted-foreground hover:text-destructive"
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
            aria-label="Select a model"
            className="w-full justify-between"
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
                {((multiSelect && selectedModels.length > 0) ||
                  (!multiSelect && selectedModel)) && (
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
                          model={model}
                          isSelected={
                            multiSelect
                              ? selectedModels.some((m) => m.id === model.id)
                              : selectedModel?.id === model.id
                          }
                          onPeek={(model) => setPeekedModel(model)}
                          onSelect={() => handleSelect(model)}
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

interface ModelItemProps {
  model: Model;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (model: Model) => void;
}

function ModelItem({ model, isSelected, onSelect, onPeek }: ModelItemProps) {
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
