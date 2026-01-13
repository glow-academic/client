/**
 * Providers.tsx
 * Resource component for provider picker fields
 * Single-select resource component following Colors.tsx pattern
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Check } from "lucide-react";
import { useCallback, useMemo } from "react";

type CreateDraftProvidersIn = InputOf<"/api/v4/resources/providers", "post">;
type CreateDraftProvidersOut = OutputOf<"/api/v4/resources/providers", "post">;

export interface ProviderItem {
  id: string;
  name: string;
  description?: string;
}

export interface ProvidersProps {
  provider_id?: string | null; // Current provider_id (standardized prop name)
  provider_resource?: {
    id: string | null;
    name: string | null;
    description: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_provider?: boolean; // Whether to show this resource picker
  provider_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  providers?: Array<{
    id: string | null;
    name: string | null;
    description: string | null;
    generated?: boolean | null;
  }>; // All available providers from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onProviderIdChange: (providerId: string | null) => void; // Update provider_id in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createProvidersAction?:
    | ((input: CreateDraftProvidersIn) => Promise<CreateDraftProvidersOut>)
    | undefined;
}

export function Providers({
  provider_id,
  provider_resource,
  show_provider = false,
  provider_suggestions,
  providers,
  disabled = false,
  onProviderIdChange,
  label = "Provider",
  id = "provider",
  required = false,
  placeholder = "Select a provider...",
  group_id,
  agent_id,
  createProvidersAction,
}: ProvidersProps) {
  const resource = provider_resource ?? null;
  const resourceId = provider_id ?? null;
  const show = show_provider ?? false;
  const suggestionsList = useMemo(
    () => provider_suggestions ?? [],
    [provider_suggestions]
  );

  // Convert providers array from API format to ProviderItem format
  const providerItems = useMemo(() => {
    return (providers ?? [])
      .filter((p) => p.id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
      }));
  }, [providers]);

  // Check if a provider is suggested
  const isSuggested = useCallback(
    (providerId: string) => suggestionsList.includes(providerId),
    [suggestionsList]
  );

  // Don't render if show_provider is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      <GenericPicker<ProviderItem>
        items={providerItems}
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={(selectedIds) => {
          onProviderIdChange(selectedIds.length > 0 ? selectedIds[0] : null);
        }}
        multiSelect={false}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={`ml-auto flex-shrink-0 h-4 w-4 ${
                isSelected ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        )}
        emptyMessage="No providers available."
        disabled={disabled}
        placeholder={placeholder}
        showLabel={false}
      />
    </div>
  );
}
