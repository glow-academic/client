/**
 * SettingProviders.tsx
 * Multi-select resource component for providers in settings
 * Follows Departments.tsx pattern for multi-select resources
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

export interface SettingProviderItem {
  id: string;
  name: string;
  description?: string;
  value?: string;
  active?: boolean;
}

export interface SettingProvidersProps {
  provider_ids?: string[]; // Current provider resource IDs (standardized prop name)
  provider_resources?: Array<{
    provider_id: string | null;
    name: string | null;
    description: string | null;
    value: string | null;
    active: boolean | null;
    generated?: boolean | null;
  }>; // Selected provider resources (each includes generated field)
  show_providers?: boolean; // Whether to show this resource picker
  provider_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  providers?: Array<{
    provider_id: string | null;
    name: string | null;
    description: string | null;
    value: string | null;
    active: boolean | null;
    generated?: boolean | null;
  }>; // All available providers from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update provider_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createProvidersAction?:
    | ((input: CreateDraftProvidersIn) => Promise<CreateDraftProvidersOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function SettingProviders({
  provider_ids,
  provider_resources,
  show_providers = false,
  provider_suggestions,
  providers,
  disabled = false,
  onChange,
  label = "Providers",
  id = "providers",
  required = false,
  placeholder = "Select providers...",
  description,
  group_id,
  agent_id,
  createProvidersAction,
  onGenerate,
  isGenerating = false,
}: SettingProvidersProps) {
  const ids = useMemo(() => provider_ids ?? [], [provider_ids]);
  const show = show_providers ?? false;
  const allProviders = useMemo(() => providers ?? [], [providers]);
  const suggestionsList = useMemo(
    () => provider_suggestions ?? [],
    [provider_suggestions]
  );

  // Track which provider IDs have already had resources created
  const createdProviderIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdProviderIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdProviderIdsRef.current.add(id));
  }, [ids]);

  // Convert providers array to SettingProviderItem format for GenericPicker
  const providerItems = useMemo(() => {
    return allProviders
      .filter((p) => p.provider_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.provider_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
        ...(p.value ? { value: p.value } : {}),
        ...(p.active !== null ? { active: p.active } : {}),
      }));
  }, [allProviders]);

  // Check if a provider is suggested
  const isSuggested = useCallback(
    (providerId: string) => suggestionsList.includes(providerId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
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
      onChange(selectedIds);
    },
    [ids, onChange, createProvidersAction, agent_id, group_id]
  );

  // Check if any provider resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return provider_resources?.some((p) => p.generated) ?? false;
  }, [provider_resources]);

  // Don't render if show_providers is false (AFTER all hooks)
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
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {onGenerate && agent_id && (
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
      <GenericPicker<SettingProviderItem>
        items={providerItems}
        itemIds={allProviders
          .map((p) => p.provider_id)
          .filter((id): id is string => id !== null)} // All provider IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
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
                {item.value && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.value}
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
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
