"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileCheck, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RubricMappingItem {
  name: string;
  description?: string;
  agent_role?: string;
}

export interface RubricCardGridProps {
  rubrics: Array<{ rubric_id: string; name: string; description?: string; agent_role?: string }>;
  validRubricIds: string[];
  selectedRubricId: string | null;
  onSelect: (id: string | null) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function RubricCardGrid({
  rubrics,
  validRubricIds,
  selectedRubricId,
  onSelect,
  readonly = false,
}: RubricCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build rubrics from array, filtered by validRubricIds
  const baseRubrics = React.useMemo(() => {
    const validRubricIdsSet = new Set(validRubricIds);
    const filtered = rubrics
      .filter((rubric) => validRubricIdsSet.has(rubric.rubric_id))
      .map((rubric) => ({
        id: rubric.rubric_id,
        name: rubric.name || "",
        description: rubric.description,
        agent_role: rubric.agent_role,
      }));

    // Sort by name
    return filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [rubrics, validRubricIds]);

  // Apply search filter, then sort selected first
  const filteredRubrics = React.useMemo(() => {
    let filtered = baseRubrics;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (rubric) =>
          rubric.name?.toLowerCase().includes(searchLower) ||
          rubric.description?.toLowerCase().includes(searchLower) ||
          rubric.agent_role?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected rubric first, then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = a.id === selectedRubricId;
      const bSelected = b.id === selectedRubricId;
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseRubrics, searchTerm, selectedRubricId]);

  const handleSelect = (rubricId: string) => {
    if (readonly) return;
    const isSelected = rubricId === selectedRubricId;
    onSelect(isSelected ? null : rubricId);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search rubrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredRubrics.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No rubrics found. Try adjusting your search or filters.
            </div>
          ) : (
            filteredRubrics.map((rubric) => {
              const isSelected = rubric.id === selectedRubricId;

              return (
                <Tooltip key={rubric.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(rubric.id)}
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

                      <div className="flex items-start gap-3">
                        <FileCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {rubric.name || "Unnamed Rubric"}
                          </h3>
                          {rubric.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {rubric.description}
                            </p>
                          )}
                          {rubric.agent_role && (
                            <span className="text-xs px-1.5 py-0.5 bg-muted rounded mt-2 inline-block">
                              {rubric.agent_role}
                            </span>
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
