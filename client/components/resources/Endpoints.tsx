/**
 * Endpoints.tsx
 * Resource component for endpoint input
 * Text input with ghost autocomplete for suggestions
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftEndpointsIn = InputOf<"/api/v5/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v5/resources/endpoints", "post">;

// Derive resource item type from the GET endpoint response
type EndpointGetResponse = OutputOf<"/api/v5/resources/endpoints/get", "post">;
export type EndpointResourceItem = NonNullable<EndpointGetResponse["items"]>[number];

export interface EndpointsProps {
  endpoint_ids?: string[]; // Current endpoint resource IDs (wrapped singular for compat)
  endpoint_resources?: EndpointResourceItem[]; // Selected endpoint resources
  show_endpoints?: boolean;
  endpoint_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  endpoints?: EndpointResourceItem[]; // All available endpoints (for autocomplete)
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null;
  create_tool_id?: string | null;
  createEndpointsAction?:
    | ((input: CreateDraftEndpointsIn) => Promise<CreateDraftEndpointsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save */
  registerFlush?: (flush: () => Promise<{ endpoints_id: string | null } | void>) => void;
  aiEndpointResources?: Pick<EndpointResourceItem, "id" | "base_url">[] | null;
}

export function Endpoints({
  endpoint_ids,
  endpoint_resources,
  show_endpoints = false,
  endpoint_suggestions,
  endpoints,
  disabled = false,
  onChange,
  label = "Endpoint",
  id = "endpoint",
  required = false,
  placeholder = "Enter endpoint URL",
  description,
  group_id,
  create_tool_id,
  createEndpointsAction,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
}: EndpointsProps) {
  // Treat as single-value (callers wrap singular id into array)
  const resourceId = endpoint_ids?.[0] ?? null;
  const resource = endpoint_resources?.[0] ?? null;
  const show = show_endpoints ?? false;
  const suggestionsList = useMemo(
    () => endpoint_suggestions ?? [],
    [endpoint_suggestions]
  );
  const endpointsArray = useMemo(() => endpoints ?? [], [endpoints]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "endpoints",
    groupId: group_id,
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion?.base_url;

  // Handle nullable resource properties
  const resourceBaseUrl = resource?.base_url ?? null;
  const initialValue = resourceBaseUrl || "";
  const [internalValue, setInternalValue] = useState(initialValue);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ endpoints_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ endpoints_id: string | null } | void> => {
    if (!createEndpointsAction || !group_id) {
      return;
    }

    // Skip if no change AND we already have a resource
    if (internalValue === lastSavedValueRef.current && resourceId) {
      return { endpoints_id: resourceId };
    }

    try {
      if (internalValue.trim()) {
        const result = await createEndpointsAction({
          body: {
            group_id: group_id,
            base_url: internalValue,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        if (result.endpoints_id) {
          onChange([result.endpoints_id]);
          lastSavedValueRef.current = internalValue;
          return { endpoints_id: result.endpoints_id };
        }
      } else {
        onChange([]);
        lastSavedValueRef.current = internalValue;
        return { endpoints_id: null };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create endpoint resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert endpoint_suggestions UUIDs to base_url strings for autocomplete
  const suggestionBaseUrls = useMemo(() => {
    if (endpointsArray.length > 0) {
      return suggestionsList
        .map((id) => {
          const obj = endpointsArray.find((e) => e.id === id);
          return obj?.base_url ?? null;
        })
        .filter((url): url is string => url !== null && url.trim() !== "");
    }
    if (resource?.base_url && suggestionsList.includes(resource.id ?? "")) {
      return [resource.base_url];
    }
    return [];
  }, [suggestionsList, endpointsArray, resource]);

  // Ghost autocomplete: find first prefix match and compute the untyped suffix
  const ghostMatch = useMemo(() => {
    const trimmed = internalValue.trim();
    if (!trimmed) return null;
    const valueLower = trimmed.toLowerCase();
    return suggestionBaseUrls.find((s) => {
      const sLower = s.toLowerCase();
      return sLower.startsWith(valueLower) && sLower !== valueLower;
    }) ?? null;
  }, [suggestionBaseUrls, internalValue]);

  const ghostSuffix = ghostMatch ? ghostMatch.slice(internalValue.length) : "";

  // Update internal value when resource changes
  useEffect(() => {
    if (resourceBaseUrl) {
      if (internalValue !== resourceBaseUrl) {
        setInternalValue(resourceBaseUrl);
      }
      lastSavedValueRef.current = resourceBaseUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceBaseUrl]);

  // Track pending changes (for manual save mode only)
  useEffect(() => {
    if (isAutosaveEnabled) return;
    if (isInitialMountRef.current) return;

    const hasPendingChanges = internalValue !== lastSavedValueRef.current;
    if (hasPendingChanges) {
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: true } })
      );
    }
  }, [internalValue, isAutosaveEnabled]);

  // Debounced resource creation - only when autosave is enabled
  useEffect(() => {
    if (!isAutosaveEnabled) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    if (internalValue === lastSavedValueRef.current) return;
    if (!createEndpointsAction) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createEndpointsAction, isAutosaveEnabled]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && ghostSuffix) {
        e.preventDefault();
        setInternalValue(ghostMatch!);
      }
    },
    [ghostSuffix, ghostMatch]
  );

  // Check if any endpoint resource is generated
  const hasGenerated = useMemo(() => {
    return resource?.generated ?? false;
  }, [resource]);

  // Accept AI suggestion
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const text = aiSuggestion.base_url || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    onChange([aiSuggestion.id]);
    clearAi();
  }, [aiSuggestion, onChange, clearAi]);

  // Reject AI suggestion
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_endpoints is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // AI suggestion text
  const aiBaseUrl = aiSuggestion?.base_url || "";

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
      )}
      {showDiff ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border">
          <span className="text-sm text-destructive line-through opacity-70">
            {internalValue || "Empty"}
          </span>
          <span className="text-sm text-success">
            {aiBaseUrl}
          </span>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={id}
            type="text"
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={cn(ghostSuffix && "pr-0")}
          />
          {ghostSuffix && !disabled && (
            <div className="absolute inset-0 pointer-events-none flex items-center px-3">
              <span className="invisible text-sm">{internalValue}</span>
              <span className="text-sm text-muted-foreground/40">{ghostSuffix}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
