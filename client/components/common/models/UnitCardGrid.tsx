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

export interface Unit {
  id: string;
  name: string;
  unit_category: string;
  value: number;
}

export interface UnitCardGridProps {
  units: Unit[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function UnitCardGrid({
  units,
  selectedIds,
  onSelect,
  label = "Units",
  description = "Select units",
  readonly = false,
}: UnitCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Apply search filter, then sort selected first
  const filteredUnits = React.useMemo(() => {
    let filtered = units;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (unit) =>
          unit.name?.toLowerCase().includes(searchLower) ||
          unit.unit_category?.toLowerCase().includes(searchLower) ||
          unit.id?.toLowerCase().includes(searchLower) ||
          unit.value.toString().includes(searchTerm)
      );
    }

    // Sort: selected units first, then unselected by category and value
    return filtered.sort((a, b) => {
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      // Then sort by category, then value
      const categoryCompare = (a.unit_category || "").localeCompare(
        b.unit_category || ""
      );
      if (categoryCompare !== 0) return categoryCompare;
      return a.value - b.value;
    });
  }, [units, searchTerm, selectedIds]);

  const handleSelect = (unitId: string) => {
    if (readonly) return;
    const isSelected = selectedIds.includes(unitId);
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== unitId)
      : [...selectedIds, unitId];
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
          {filteredUnits.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No units found. Try adjusting your search.
            </div>
          ) : (
            filteredUnits.map((unit) => {
              const isSelected = selectedIds.includes(unit.id);

              return (
                <Tooltip key={unit.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(unit.id)}
                      disabled={readonly}
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary bg-accent"
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
                          {unit.name || "Unnamed Unit"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {unit.unit_category.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            •
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {unit.value.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {unit.name} ({unit.unit_category.toUpperCase()}) - Value:{" "}
                      {unit.value.toLocaleString()}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

