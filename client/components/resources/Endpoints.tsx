/**
 * Endpoints.tsx
 * Resource component for endpoint selection
 * Uses GenericPicker to select existing endpoint resources
 * Manages endpoint_ids array and reports to parent
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

type CreateDraftEndpointsIn = InputOf<"/api/v4/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v4/resources/endpoints", "post">;

export interface EndpointItem {
  id: string;
  name: string;
  description?: string;
}

export interface EndpointsProps {
  endpoint_ids?: string[]; // Current endpoint resource IDs (standardized prop name)
  endpoint_resources?: Array<{
    endpoint_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected endpoint resources (each includes generated field)
  show_endpoints?: boolean; // Whether to show this resource picker
  endpoint_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  endpoints?: Array<{
    endpoint_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available endpoints from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update endpoint_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createEndpointsAction?:
    | ((input: CreateDraftEndpointsIn) => Promise<CreateDraftEndpointsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Endpoints({
  endpoint_ids,
  endpoint_resources,
  show_endpoints = false,
  endpoint_suggestions,
  endpoints,
  disabled = false,
  onChange,
  label = "Endpoints",
  id = "endpoints",
  required = false,
  placeholder = "Select endpoints...",
  description,
  group_id,
  agent_id,
  createEndpointsAction,
  onGenerate,
  isGenerating = false,
}: EndpointsProps) {
  const ids = useMemo(() => endpoint_ids ?? [], [endpoint_ids]);
  const show = show_endpoints ?? false;
  const allEndpoints = useMemo(() => endpoints ?? [], [endpoints]);
  const suggestionsList = useMemo(
    () => endpoint_suggestions ?? [],
    [endpoint_suggestions]
  );

  // Track which endpoint IDs have already had resources created
  const createdEndpointIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdEndpointIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdEndpointIdsRef.current.add(id));
  }, [ids]);

  // Convert endpoints array to EndpointItem format for GenericPicker
  const endpointItems = useMemo(() => {
    return allEndpoints
      .filter((e) => e.endpoint_id && e.name) // Filter out nulls
      .map((e) => ({
        id: e.endpoint_id!,
        name: e.name!,
        ...(e.description ? { description: e.description } : {}),
      }));
  }, [allEndpoints]);

  // Check if an endpoint is suggested
  const isSuggested = useCallback(
    (endpointId: string) => suggestionsList.includes(endpointId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdEndpointIdsRef.current.has(id)
      );

      // Create resources for newly selected endpoints (endpoints are generated, not selected)
      // So we don't create resources here - they're created via generation
      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange]
  );

  // Check if any endpoint resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return endpoint_resources?.some((e) => e.generated) ?? false;
  }, [endpoint_resources]);

  // Don't render if show_endpoints is false (AFTER all hooks)
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
      <GenericPicker<EndpointItem>
        items={endpointItems}
        itemIds={allEndpoints
          .map((e) => e.endpoint_id)
          .filter((id): id is string => id !== null)} // All endpoint IDs from array, filter nulls
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
