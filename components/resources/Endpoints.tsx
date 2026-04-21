/**
 * Endpoints.tsx
 * Resource component for endpoint input
 * Text input with ghost autocomplete for suggestions
 * Pure UI: data in, IDs out via onChange
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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface EndpointResourceItem {
  id?: string | null;
  base_url?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
  selected?: boolean | null;
}

export interface EndpointsProps {
  endpoint_ids?: string[]; // Current endpoint resource IDs (wrapped singular for compat)
  endpoint_resources?: EndpointResourceItem[]; // Selected endpoint resources
  show_endpoints?: boolean;
  endpoints?: EndpointResourceItem[]; // All available endpoints (for autocomplete)
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  endpoint?: string | null;
  onEndpointChange?: (value: string | null) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Endpoints({
  endpoint_ids,
  endpoint_resources,
  show_endpoints = false,
  endpoints,
  disabled = false,
  onChange,
  endpoint,
  onEndpointChange,
  label = "Endpoint",
  id = "endpoint",
  required = false,
  placeholder = "Enter endpoint URL",
  description,
}: EndpointsProps) {
  // Treat as single-value (callers wrap singular id into array)
  const resourceId = endpoint_ids?.[0] ?? null;
  const resource = endpoint_resources?.[0] ?? null;
  const show = show_endpoints ?? false;
  const endpointsArray = useMemo<EndpointResourceItem[]>(() => endpoints ?? [], [endpoints]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItem = useMemo(() => {
    return endpointsArray.find((e) => e.pending && e.id) ?? null;
  }, [endpointsArray]);
  const showDiff = !!pendingItem;
  const pendingIds = useMemo(
    () => new Set(pendingItem?.id ? [pendingItem.id] : []),
    [pendingItem]
  );

  // Handle nullable resource properties
  const resourceBaseUrl = resource?.base_url ?? null;
  const initialValue = endpoint ?? resourceBaseUrl ?? "";
  const [internalValue, setInternalValue] = useState(initialValue);

  const lastSavedValueRef = useRef<string>(initialValue);
  // Dirty flag: once the user interacts, stop syncing from server data so
  // their in-progress edits aren't clobbered (same pattern as Descriptions.tsx).
  const isDirtyRef = useRef(false);

  // Derive suggestion base_url strings from endpoints with suggested=true
  const suggestionBaseUrls = useMemo(() => {
    return endpointsArray
      .filter((item) => item.suggested && item.base_url)
      .map((item) => item.base_url!.trim())
      .filter((item) => item.length > 0);
  }, [endpointsArray]);

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

  // Update internal value when resource changes. Skip while user is editing.
  useEffect(() => {
    if (isDirtyRef.current) return;
    if (endpoint != null) {
      if (internalValue !== endpoint) {
        setInternalValue(endpoint);
      }
      lastSavedValueRef.current = endpoint;
      return;
    }
    if (resourceBaseUrl) {
      if (internalValue !== resourceBaseUrl) {
        setInternalValue(resourceBaseUrl);
      }
      lastSavedValueRef.current = resourceBaseUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceBaseUrl, endpoint]);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      isDirtyRef.current = newValue !== lastSavedValueRef.current;
      onEndpointChange?.(newValue);
    },
    [onEndpointChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && ghostSuffix) {
        e.preventDefault();
        const nextValue = ghostMatch!;
        setInternalValue(nextValue);
        lastSavedValueRef.current = nextValue;
        isDirtyRef.current = false;
        const matchedResource = endpointsArray.find(
          (item) => item.base_url?.toLowerCase() === nextValue.toLowerCase()
        );
        if (matchedResource?.id) {
          onChange([matchedResource.id]);
          onEndpointChange?.(null);
        } else {
          onEndpointChange?.(nextValue);
        }
      }
    },
    [ghostSuffix, ghostMatch, endpointsArray, onChange, onEndpointChange]
  );

  // Accept pending — pending item is already in ids, just confirm (no-op)
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending IDs from selection
  const handleReject = useCallback(() => {
    const currentIds = resourceId ? [resourceId] : [];
    const newIds = currentIds.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [resourceId, pendingIds, onChange]);

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
          className={cn(
            ghostSuffix && "pr-0",
            showDiff && "ring-2 ring-success bg-success/10"
          )}
        />
        {showDiff && (
          <div className="absolute top-1 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
            Pending
          </div>
        )}
        {ghostSuffix && !disabled && !showDiff && (
          <div className="absolute inset-0 pointer-events-none flex items-center px-3">
            <span className="invisible text-sm">{internalValue}</span>
            <span className="text-sm text-muted-foreground/40">{ghostSuffix}</span>
          </div>
        )}
      </div>
    </div>
  );
}
