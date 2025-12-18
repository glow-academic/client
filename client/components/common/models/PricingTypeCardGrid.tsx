"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PricingType {
  id: string;
  name: string;
  description: string;
}

const PRICING_TYPES: PricingType[] = [
  {
    id: "input",
    name: "Input",
    description: "Pricing for input tokens",
  },
  {
    id: "output",
    name: "Output",
    description: "Pricing for output tokens",
  },
  {
    id: "cached",
    name: "Cached",
    description: "Pricing for cached tokens",
  },
];

export interface PricingTypeCardGridProps {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function PricingTypeCardGrid({
  selectedIds,
  onSelect,
  label = "Pricing Types",
  readonly = false,
}: PricingTypeCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Apply search filter, then sort selected first
  const filteredPricingTypes = React.useMemo(() => {
    let filtered = PRICING_TYPES;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (type) =>
          type.name?.toLowerCase().includes(searchLower) ||
          type.description?.toLowerCase().includes(searchLower) ||
          type.id?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected types first, then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [searchTerm, selectedIds]);

  const handleSelect = (typeId: string) => {
    if (readonly) return;
    const isSelected = selectedIds.includes(typeId);
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== typeId)
      : [...selectedIds, typeId];
    onSelect(newIds);
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
          {filteredPricingTypes.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No pricing types found. Try adjusting your search.
            </div>
          ) : (
            filteredPricingTypes.map((type) => {
              const isSelected = selectedIds.includes(type.id);

              return (
                <Tooltip key={type.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(type.id)}
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
                          {type.name || "Unnamed Type"}
                        </h3>
                        {type.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {type.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </TooltipTrigger>
                  {type.description && (
                    <TooltipContent>
                      <p>{type.description}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
