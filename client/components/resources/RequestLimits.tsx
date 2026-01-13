/**
 * RequestLimits.tsx
 * Resource component for request limit selection
 * Uses GenericPicker to select existing request limit resources
 * Manages request_limit_id and reports to parent
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

type CreateDraftRequestLimitsIn = InputOf<
  "/api/v4/resources/request_limits",
  "post"
>;
type CreateDraftRequestLimitsOut = OutputOf<
  "/api/v4/resources/request_limits",
  "post"
>;

export interface RequestLimitItem {
  id: string;
  requests_per_day: number;
}

export interface RequestLimitsProps {
  request_limit_id?: string | null; // Current request_limit_id (standardized prop name)
  request_limit_resource?: {
    id: string | null;
    requests_per_day: number | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_request_limit?: boolean; // Whether to show this resource picker
  request_limit_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  request_limits?: Array<{
    id: string | null;
    requests_per_day: number | null;
    generated?: boolean | null;
  }>; // All available request limits from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onRequestLimitIdChange: (requestLimitId: string | null) => void; // Update request_limit_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createRequestLimitsAction?:
    | ((
        input: CreateDraftRequestLimitsIn
      ) => Promise<CreateDraftRequestLimitsOut>)
    | undefined;
  // Legacy props for backward compatibility
  requestLimitResource?: {
    id: string;
    requests_per_day: number;
    generated?: boolean | null;
  } | null;
  requestLimitId?: string | null;
  suggestions?: string[];
}

export function RequestLimits({
  request_limit_id,
  request_limit_resource,
  show_request_limit = true,
  request_limit_suggestions,
  request_limits,
  disabled = false,
  onRequestLimitIdChange,
  onGenerate,
  isGenerating = false,
  label = "Request Limit",
  id = "request_limit",
  required = false,
  placeholder = "Select request limit...",
  description,
  group_id,
  agent_id,
  createRequestLimitsAction,
  // Legacy props for backward compatibility
  requestLimitResource,
  requestLimitId: _requestLimitId,
  suggestions,
}: RequestLimitsProps) {
  // Use standardized props with fallback to legacy props
  const resource = request_limit_resource ?? requestLimitResource ?? null;
  const resourceId = request_limit_id ?? _requestLimitId ?? null;
  const show = show_request_limit ?? true;
  const suggestionsList = useMemo(
    () => request_limit_suggestions ?? suggestions ?? [],
    [request_limit_suggestions, suggestions]
  );
  const allRequestLimits = useMemo(() => request_limits ?? [], [request_limits]);

  // Track which request limit ID has already had resource created
  const createdRequestLimitIdRef = useRef<string | null>(null);

  // Initialize createdRequestLimitIdRef with current ID
  useEffect(() => {
    if (resourceId) {
      createdRequestLimitIdRef.current = resourceId;
    }
  }, [resourceId]);

  // Convert request_limits array to RequestLimitItem format for GenericPicker
  const requestLimitItems = useMemo(() => {
    return allRequestLimits
      .filter((rl) => rl.id && rl.requests_per_day !== null) // Filter out nulls
      .map((rl) => ({
        id: rl.id!,
        requests_per_day: rl.requests_per_day!,
      }));
  }, [allRequestLimits]);

  // Check if a request limit is suggested
  const isSuggested = useCallback(
    (requestLimitId: string) => suggestionsList.includes(requestLimitId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;

      // Create resource for newly selected request limit
      if (
        selectedId &&
        selectedId !== resourceId &&
        createRequestLimitsAction &&
        agent_id &&
        group_id &&
        !createdRequestLimitIdRef.current
      ) {
        try {
          // Find requests_per_day from request_limits array
          const requestLimitObj = allRequestLimits.find(
            (rl) => rl.id === selectedId
          );
          if (requestLimitObj?.requests_per_day !== null) {
            await createRequestLimitsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                requests_per_day: requestLimitObj.requests_per_day!,
                mcp: false,
              },
            });
            createdRequestLimitIdRef.current = selectedId;
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(
            `Failed to create request limit resource for ${selectedId}:`,
            error
          );
          // Don't block UI - still update selection
        }
      }

      // Update parent state
      onRequestLimitIdChange(selectedId);
    },
    [
      resourceId,
      onRequestLimitIdChange,
      createRequestLimitsAction,
      agent_id,
      group_id,
      allRequestLimits,
    ]
  );

  // Check if request limit resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return resource?.generated ?? false;
  }, [resource]);

  // Don't render if show_request_limit is false (AFTER all hooks)
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
      <GenericPicker<RequestLimitItem>
        items={requestLimitItems}
        itemIds={allRequestLimits
          .map((rl) => rl.id)
          .filter((id): id is string => id !== null)} // All request limit IDs from array, filter nulls
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={handleSelect}
        multiSelect={false}
        getId={(item) => item.id}
        getLabel={(item) =>
          item.requests_per_day === null
            ? "Unlimited"
            : `${item.requests_per_day} requests/day`
        }
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  {item.requests_per_day === null
                    ? "Unlimited"
                    : `${item.requests_per_day} requests/day`}
                </div>
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
