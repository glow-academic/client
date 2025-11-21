/**
 * ProviderPicker.tsx
 * Used to pick providers for model assignment
 * Follows DepartmentPicker/RubricPicker pattern with mapping-based API
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
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

type TriggerButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "data-testid"
> & {
  "data-testid"?: string;
};

export interface ProviderPickerProps<T extends MappingItem = MappingItem>
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
  triggerProps?: TriggerButtonProps;
}

export function ProviderPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  multiSelect = false,
  placeholder = "Select provider...",
  hideSelectedChips = true,
  buttonClassName,
  disabled = false,
  triggerProps,
  ...props
}: ProviderPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build providers from mapping
  const providers = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    })) as ({ id: string } & T)[];
  }, [validIds, mapping]);

  const [peekedProvider, setPeekedProvider] = React.useState<
    ({ id: string } & T) | undefined
  >(providers[0]);

  const handleSelect = (providerId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(providerId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== providerId)
        : [...selectedIds, providerId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([providerId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (providerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== providerId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const provider = mapping[selectedIds[0]!];
      return provider?.name || placeholder;
    }
    return `${selectedIds.length} providers selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No providers found.`;
  };

  const { className: triggerClassName, ...restTriggerProps } =
    triggerProps ?? {};

  const buttonClasses = cn(
    "w-full justify-between",
    buttonClassName,
    triggerClassName,
  );

  return (
    <div>
      {/* Show selected items */}
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const provider = mapping[id];
            if (!provider) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{provider.name}</span>
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
            aria-label="Select provider"
            className={buttonClasses}
            disabled={disabled}
            {...restTriggerProps}
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
                  {peekedProvider?.name || "No provider selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedProvider?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search providers..." />
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
                <CommandGroup heading="Providers">
                  {providers.map((provider) => (
                    <ProviderItem
                      key={provider.id}
                      provider={provider}
                      isSelected={selectedIds.includes(provider.id)}
                      onPeek={(provider) => setPeekedProvider(provider)}
                      onSelect={() => handleSelect(provider.id)}
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

interface ProviderItemProps<T extends MappingItem> {
  provider: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (provider: { id: string } & T) => void;
}

function ProviderItem<T extends MappingItem>({
  provider,
  isSelected,
  onSelect,
  onPeek,
}: ProviderItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(provider);
      }
    });
  });

  return (
    <CommandItem
      key={provider.id}
      onSelect={onSelect}
      ref={ref}
      data-testid="provider-option"
      data-provider-id={provider.id}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{provider.name}</div>
            {provider.description && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {provider.description}
              </div>
            )}
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </CommandItem>
  );
}

