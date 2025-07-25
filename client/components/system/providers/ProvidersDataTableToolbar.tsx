"use client";

import { Check, PlusCircle, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface ProvidersDataTableToolbarProps {
  searchTerm: string;
  selectedProviders: string[];
  selectedModelTypes: string[];
  selectedStatuses: string[];
  providerOptions: { value: string; label: string }[];
  customModelOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  onSearchChange: (value: string) => void;
  onProviderFilterChange: (values: string[]) => void;
  onModelTypeFilterChange: (values: string[]) => void;
  onStatusFilterChange: (values: string[]) => void;
  onResetFilters: () => void;
}

export function ProvidersDataTableToolbar({
  searchTerm,
  selectedProviders,
  selectedModelTypes,
  selectedStatuses,
  providerOptions,
  customModelOptions,
  statusOptions,
  onSearchChange,
  onProviderFilterChange,
  onModelTypeFilterChange,
  onStatusFilterChange,
  onResetFilters,
}: ProvidersDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered =
    searchTerm ||
    selectedProviders.length > 0 ||
    selectedModelTypes.length > 0 ||
    selectedStatuses.length > 0;

  const FilterPopover = ({
    title,
    options,
    selectedValues,
    onValueChange,
  }: {
    title: string;
    options: { value: string; label: string }[];
    selectedValues: string[];
    onValueChange: (values: string[]) => void;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="h-4 w-4" />
          {title}
          {selectedValues.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.length}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.length > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.includes(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        onValueChange(
                          selectedValues.filter((v) => v !== option.value)
                        );
                      } else {
                        onValueChange([...selectedValues, option.value]);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onValueChange([])}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search models..."
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Provider Filter */}
          {providerOptions.length > 0 && (
            <FilterPopover
              title="Provider"
              options={providerOptions}
              selectedValues={selectedProviders}
              onValueChange={onProviderFilterChange}
            />
          )}

          {/* Custom Model Filter */}
          {customModelOptions.length > 0 && (
            <FilterPopover
              title="Model Type"
              options={customModelOptions}
              selectedValues={selectedModelTypes}
              onValueChange={onModelTypeFilterChange}
            />
          )}

          {/* Status Filter */}
          {statusOptions.length > 0 && (
            <FilterPopover
              title="Status"
              options={statusOptions}
              selectedValues={selectedStatuses}
              onValueChange={onStatusFilterChange}
            />
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={onResetFilters}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
