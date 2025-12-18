/**
 * SettingsKeyPicker.tsx
 * Key picker component for selecting API keys
 * Used in auth and provider config sections
 */
"use client";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface KeyMappingItem {
  name: string;
  description: string;
  key_masked: string;
  active: boolean;
  department_ids: string[] | null;
}

export interface SettingsKeyPickerProps {
  // Data
  keyMapping: Record<string, KeyMappingItem>;
  validKeyIds: string[];
  selectedKeyId: string | null;
  sectionLabel: string; // e.g., "OpenAI Key" or "Microsoft clientId Key"

  // Callbacks
  onKeyIdChange: (keyId: string | null) => void;

  // UI State
  isReadonly: boolean;
}

export function SettingsKeyPicker({
  keyMapping,
  validKeyIds,
  selectedKeyId,
  sectionLabel,
  onKeyIdChange,
  isReadonly,
}: SettingsKeyPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter and sort keys - selected keys first
  const filteredKeyIds = useMemo(() => {
    let filtered = validKeyIds;

    // Filter by search term if provided
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = validKeyIds.filter((keyId) => {
        const key = keyMapping[keyId];
        if (!key) return false;
        const searchText = `${key.description || ""}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Sort: selected keys first, then unselected
    return [...filtered].sort((a, b) => {
      const aSelected = a === selectedKeyId;
      const bSelected = b === selectedKeyId;
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  }, [validKeyIds, keyMapping, searchTerm, selectedKeyId]);

  return (
    <div className="space-y-3">
      {/* Section Label - Only show if provided */}
      {sectionLabel && (
        <div className="text-sm font-medium text-muted-foreground">
          {sectionLabel}
        </div>
      )}

      {/* Search bar */}
      <div className="flex h-9 items-center gap-2 border-b px-0">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          type="text"
          placeholder="Search keys..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
                  !key.active && "opacity-60",
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
    </div>
  );
}
