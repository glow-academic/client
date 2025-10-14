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
import type { ProviderWithModels } from "@/lib/api/v2/schemas/providers";

export interface ProvidersDataTableProps {
  providers: ProviderWithModels[];
  renderProviderGroup: (provider: ProviderWithModels) => React.ReactNode;
}

export function ProvidersDataTable({
  providers,
  renderProviderGroup,
}: ProvidersDataTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedProviderIds, setSelectedProviderIds] = React.useState<
    string[]
  >([]);
  const [selectedCustomFilter, setSelectedCustomFilter] = React.useState<
    string[]
  >([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<
    string[]
  >([]);

  // Build filter options from providers data
  const providerOptions = React.useMemo(
    () => providers.map((p) => ({ value: p.provider_id, label: p.name })),
    [providers]
  );

  const customModelOptions = [
    { value: "Custom", label: "Custom Models" },
    { value: "Standard", label: "Standard Models" },
  ];

  const statusOptions = [
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
  ];

  // Filter providers and models
  const filteredProviders = React.useMemo(() => {
    return (
      providers
        .map((provider) => {
          // Filter models within each provider
          const filteredModels = provider.models.filter((model) => {
            // Search filter
            if (searchQuery) {
              const query = searchQuery.toLowerCase();
              const matchesName = model.name.toLowerCase().includes(query);
              const matchesDesc = model.description
                .toLowerCase()
                .includes(query);
              if (!matchesName && !matchesDesc) return false;
            }

            // Custom model filter
            if (selectedCustomFilter.length > 0) {
              const isCustom = model.custom_model ? "Custom" : "Standard";
              if (!selectedCustomFilter.includes(isCustom)) return false;
            }

            // Status filter
            if (selectedStatusFilter.length > 0) {
              const status = model.active ? "Active" : "Inactive";
              if (!selectedStatusFilter.includes(status)) return false;
            }

            return true;
          });

          return { ...provider, models: filteredModels };
        })
        // Filter out providers with no matching models (unless provider filter is active)
        .filter((provider) => {
          // Provider filter
          if (selectedProviderIds.length > 0) {
            if (!selectedProviderIds.includes(provider.provider_id))
              return false;
          }
          // Keep providers with matching models or if explicitly selected
          return (
            provider.models.length > 0 ||
            selectedProviderIds.includes(provider.provider_id)
          );
        })
    );
  }, [
    providers,
    searchQuery,
    selectedProviderIds,
    selectedCustomFilter,
    selectedStatusFilter,
  ]);

  return (
    <div className="space-y-4">
      {/* Filters toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <Input
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-[200px]"
        />

        {/* Provider filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Provider{" "}
              {selectedProviderIds.length > 0 &&
                `(${selectedProviderIds.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search providers..." />
              <CommandEmpty>No providers found.</CommandEmpty>
              <CommandList>
                {providerOptions.map((p) => {
                  const checked = selectedProviderIds.includes(p.value);
                  return (
                    <CommandItem
                      key={p.value}
                      onSelect={() => {
                        const next = new Set(selectedProviderIds);
                        if (checked) next.delete(p.value);
                        else next.add(p.value);
                        setSelectedProviderIds(Array.from(next));
                      }}
                    >
                      <Checkbox checked={checked} className="mr-2" />
                      <span className="truncate">{p.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Custom Model filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Type{" "}
              {selectedCustomFilter.length > 0 &&
                `(${selectedCustomFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Filter by type..." />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandList>
                {customModelOptions.map((opt) => {
                  const checked = selectedCustomFilter.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => {
                        const next = new Set(selectedCustomFilter);
                        if (checked) next.delete(opt.value);
                        else next.add(opt.value);
                        setSelectedCustomFilter(Array.from(next));
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
          selectedProviderIds.length > 0 ||
          selectedCustomFilter.length > 0 ||
          selectedStatusFilter.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedProviderIds([]);
              setSelectedCustomFilter([]);
              setSelectedStatusFilter([]);
            }}
          >
            Reset filters
          </Button>
        )}
      </div>

      {/* Provider groups */}
      {filteredProviders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No models match the current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProviders.map((provider) => renderProviderGroup(provider))}
        </div>
      )}
    </div>
  );
}
