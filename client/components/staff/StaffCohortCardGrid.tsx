"use client";

import * as React from "react";
import { Search, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CohortItem {
  cohort_id: string;
  name: string;
  description: string;
}

export interface StaffCohortCardGridProps {
  cohortIds: string[];
  validCohortIds: string[];
  cohorts: CohortItem[];  // Array of cohort objects (replaces cohortMapping)
  onCohortIdsChange: (ids: string[]) => void;
  readonly?: boolean;
}

export function StaffCohortCardGrid({
  cohortIds,
  validCohortIds,
  cohorts,
  onCohortIdsChange,
  readonly = false,
}: StaffCohortCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build cohorts from array, filtered by validCohortIds
  const baseCohorts = React.useMemo(() => {
    const cohortMap = new Map(cohorts.map((c) => [c.cohort_id, c]));
    const validCohorts = validCohortIds
      .map((id) => {
        const cohort = cohortMap.get(id);
        if (cohort) {
          return {
            id: cohort.cohort_id,
            name: cohort.name || "",
            description: cohort.description || "",
          };
        }
        return null;
      })
      .filter((c): c is { id: string; name: string; description: string } => c !== null);

    // Sort by name
    return validCohorts.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [validCohortIds, cohorts]);

  // Apply search filter, then sort selected first
  const filteredCohorts = React.useMemo(() => {
    let filtered = baseCohorts;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (cohort) =>
          cohort.name?.toLowerCase().includes(searchLower) ||
          cohort.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected cohorts first, then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = cohortIds.includes(a.id);
      const bSelected = cohortIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      if (aSelected && bSelected) {
        // Both selected - preserve order from cohortIds array
        const aIndex = cohortIds.indexOf(a.id);
        const bIndex = cohortIds.indexOf(b.id);
        return aIndex - bIndex;
      }
      // Both unselected - sort by name
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseCohorts, searchTerm, cohortIds]);

  const handleSelect = (cohortId: string) => {
    if (readonly) return;
    const isSelected = cohortIds.includes(cohortId);
    const newIds = isSelected
      ? cohortIds.filter((id) => id !== cohortId)
      : [...cohortIds, cohortId];
    onCohortIdsChange(newIds);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          type="text"
          placeholder="Search cohorts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readonly}
        />
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
        {filteredCohorts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No cohorts found. Try adjusting your search.
          </div>
        ) : (
          filteredCohorts.map((cohort) => {
            const isSelected = cohortIds.includes(cohort.id);

            return (
              <button
                key={cohort.id}
                type="button"
                onClick={() => handleSelect(cohort.id)}
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
                  <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-tight">
                      {cohort.name || "Unnamed Cohort"}
                    </h3>
                    {cohort.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {cohort.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
