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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftEndpointsIn = InputOf<"/api/v4/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v4/resources/endpoints", "post">;

// Derive resource item type from the GET endpoint response
type EndpointGetResponse = OutputOf<"/api/v4/resources/endpoints/get", "post">;
export type EndpointResourceItem = NonNullable<EndpointGetResponse["items"]>[number];

export interface EndpointItem {
  id: string;
  name: string;
  description?: string;
}

export interface EndpointsProps {
  endpoint_ids?: string[]; // Current endpoint resource IDs (standardized prop name)
  endpoint_resources?: EndpointResourceItem[]; // Selected endpoint resources (each includes generated field)
  show_endpoints?: boolean; // Whether to show this resource picker
  endpoint_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  endpoints?: EndpointResourceItem[]; // All available endpoints from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update endpoint_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createEndpointsAction?:
    | ((input: CreateDraftEndpointsIn) => Promise<CreateDraftEndpointsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ endpoints_id: string | null } | void>) => void;
  // AI diff view props
  aiEndpointResources?: Pick<EndpointResourceItem, "id" | "base_url">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  searchTerm,
  onSearchChange,
  group_id,
  create_tool_id,
  createEndpointsAction,
  onGenerate,
  isGenerating: _isGenerating = false,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props (deprecated — kept for interface compat)
  aiEndpointResources: _aiEndpointResources,
  onAccept: _onAccept,
  onReject: _onReject,
}: EndpointsProps) {
  const ids = useMemo(() => endpoint_ids ?? [], [endpoint_ids]);
  const show = show_endpoints ?? false;
  const allEndpoints = useMemo(() => endpoints ?? [], [endpoints]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<{
    id: string | null;
    base_url: string | null;
  }>({
    resourceType: "endpoints",
    groupId: group_id,
    extractSuggestion: (data) => {
      const id = data.id as string | null | undefined;
      const base_url = data.base_url as string | null | undefined;
      if (!id) return null;
      return { id, base_url: base_url ?? null };
    },
    accumulate: true,
  });
  const suggestionsList = useMemo(
    () => endpoint_suggestions ?? [],
    [endpoint_suggestions]
  );
  const filteredEndpoints = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allEndpoints;
    }
    const term = searchTerm.toLowerCase();
    return allEndpoints.filter((endpoint) => {
      const baseUrl = endpoint.base_url?.toLowerCase() ?? "";
      return baseUrl.includes(term);
    });
  }, [allEndpoints, searchTerm]);

  // Track which endpoint IDs have already had resources created
  const createdEndpointIdsRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ endpoints_id: string | null } | void>) | undefined>(undefined);

  // Initialize createdEndpointIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdEndpointIdsRef.current.add(id));
  }, [ids]);

  // Convert endpoints array to EndpointItem format for GenericPicker
  const endpointItems = useMemo(() => {
    return filteredEndpoints
      .filter((e) => e.id && e.base_url) // Filter out nulls
      .map((e) => ({
        id: e.id!,
        name: e.base_url!,
      }));
  }, [filteredEndpoints]);

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

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ endpoints_id: string | null } | void> => {
    // Skip if no action available
    if (!createEndpointsAction || !group_id) {
      return;
    }

    // Endpoints are typically generated, not manually created
    // Return null as there's nothing to flush
    return { endpoints_id: null };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Check if any endpoint resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return endpoint_resources?.some((e) => e.generated) ?? false;
  }, [endpoint_resources]);

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((e) => e.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Accept AI suggestion - add AI-suggested endpoints to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((e) => e.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    acceptAi();
  }, [aiSuggestions, ids, onChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

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
      {/* AI-suggested endpoints preview */}
      {showDiff && aiSuggestions.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Endpoints</p>
          <div className="space-y-2">
            {aiSuggestions.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.base_url || ""}
              </div>
            ))}
          </div>
        </div>
      )}
      <GenericPicker<EndpointItem>
        items={endpointItems}
        itemIds={filteredEndpoints
          .map((e) => e.id)
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
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
