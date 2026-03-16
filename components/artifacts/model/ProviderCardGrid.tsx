"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProviderCardGridProps {
  providerMapping: Record<string, { name: string; description?: string }>;
  validProviderIds: string[];
  selectedProviderId: string | null;
  onSelect: (providerId: string | null) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function ProviderCardGrid({
  providerMapping,
  validProviderIds,
  selectedProviderId,
  onSelect,
  label = "Providers",
  readonly = false,
}: ProviderCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build providers from mapping
  const baseProviders = React.useMemo(() => {
    const providers = validProviderIds.map((id) => ({
      id,
      ...providerMapping[id],
    }));

    // Sort by name
    return providers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [validProviderIds, providerMapping]);

  // Apply search filter
  const filteredProviders = React.useMemo(() => {
    let filtered = baseProviders;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (provider) =>
          provider.name?.toLowerCase().includes(searchLower) ||
          provider.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected provider first, then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedProviderId === a.id;
      const bSelected = selectedProviderId === b.id;
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseProviders, searchTerm, selectedProviderId]);

  const handleSelect = (providerId: string) => {
    if (readonly) return;
    // Toggle: if already selected, unselect (set to null)
    const newId = selectedProviderId === providerId ? null : providerId;
    onSelect(newId);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder={`Search ${label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredProviders.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No providers found. Try adjusting your search.
            </div>
          ) : (
            filteredProviders.map((provider) => {
              const isSelected = selectedProviderId === provider.id;

              return (
                <Tooltip key={provider.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(provider.id)}
                      disabled={readonly}
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary bg-accent",
                      )}
                    >
                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight">
                          {provider.name || "Unnamed Provider"}
                        </h3>
                        {provider.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {provider.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </TooltipTrigger>
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
