/**
 * DocumentFieldsSection.tsx
 * Fields selection section component with search and card display
 */
"use client";
import { Check, Search } from "lucide-react";
import { useMemo } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/schema";

type FieldMappingItem =
  components["schemas"]["app__api__v3__documents__detail__FieldMappingItem"];

type StepStatus = "pending" | "active" | "completed";

export interface DocumentFieldsSectionProps {
  // Data
  validFieldIds: string[];
  fieldMapping: Record<string, FieldMappingItem>;
  selectedFieldIds: string[];

  // State
  searchTerm: string;

  // Callbacks
  onFieldIdsChange: (ids: string[]) => void;
  onSearchTermChange: (term: string) => void;

  // UI State
  isReadonly: boolean;
  disabled?: boolean;

  // Step props
  stepStatus?: StepStatus;
  stepNumber?: number;
  stepTitle?: string;
  stepDescription?: string;
}

export function DocumentFieldsSection({
  validFieldIds,
  fieldMapping,
  selectedFieldIds,
  searchTerm,
  onFieldIdsChange,
  onSearchTermChange,
  isReadonly,
  disabled = false,
  stepStatus = "active",
  stepNumber = 2,
  stepTitle = "Fields",
  stepDescription = "Select fields (parameter items) for this document.",
}: DocumentFieldsSectionProps) {
  // Filter fields based on search term
  const filteredFieldIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return validFieldIds;
    }
    const searchLower = searchTerm.toLowerCase();
    return validFieldIds.filter((fieldId) => {
      const field = fieldMapping[fieldId];
      if (!field) return false;
      const searchText =
        `${field.name} ${field.description || ""} ${field.parameter_name || ""}`.toLowerCase();
      return searchText.includes(searchLower);
    });
  }, [validFieldIds, fieldMapping, searchTerm]);

  if (validFieldIds.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
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
      </CardHeader>
      <CardContent className="space-y-3 px-6">
        {/* Search bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly || disabled}
          />
        </div>

        {/* Filtered fields grid */}
        <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
          {filteredFieldIds.map((fieldId) => {
            const field = fieldMapping[fieldId];
            if (!field) return null;

            const isSelected = selectedFieldIds.includes(fieldId);

            return (
              <button
                key={fieldId}
                type="button"
                onClick={() => {
                  if (isReadonly || disabled) return;
                  const newIds = isSelected
                    ? selectedFieldIds.filter((id) => id !== fieldId)
                    : [...selectedFieldIds, fieldId];
                  onFieldIdsChange(newIds);
                }}
                disabled={isReadonly || disabled}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "ring-2 ring-primary bg-accent",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{field.name}</div>
                    {field.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {field.description}
                      </div>
                    )}
                    {field.parameter_name && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Parameter: {field.parameter_name}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
