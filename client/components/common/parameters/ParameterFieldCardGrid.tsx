"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Search,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParameterFieldCardGridProps {
  fieldMapping: Record<string, { name: string; description?: string; usage_count?: number; department_ids?: string[] | null }>;
  validFieldIds: string[];
  selectedFieldIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function ParameterFieldCardGrid({
  fieldMapping,
  validFieldIds,
  selectedFieldIds,
  onSelect,
  label = "Fields",
  description = "Select fields to add to the parameter",
  readonly = false,
}: ParameterFieldCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build fields from mapping
  const baseFields = React.useMemo(() => {
    const fields = validFieldIds.map((id) => ({
      id,
      ...fieldMapping[id],
    }));

    // Sort by name
    return fields.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [validFieldIds, fieldMapping]);

  // Apply search filter, then sort selected first
  const filteredFields = React.useMemo(() => {
    let filtered = baseFields;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (field) =>
          field.name?.toLowerCase().includes(searchLower) ||
          field.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected fields first (preserving order from selectedFieldIds array), then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedFieldIds.includes(a.id);
      const bSelected = selectedFieldIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      if (aSelected && bSelected) {
        // Both selected - preserve order from selectedFieldIds array
        const aIndex = selectedFieldIds.indexOf(a.id);
        const bIndex = selectedFieldIds.indexOf(b.id);
        return aIndex - bIndex;
      }
      // Both unselected - sort by name
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseFields, searchTerm, selectedFieldIds]);

  const handleSelect = (fieldId: string) => {
    if (readonly) return;
    const isSelected = selectedFieldIds.includes(fieldId);
    const newIds = isSelected
      ? selectedFieldIds.filter((id) => id !== fieldId)
      : [...selectedFieldIds, fieldId];
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
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredFields.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No fields found. Try adjusting your search or filters.
            </div>
          ) : (
            filteredFields.map((field) => {
              const isSelected = selectedFieldIds.includes(field.id);

              return (
                <Tooltip key={field.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(field.id)}
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

                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {field.name || "Unnamed Field"}
                          </h3>
                          {field.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {field.description}
                            </p>
                          )}
                        </div>
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

