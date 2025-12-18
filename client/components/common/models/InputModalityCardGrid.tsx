"use client";

import { MODALITIES } from "@/components/common/forms/modalities";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Search } from "lucide-react";
import * as React from "react";

export interface InputModalityCardGridProps {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  readonly?: boolean;
}

export function InputModalityCardGrid({
  selectedIds,
  onSelect,
  readonly = false,
}: InputModalityCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build modalities from MODALITIES array
  const baseModalities = React.useMemo(() => {
    return [...MODALITIES].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, []);

  // Apply search filter, then sort selected first
  const filteredModalities = React.useMemo(() => {
    let filtered = baseModalities;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (modality) =>
          modality.name?.toLowerCase().includes(searchLower) ||
          modality.id?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected modalities first, then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseModalities, searchTerm, selectedIds]);

  const handleSelect = (modalityId: string) => {
    if (readonly) return;
    const isSelected = selectedIds.includes(modalityId);
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== modalityId)
      : [...selectedIds, modalityId];
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
            placeholder="Search input modalities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredModalities.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No modalities found. Try adjusting your search.
            </div>
          ) : (
            filteredModalities.map((modality) => {
              const isSelected = selectedIds.includes(modality.id);

              return (
                <Tooltip key={modality.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(modality.id)}
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
                          {modality.name || "Unnamed Modality"}
                        </h3>
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
