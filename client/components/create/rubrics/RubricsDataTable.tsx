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
import type {
  RubricItem,
  StandardGroupsMapping,
  StandardsMapping,
} from "@/lib/api/v2/schemas/rubrics";

export interface RubricsDataTableProps {
  rubrics: RubricItem[];
  standardGroupsMapping: StandardGroupsMapping;
  standardsMapping: StandardsMapping;
  renderRubricCard: (rubric: RubricItem) => React.ReactNode;
}

export function RubricsDataTable({
  rubrics,
  standardGroupsMapping: _standardGroupsMapping,
  standardsMapping: _standardsMapping,
  renderRubricCard,
}: RubricsDataTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedPassPointsFilter, setSelectedPassPointsFilter] =
    React.useState<string[]>([]);
  const [selectedTotalPointsFilter, setSelectedTotalPointsFilter] =
    React.useState<string[]>([]);
  const [selectedPassPercentageFilter, setSelectedPassPercentageFilter] =
    React.useState<string[]>([]);

  // Static filter options
  const passPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  const totalPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  const passPercentageOptions = [
    { value: "0-25", label: "0-25%" },
    { value: "26-50", label: "26-50%" },
    { value: "51-75", label: "51-75%" },
    { value: "76-100", label: "76-100%" },
  ];

  // Filter rubrics
  const filteredRubrics = React.useMemo(() => {
    return rubrics.filter((rubric) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = rubric.name.toLowerCase().includes(query);
        const matchesDesc = rubric.description.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      // Pass points filter
      if (selectedPassPointsFilter.length > 0) {
        const matchesRange = selectedPassPointsFilter.some((range) => {
          if (range === "100+") return rubric.passPoints >= 100;
          const [min, max] = range.split("-").map(Number);
          return rubric.passPoints >= min && rubric.passPoints <= max;
        });
        if (!matchesRange) return false;
      }

      // Total points filter
      if (selectedTotalPointsFilter.length > 0) {
        const matchesRange = selectedTotalPointsFilter.some((range) => {
          if (range === "100+") return rubric.points >= 100;
          const [min, max] = range.split("-").map(Number);
          return rubric.points >= min && rubric.points <= max;
        });
        if (!matchesRange) return false;
      }

      // Pass percentage filter
      if (selectedPassPercentageFilter.length > 0) {
        const percentage =
          rubric.points > 0
            ? Math.round((rubric.passPoints / rubric.points) * 100)
            : 0;
        const matchesRange = selectedPassPercentageFilter.some((range) => {
          const [min, max] = range.split("-").map(Number);
          return percentage >= min && percentage <= max;
        });
        if (!matchesRange) return false;
      }

      return true;
    });
  }, [
    rubrics,
    searchQuery,
    selectedPassPointsFilter,
    selectedTotalPointsFilter,
    selectedPassPercentageFilter,
  ]);

  return (
    <div className="space-y-4" data-testid="rubrics-data-table">
      {/* Filters toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <Input
          placeholder="Search rubrics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-[200px]"
        />

        {/* Pass Points filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Pass Points{" "}
              {selectedPassPointsFilter.length > 0 &&
                `(${selectedPassPointsFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Filter by pass points..." />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandList>
                {passPointsOptions.map((opt) => {
                  const checked = selectedPassPointsFilter.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => {
                        const next = new Set(selectedPassPointsFilter);
                        if (checked) next.delete(opt.value);
                        else next.add(opt.value);
                        setSelectedPassPointsFilter(Array.from(next));
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

        {/* Total Points filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Total Points{" "}
              {selectedTotalPointsFilter.length > 0 &&
                `(${selectedTotalPointsFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Filter by total points..." />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandList>
                {totalPointsOptions.map((opt) => {
                  const checked = selectedTotalPointsFilter.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => {
                        const next = new Set(selectedTotalPointsFilter);
                        if (checked) next.delete(opt.value);
                        else next.add(opt.value);
                        setSelectedTotalPointsFilter(Array.from(next));
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

        {/* Pass Percentage filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Pass %{" "}
              {selectedPassPercentageFilter.length > 0 &&
                `(${selectedPassPercentageFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Filter by pass percentage..." />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandList>
                {passPercentageOptions.map((opt) => {
                  const checked = selectedPassPercentageFilter.includes(
                    opt.value
                  );
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => {
                        const next = new Set(selectedPassPercentageFilter);
                        if (checked) next.delete(opt.value);
                        else next.add(opt.value);
                        setSelectedPassPercentageFilter(Array.from(next));
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
          selectedPassPointsFilter.length > 0 ||
          selectedTotalPointsFilter.length > 0 ||
          selectedPassPercentageFilter.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedPassPointsFilter([]);
              setSelectedTotalPointsFilter([]);
              setSelectedPassPercentageFilter([]);
            }}
          >
            Reset filters
          </Button>
        )}
      </div>

      {/* Rubrics cards */}
      <div className="space-y-6">
        {filteredRubrics.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No rubrics match the current filters.
          </div>
        ) : (
          filteredRubrics.map((rubric) => renderRubricCard(rubric))
        )}
      </div>
    </div>
  );
}
