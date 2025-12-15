/**
 * SettingsKeySelectionSection.tsx
 * Card-based selection for API keys
 * Follows PersonaSection pattern
 */
"use client";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KeyMappingItem {
  name: string;
  description: string;
  key_masked: string;
  active: boolean;
  department_ids: string[] | null;
}

type StepStatus = "pending" | "active" | "completed";

export interface SettingsKeySelectionSectionProps {
  // Data
  keyMapping: Record<string, KeyMappingItem>;
  validKeyIds: string[];
  selectedKeyId: string | null;
  sectionLabel: string; // e.g., "OpenAI Key" or "Microsoft clientId Key"

  // Callbacks
  onKeyIdChange: (keyId: string | null) => void;

  // UI State
  stepStatus?: StepStatus;
  stepTitle?: string;
  stepDescription?: string;
  stepNumber?: number;
  isReadonly: boolean;
}

export function SettingsKeySelectionSection({
  keyMapping,
  validKeyIds,
  selectedKeyId,
  sectionLabel,
  onKeyIdChange,
  stepStatus = "active",
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: SettingsKeySelectionSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter keys based on search term
  const filteredKeyIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return validKeyIds;
    }
    const searchLower = searchTerm.toLowerCase();
    return validKeyIds.filter((keyId) => {
      const key = keyMapping[keyId];
      if (!key) return false;
      const searchText = `${key.description || ""}`.toLowerCase();
      return searchText.includes(searchLower);
    });
  }, [validKeyIds, keyMapping, searchTerm]);

  // If stepTitle is provided, render as full card section, otherwise just the content
  if (stepTitle) {
    return (
      <Card
        className={cn(
          "transition-all",
          stepStatus === "active" && "ring-2 ring-primary",
          stepStatus === "pending" && "opacity-50"
        )}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
          <div className="flex items-center space-x-3">
            {stepNumber !== undefined && (
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  stepStatus === "completed"
                    ? "bg-green-500 text-white"
                    : stepStatus === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                )}
              >
                {stepStatus === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  String(stepNumber)
                )}
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{stepTitle}</CardTitle>
              {stepDescription && (
                <CardDescription>{stepDescription}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-6">
          <KeySelectionContent
            keyMapping={keyMapping}
            filteredKeyIds={filteredKeyIds}
            selectedKeyId={selectedKeyId}
            sectionLabel={sectionLabel}
            onKeyIdChange={onKeyIdChange}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            isReadonly={isReadonly}
          />
        </CardContent>
      </Card>
    );
  }

  // Just render the content without card wrapper
  return (
    <div className="space-y-3">
      <KeySelectionContent
        keyMapping={keyMapping}
        filteredKeyIds={filteredKeyIds}
        selectedKeyId={selectedKeyId}
        sectionLabel={sectionLabel}
        onKeyIdChange={onKeyIdChange}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        isReadonly={isReadonly}
      />
    </div>
  );
}

function KeySelectionContent({
  keyMapping,
  filteredKeyIds,
  selectedKeyId,
  sectionLabel,
  onKeyIdChange,
  searchTerm,
  onSearchTermChange,
  isReadonly,
}: {
  keyMapping: Record<string, KeyMappingItem>;
  filteredKeyIds: string[];
  selectedKeyId: string | null;
  sectionLabel: string;
  onKeyIdChange: (keyId: string | null) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  isReadonly: boolean;
}) {
  return (
    <>
      {/* Section Label */}
      <div className="text-sm font-medium text-muted-foreground">
        {sectionLabel}
      </div>

      {/* Search bar */}
      <div className="flex h-9 items-center gap-2 border-b px-0">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          type="text"
          placeholder="Search keys..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isReadonly}
        />
      </div>

      {/* Filtered keys grid */}
      <div className="grid grid-cols-2 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
        {filteredKeyIds.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            {searchTerm ? "No keys found" : "No keys available"}
          </div>
        ) : (
          filteredKeyIds.map((keyId) => {
            const key = keyMapping[keyId];
            if (!key) return null;

            const isSelected = selectedKeyId === keyId;

            return (
              <button
                key={keyId}
                type="button"
                onClick={() => {
                  if (isReadonly) return;
                  onKeyIdChange(isSelected ? null : keyId);
                }}
                disabled={isReadonly}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "ring-2 ring-primary bg-accent",
                  !key.active && "opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {key.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {key.description}
                      </div>
                    )}
                    {key.department_ids && key.department_ids.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {key.department_ids.length} department
                        {key.department_ids.length !== 1 ? "s" : ""}
                      </div>
                    )}
                    {!key.active && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Inactive
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

