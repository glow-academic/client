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
import { useResourceAi } from "@/hooks/use-resource-ai";
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

// Derive resource item type from the GET endpoint response
type RequestLimitsGetResponse = OutputOf<"/api/v4/resources/request_limits/get", "post">;
export type RequestLimitsResourceItem = NonNullable<RequestLimitsGetResponse["items"]>[number];

export interface RequestLimitItem {
  id: string;
  requests_per_day: number;
}

interface RequestLimitPickerItem {
  id: string;
  requests_per_day: number | null;
}

const UNLIMITED_REQUEST_ID = "unlimited";

export interface RequestLimitsProps {
  request_limit_id?: string | null; // Current request_limit_id (standardized prop name)
  request_limit_resource?: RequestLimitsResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_request_limit?: boolean; // Whether to show this resource picker
  request_limit_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  request_limits?: RequestLimitsResourceItem[]; // All available request limits from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onRequestLimitIdChange: (requestLimitId: string | null) => void; // Update request_limit_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
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
  requestLimitResource?: RequestLimitsResourceItem | null;
  requestLimitId?: string | null;
  suggestions?: string[];
  // AI diff view props
  aiRequestLimitResources?: Pick<RequestLimitsResourceItem, "id" | "requests_per_day">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ request_limit_id: string | null } | void>) => void;
}

export function RequestLimits({
  request_limit_id,
  request_limit_resource,
  show_request_limit = true,
  request_limits,
  disabled = false,
  onRequestLimitIdChange,
  onGenerate,
  showAiGenerate = false,
  label = "Request Limit",
  id = "request_limit",
  required = false,
  placeholder = "Select request limit...",
  description,
  group_id,
  create_tool_id,
  createRequestLimitsAction,
  onRequestLimitResourceCreated,
  // Legacy props for backward compatibility
  requestLimitResource,
  requestLimitId: _requestLimitId,
  isAutosaveEnabled = true,
  registerFlush,
}: RequestLimitsProps) {
  // Use standardized props with fallback to legacy props
  const resource = request_limit_resource ?? requestLimitResource ?? null;
  const resourceId = request_limit_id ?? _requestLimitId ?? null;
  const show = show_request_limit ?? true;
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

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ request_limit_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ request_limit_id: string | null } | void> => {
    // Skip if no action available
    if (!createRequestLimitsAction || !group_id) {
      return;
    }

    // If unlimited (no resourceId), nothing to create
    if (!resourceId) {
      return { request_limit_id: null };
    }

    // Skip if already created
    if (createdRequestLimitIdRef.current === resourceId) {
      return { request_limit_id: resourceId };
    }

    try {
      // Find requests_per_day from request_limits array
      const requestLimitObj = allRequestLimits.find((rl) => rl.id === resourceId);
      if (requestLimitObj?.requests_per_day !== null && requestLimitObj?.requests_per_day !== undefined) {
        await createRequestLimitsAction({
          body: {
            group_id: group_id,
            requests_per_day: requestLimitObj.requests_per_day,
            mcp: false,
          },
        });
        createdRequestLimitIdRef.current = resourceId;
        return { request_limit_id: resourceId };
      }
      return { request_limit_id: null };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create request limit resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

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

  const requestLimitPickerItems = useMemo<RequestLimitPickerItem[]>(() => {
    return [
      { id: UNLIMITED_REQUEST_ID, requests_per_day: null },
      ...requestLimitChoices,
    ];
  }, [requestLimitChoices]);

  const selectedRequestLimit = useMemo(() => {
    if (!resourceId) {
      return { id: UNLIMITED_REQUEST_ID, requests_per_day: null };
    }
    return (
      requestLimitChoices.find((item) => item.id === resourceId) ?? {
        id: resourceId,
        requests_per_day: null,
      }
    );
  }, [resourceId, requestLimitChoices]);

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;

      if (!selectedId || selectedId === UNLIMITED_REQUEST_ID) {
        onRequestLimitIdChange(null);
        return;
      }

      // Create resource for newly selected request limit - only when autosave is enabled
      if (
        isAutosaveEnabled &&
        selectedId &&
        selectedId !== resourceId &&
        createRequestLimitsAction &&
        create_tool_id &&
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
      create_tool_id,
      group_id,
      allRequestLimits,
      isAutosaveEnabled,
    ]
  );
  const createRequestLimit = useCallback(
    async (value: number) => {
      if (!createRequestLimitsAction || !create_tool_id || !group_id) {
        return null;
      }
      try {
        const result = await createRequestLimitsAction({
          body: {
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
    [create_tool_id, group_id, createRequestLimitsAction]
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

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, accept: acceptAi, reject: rejectAi } = useResourceAi({
    resourceType: "request_limits",
    groupId: group_id,
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion?.id;
  const aiSuggestedIds = useMemo(
    () => new Set(aiSuggestion?.id ? [aiSuggestion.id] : []),
    [aiSuggestion]
  );

  // Accept AI suggestion - set AI-suggested request limit
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    onRequestLimitIdChange(aiSuggestion.id);
    acceptAi();
  }, [aiSuggestion, onRequestLimitIdChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

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
            {onGenerate && showAiGenerate && create_tool_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onGenerate}
                      disabled={disabled || aiIsGenerating || showDiff}
                    >
                      {aiIsGenerating ? (
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
            {showDiff && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-success hover:text-success"
                        onClick={handleAccept}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Accept</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={handleReject}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reject</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
          <GenericPicker<RequestLimitPickerItem>
            items={requestLimitPickerItems}
            itemIds={requestLimitPickerItems.map((item) => item.id)}
            selectedIds={
              resourceId ? [resourceId] : [UNLIMITED_REQUEST_ID]
            }
            onSelect={handleSelect}
            multiSelect={false}
            getId={(item) => item.id}
            getLabel={(item) =>
              item.requests_per_day === null
                ? "Unlimited"
                : `${item.requests_per_day} requests/day`
            }
            getSearchText={(item) =>
              item.requests_per_day === null
                ? "Unlimited no limit"
                : `${item.requests_per_day} requests/day ${item.id}`
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
      {/* AI-suggested request limits preview */}
      {showDiff && aiSuggestion && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Request Limit</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              className={cn(
                "p-3 rounded-lg border-2 border-success bg-success/10",
                "text-sm"
              )}
            >
              {aiSuggestion.requests_per_day !== null && aiSuggestion.requests_per_day !== undefined
                ? `${aiSuggestion.requests_per_day} requests/day`
                : "Unlimited"}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {selectedRequestLimit.requests_per_day === null ? (
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
              aiSuggestedIds.has(resourceId ?? "") && "ring-2 ring-success bg-success/10",
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
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (disabled) return;
              onRequestLimitIdChange(selectedRequestLimit.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (disabled) return;
                onRequestLimitIdChange(selectedRequestLimit.id);
              }
            }}
            className={cn(
              "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all",
              "hover:shadow-md hover:bg-accent/50",
              "ring-2 ring-primary bg-accent",
              aiSuggestedIds.has(selectedRequestLimit.id) && "ring-2 ring-success bg-success/10",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            {aiSuggestedIds.has(selectedRequestLimit.id) && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success text-success-foreground text-xs rounded">
                AI Suggested
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {selectedRequestLimit.requests_per_day} requests/day
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedRequestLimit.requests_per_day} requests per day
              </p>
            </div>
            {!aiSuggestedIds.has(selectedRequestLimit.id) && (
              <Check className="absolute right-3 top-3 h-4 w-4 opacity-100" />
            )}
          </div>
        )}
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
