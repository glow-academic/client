"use client";

import { Column } from "@tanstack/react-table";
import * as React from "react";

import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";

export interface ThreePickerFilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }> | undefined;
  count?: number | undefined;
}

export interface FilterSlot {
  /** Column may be undefined when the table hasn't registered the faceting column yet. */
  column: Column<any, any> | undefined;
  title: string;
  options: ReadonlyArray<ThreePickerFilterOption>;
  /** Server-driven search (matches DataTableFacetedFilter API). */
  isServerDriven?: boolean;
  onSearchChange?: (term: string) => void;
  searchValue?: string;
}

export interface ThreePickerFiltersProps {
  /** Tuple — exactly 3 filter slots. Enforced at the type level. */
  slots: [FilterSlot, FilterSlot, FilterSlot];
}

/**
 * ThreePickerFilters
 *
 * Renders exactly 3 faceted filter slots with consistent spacing. Always visible
 * even when a slot has only one option — this is the pinned convention for
 * artifact list pages so the filter bar doesn't reflow as options load.
 *
 * If a slot's `column` is undefined, a disabled placeholder of the same width is
 * rendered in its place to prevent layout shift.
 */
export function ThreePickerFilters({ slots }: ThreePickerFiltersProps) {
  return (
    <div className="flex items-center space-x-2 flex-wrap">
      {slots.map((slot, idx) => {
        if (!slot.column) {
          return (
            <Button
              key={`three-picker-placeholder-${idx}`}
              variant="outline"
              size="sm"
              disabled
              className="h-8 border-dashed opacity-50"
              aria-hidden="true"
            >
              {slot.title}
            </Button>
          );
        }
        // Normalize to the strict shape DataTableFacetedFilter expects under
        // exactOptionalPropertyTypes. Callers may pass `count: number | undefined`.
        const normalizedOptions = slot.options.map((o) => {
          const out: {
            label: string;
            value: string;
            icon?: React.ComponentType<{ className?: string }>;
            count?: number;
          } = { label: o.label, value: o.value };
          if (o.icon !== undefined) out.icon = o.icon;
          if (o.count !== undefined) out.count = o.count;
          return out;
        });
        return (
          <DataTableFacetedFilter
            key={`three-picker-${idx}-${slot.title}`}
            column={slot.column}
            title={slot.title}
            options={normalizedOptions}
            isServerDriven={slot.isServerDriven}
            onSearchChange={slot.onSearchChange}
            searchValue={slot.searchValue}
          />
        );
      })}
    </div>
  );
}

export default ThreePickerFilters;
