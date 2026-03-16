"use client";

import { Column } from "@tanstack/react-table";
import { Check, PlusCircle } from "lucide-react";
import * as React from "react";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue> | undefined;
  title?: string | undefined;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    count?: number;
  }[];
  isServerDriven?: boolean | undefined;
  onSearchChange?: ((term: string) => void) | undefined;
  searchValue?: string | undefined;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  isServerDriven = false,
  onSearchChange,
  searchValue,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const isMobile = useIsMobile();

  // Hide faceted filters on mobile
  if (isMobile) {
    return null;
  }

  // Early return if column doesn't exist
  if (!column) {
    return null;
  }

  // Get faceted values with defensive check (only needed for client-side counting)
  const facets = !isServerDriven ? column?.getFacetedUniqueValues?.() : null;

  const filterValue = column?.getFilterValue?.();
  const selectedValues = new Set(Array.isArray(filterValue) ? filterValue : []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-dashed"
        >
          <PlusCircle />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
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
      <PopoverContent
        className="w-[280px] max-h-[320px] overflow-y-auto p-0"
        align="start"
      >
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={title}
            {...(onSearchChange
              ? {
                  value: searchValue ?? "",
                  onValueChange: onSearchChange,
                }
              : {})}
          />
          <CommandList className="max-h-[280px] overflow-y-auto">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value);
                      } else {
                        selectedValues.add(option.value);
                      }
                      const filterValues = Array.from(selectedValues);
                      column.setFilterValue(
                        filterValues.length ? filterValues : undefined,
                      );
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check />
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span
                      className="truncate max-w-[200px]"
                      title={option.label}
                    >
                      {option.label}
                    </span>
                    {(() => {
                      // Use server-provided count if available, otherwise calculate from facets
                      if (isServerDriven && option.count !== undefined) {
                        return option.count > 0 ? (
                          <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                            {option.count}
                          </span>
                        ) : null;
                      }
                      if (!facets) return null;
                      let cnt = 0;
                      // facets is Map<any, number>
                      facets.forEach((n, k) => {
                        if (Array.isArray(k)) {
                          if (k.includes(option.value)) cnt += n; // row counted if it has this scenario
                        } else if (k === option.value) {
                          cnt += n;
                        }
                      });
                      return cnt > 0 ? (
                        <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                          {cnt}
                        </span>
                      ) : null;
                    })()}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column.setFilterValue(undefined)}
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
}
