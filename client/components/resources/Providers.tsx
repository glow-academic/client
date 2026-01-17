/**
 * Providers.tsx
 * Resource component for provider picker fields
 * Single-select resource component following Colors.tsx pattern
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
  onProviderIdChange?: (providerId: string | null) => void; // Update provider_id in parent form state (single-select)
  provider_ids?: string[]; // Current provider resource IDs (multi-select)
  provider_resources?: Array<{
    provider_id: string | null;
    name: string | null;
    description: string | null;
    value: string | null;
    active: boolean | null;
    generated?: boolean | null;
  }>; // Selected provider resources (multi-select)
  onChange?: (ids: string[]) => void; // Update provider_ids in parent form state (multi-select)
  multiSelect?: boolean; // Whether to use multi-select mode
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
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
  provider_ids,
  provider_resources,
  onChange,
  multiSelect = false,
  onGenerate,
  isGenerating = false,
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
  const ids = useMemo(() => provider_ids ?? [], [provider_ids]);
  
  // Track which provider IDs have already had resources created (multi-select)
  const createdProviderIdsRef = useRef<Set<string>>(new Set());
  
  // Initialize createdProviderIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdProviderIdsRef.current.add(id));
  }, [ids]);
  
  // Check if any provider resource is generated (multi-select)
  const hasGenerated = useMemo(() => {
    return provider_resources?.some((p) => p.generated) ?? false;
  }, [provider_resources]);

  // Convert providers array from API format to ProviderItem format
  const providerItems = useMemo(() => {
    if (multiSelect) {
      // Multi-select: use provider_id field
      return (providers ?? [])
        .filter((p) => p.provider_id && p.name) // Filter out nulls
        .map((p) => ({
          id: p.provider_id!,
          name: p.name!,
          ...(p.description ? { description: p.description } : {}),
          ...(p.value ? { value: p.value } : {}),
          ...(p.active !== null ? { active: p.active } : {}),
        }));
    }
    // Single-select: use id field
    return (providers ?? [])
      .filter((p) => p.id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
      }));
  }, [providers, multiSelect]);

  // Check if a provider is suggested
  const isSuggested = useCallback(
    (providerId: string) => suggestionsList.includes(providerId),
    [suggestionsList]
  );

  const handleSelectMulti = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdProviderIdsRef.current.has(id)
      );

      // Create resources for newly selected providers
      if (
        newlySelected.length > 0 &&
        createProvidersAction &&
        agent_id &&
        group_id
      ) {
        for (const providerId of newlySelected) {
          try {
            await createProvidersAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                provider_id: providerId,
                mcp: false,
              },
            });
            createdProviderIdsRef.current.add(providerId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create provider resource for ${providerId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      if (onChange) {
        onChange(selectedIds);
      }
    },
    [ids, onChange, createProvidersAction, agent_id, group_id]
  );

  // Don't render if show_provider is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {onGenerate && agent_id && multiSelect && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      <GenericPicker<ProviderItem>
        items={providerItems}
        itemIds={multiSelect 
          ? (providers?.map((p) => p.provider_id).filter((id): id is string => id !== null) ?? [])
          : (providers?.map((p) => p.id).filter((id): id is string => id !== null) ?? [])}
        selectedIds={multiSelect ? ids : (resourceId ? [resourceId] : [])}
        onSelect={multiSelect 
          ? handleSelectMulti
          : (selectedIds) => {
              if (onProviderIdChange) {
                onProviderIdChange(selectedIds.length > 0 ? selectedIds[0] : null);
              }
            }}
        multiSelect={multiSelect}
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
                {(item as { value?: string }).value && (
                  <div className="text-xs text-muted-foreground truncate">
                    {(item as { value?: string }).value}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        emptyMessage="No providers available."
        disabled={disabled}
        placeholder={placeholder}
        showLabel={false}
        hideSelectedChips={multiSelect ? false : true}
        showClearAll={multiSelect ? true : false}
      />
    </div>
  );
}
