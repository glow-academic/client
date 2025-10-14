"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ParameterItem } from "@/lib/api/v2/schemas/parameters";

export interface ParametersDataTableProps {
  parameters: ParameterItem[];
  renderParameterCard: (parameter: ParameterItem) => React.ReactNode;
}

export function ParametersDataTable({
  parameters,
  renderParameterCard,
}: ParametersDataTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<string[]>(
    []
  );
  const [selectedItemCountFilter, setSelectedItemCountFilter] = React.useState<
    string[]
  >([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<
    string[]
  >([]);

  // Filter options (static)
  const typeOptions = [
    { value: "numerical", label: "Numerical" },
    { value: "text", label: "Text" },
  ];

  const itemCountOptions = [
    { value: "0", label: "0 items" },
    { value: "1-3", label: "1-3 items" },
    { value: "4-6", label: "4-6 items" },
    { value: "7+", label: "7+ items" },
  ];

  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  // Filter parameters
  const filteredParameters = React.useMemo(() => {
    return parameters.filter((parameter) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = parameter.name.toLowerCase().includes(query);
        const matchesDesc = parameter.description.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      // Type filter
      if (selectedTypeFilter.length > 0) {
        const type = parameter.numerical ? "numerical" : "text";
        if (!selectedTypeFilter.includes(type)) return false;
      }

      // Item count filter
      if (selectedItemCountFilter.length > 0) {
        const count = parameter.num_items;
        let range = "0";
        if (count === 0) range = "0";
        else if (count <= 3) range = "1-3";
        else if (count <= 6) range = "4-6";
        else range = "7+";

        if (!selectedItemCountFilter.includes(range)) return false;
      }

      // Status filter
      if (selectedStatusFilter.length > 0) {
        const status = parameter.active ? "active" : "inactive";
        if (!selectedStatusFilter.includes(status)) return false;
      }

      return true;
    });
  }, [
    parameters,
    searchQuery,
    selectedTypeFilter,
    selectedItemCountFilter,
    selectedStatusFilter,
  ]);

  return (
    <div className="space-y-4">
      {/* Filters toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <Input
          placeholder="Search parameters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-[200px]"
        />

        {/* Type filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Type{" "}
              {selectedTypeFilter.length > 0 &&
                `(${selectedTypeFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Filter by type..." />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandList>
                {typeOptions.map((opt) => {
                  const checked = selectedTypeFilter.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => {
                        const next = new Set(selectedTypeFilter);
                        if (checked) next.delete(opt.value);
                        else next.add(opt.value);
                        setSelectedTypeFilter(Array.from(next));
                      }}
                    >
                      <Checkbox checked={checked} className="mr-2" />
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Item count filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Items{" "}
              {selectedItemCountFilter.length > 0 &&
                `(${selectedItemCountFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Filter by item count..." />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandList>
                {itemCountOptions.map((opt) => {
                  const checked = selectedItemCountFilter.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => {
                        const next = new Set(selectedItemCountFilter);
                        if (checked) next.delete(opt.value);
                        else next.add(opt.value);
                        setSelectedItemCountFilter(Array.from(next));
                      }}
                    >
                      <Checkbox checked={checked} className="mr-2" />
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Status filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Status{" "}
              {selectedStatusFilter.length > 0 &&
                `(${selectedStatusFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Filter by status..." />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandList>
                {statusOptions.map((opt) => {
                  const checked = selectedStatusFilter.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => {
                        const next = new Set(selectedStatusFilter);
                        if (checked) next.delete(opt.value);
                        else next.add(opt.value);
                        setSelectedStatusFilter(Array.from(next));
                      }}
                    >
                      <Checkbox checked={checked} className="mr-2" />
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Reset button */}
        {(searchQuery ||
          selectedTypeFilter.length > 0 ||
          selectedItemCountFilter.length > 0 ||
          selectedStatusFilter.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedTypeFilter([]);
              setSelectedItemCountFilter([]);
              setSelectedStatusFilter([]);
            }}
          >
            Reset filters
          </Button>
        )}
      </div>

      {/* Parameters grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredParameters.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No parameters match the current filters.
          </div>
        ) : (
          filteredParameters.map((parameter) => renderParameterCard(parameter))
        )}
      </div>
    </div>
  );
}
