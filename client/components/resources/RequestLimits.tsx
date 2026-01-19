/**
 * RequestLimits.tsx
 * Resource component for request limit selection
 * Uses GenericPicker to select existing request limit resources
 * Manages request_limit_id and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Infinity, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  onRequestLimitResourceCreated?: (resource: {
    id: string;
    requests_per_day: number;
  }) => void;
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
  onRequestLimitResourceCreated,
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
  const [customValue, setCustomValue] = useState("");
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [createdRequestLimits, setCreatedRequestLimits] = useState<
    RequestLimitItem[]
  >([]);

  // Track which request limit ID has already had resource created
  const createdRequestLimitIdRef = useRef<string | null>(null);

  // Initialize createdRequestLimitIdRef with current ID
  useEffect(() => {
    if (resourceId) {
      createdRequestLimitIdRef.current = resourceId;
    }
  }, [resourceId]);

  const requestLimitItems = useMemo(() => {
    return allRequestLimits
      .filter((rl) => rl.id && rl.requests_per_day !== null) // Filter out nulls
      .map((rl) => ({
        id: rl.id!,
        requests_per_day: rl.requests_per_day!,
      }));
  }, [allRequestLimits]);
  const selectedFromResource = useMemo(() => {
    if (!resource?.id || resource.requests_per_day === null) return null;
    return {
      id: resource.id,
      requests_per_day: resource.requests_per_day,
    };
  }, [resource]);
  const requestLimitChoices = useMemo(() => {
    const map = new Map<string, RequestLimitItem>();
    requestLimitItems.forEach((item) => map.set(item.id, item));
    createdRequestLimits.forEach((item) => map.set(item.id, item));
    if (selectedFromResource) {
      map.set(selectedFromResource.id, selectedFromResource);
    }
    return Array.from(map.values()).sort(
      (a, b) => a.requests_per_day - b.requests_per_day
    );
  }, [requestLimitItems, createdRequestLimits, selectedFromResource]);

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
  const createRequestLimit = useCallback(
    async (value: number) => {
      if (!createRequestLimitsAction || !agent_id || !group_id) {
        return null;
      }
      try {
        const result = await createRequestLimitsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            requests_per_day: value,
            mcp: false,
          },
        });
        return result.request_limits_id ?? null;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create request limit resource:", error);
        return null;
      }
    },
    [agent_id, group_id, createRequestLimitsAction]
  );
  const handleCustomSave = useCallback(async () => {
    const value = Number.parseInt(customValue, 10);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    const newId = await createRequestLimit(value);
    if (!newId) return;
    const newItem = { id: newId, requests_per_day: value };
    setCreatedRequestLimits((prev) => [...prev, newItem]);
    onRequestLimitResourceCreated?.(newItem);
    onRequestLimitIdChange(newId);
    setIsCustomEditing(false);
    setCustomValue("");
  }, [
    customValue,
    createRequestLimit,
    onRequestLimitIdChange,
    onRequestLimitResourceCreated,
  ]);

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
        <div className="flex items-end justify-between gap-4">
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
          <GenericPicker<RequestLimitItem>
            items={requestLimitChoices}
            itemIds={requestLimitChoices.map((item) => item.id)}
            selectedIds={resourceId ? [resourceId] : []}
            onSelect={handleSelect}
            multiSelect={false}
            getId={(item) => item.id}
            getLabel={(item) => `${item.requests_per_day} requests/day`}
            getSearchText={(item) =>
              `${item.requests_per_day} requests/day ${item.id}`
            }
            placeholder={placeholder}
            disabled={disabled}
            compact={true}
            buttonClassName="h-8"
            showLabel={false}
            hideSelectedChips={true}
            showClearAll={false}
          />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (disabled) return;
            onRequestLimitIdChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (disabled) return;
              onRequestLimitIdChange(null);
            }
          }}
          className={cn(
            "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all",
            "hover:shadow-md hover:bg-accent/50",
            !resourceId && "ring-2 ring-primary bg-accent",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <Infinity className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Unlimited</p>
            <p className="text-xs text-muted-foreground mt-1">
              No daily request limit
            </p>
          </div>
          <Check
            className={cn(
              "absolute right-3 top-3 h-4 w-4",
              !resourceId ? "opacity-100" : "opacity-0"
            )}
          />
        </div>

        {requestLimitChoices.map((item) => {
          const isSelected = item.id === resourceId;
          const isSuggestedItem = isSuggested(item.id);
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (disabled) return;
                onRequestLimitIdChange(item.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (disabled) return;
                  onRequestLimitIdChange(item.id);
                }
              }}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all",
                "hover:shadow-md hover:bg-accent/50",
                isSelected && "ring-2 ring-primary bg-accent",
                disabled && "opacity-60 cursor-not-allowed"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {item.requests_per_day} requests/day
                  </p>
                  {isSuggestedItem && (
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                      Suggested
                    </span>
                  )}
                </div>
              </div>
              <Check
                className={cn(
                  "absolute right-3 top-3 h-4 w-4",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          );
        })}
      </div>
      {!disabled && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3">
          {isCustomEditing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Custom requests/day"
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCustomSave();
                  } else if (e.key === "Escape") {
                    setIsCustomEditing(false);
                    setCustomValue("");
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleCustomSave}
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsCustomEditing(false);
                  setCustomValue("");
                }}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCustomEditing(true)}
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add custom limit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
