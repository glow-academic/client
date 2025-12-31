/**
 * StepCard.tsx
 * Card wrapper with step header, search bar, and filter built in
 */
"use client";

import { Check, Filter, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "completed";

export interface StepCardProps {
  stepStatus: StepStatus;
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  isReadonly?: boolean;
  isEditMode?: boolean;
  className?: string;
  // Optional action buttons in top right
  actions?: React.ReactNode;
  // Search bar configuration (built into card)
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  // Filter configuration (built into card)
  filters?: Array<{
    key: string;
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }>;
  children: React.ReactNode;
}

export function StepCard({
  stepStatus,
  stepNumber,
  stepTitle,
  stepDescription,
  isReadonly = false,
  isEditMode = false,
  className,
  actions,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  filters,
  children,
}: StepCardProps) {
  // Local temporary state for filter values (until Apply is clicked)
  const [tempFilterValues, setTempFilterValues] = useState<Record<string, boolean>>(
    {}
  );
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  // Initialize temp filter values from props
  useEffect(() => {
    if (filters) {
      const initialValues: Record<string, boolean> = {};
      filters.forEach((filter) => {
        initialValues[filter.key] = filter.value;
      });
      setTempFilterValues(initialValues);
    }
  }, [filters]);

  // Sync temp values when props change
  useEffect(() => {
    if (filters) {
      filters.forEach((filter) => {
        setTempFilterValues((prev) => ({
          ...prev,
          [filter.key]: filter.value,
        }));
      });
    }
  }, [filters]);

  const handleApplyFilters = () => {
    if (filters) {
      filters.forEach((filter) => {
        const tempValue = tempFilterValues[filter.key];
        if (tempValue !== undefined) {
          filter.onChange(tempValue);
        }
      });
    }
    setFilterPopoverOpen(false);
  };

  const hasActiveFilters = filters?.some((filter) => filter.value) ?? false;

  return (
    <Card
      className={cn(
        "transition-all",
        !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
        !isEditMode && stepStatus === "pending" && "opacity-50",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              <span>{stepNumber}</span>
            )}
          </div>
          <div>
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search bar with optional filter */}
        {(searchTerm !== undefined || filters) && (
          <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
            {searchTerm !== undefined && (
              <>
                <Search className="size-4 shrink-0 opacity-50" />
                <input
                  type="text"
                  placeholder={searchPlaceholder || "Search..."}
                  value={searchTerm}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isReadonly}
                />
              </>
            )}
            {filters && (
              <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isReadonly}
                        className="relative"
                      >
                        <Filter className="h-4 w-4" />
                        {hasActiveFilters && (
                          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                        )}
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Filters</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-64 p-4" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {filters.map((filter) => (
                        <div key={filter.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-${filter.key}`}
                            checked={tempFilterValues[filter.key] ?? false}
                            onCheckedChange={(checked) =>
                              setTempFilterValues((prev) => ({
                                ...prev,
                                [filter.key]: checked === true,
                              }))
                            }
                            disabled={isReadonly}
                          />
                          <label
                            htmlFor={`filter-${filter.key}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {filter.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={handleApplyFilters}
                      disabled={isReadonly}
                      className="w-full"
                      size="sm"
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

