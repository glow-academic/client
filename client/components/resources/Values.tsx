/**
 * Values.tsx
 * Resource component for value input
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftValuesIn = InputOf<"/api/v4/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v4/resources/values", "post">;

// Derive resource item type from the GET endpoint response
type ValueGetResponse = OutputOf<"/api/v4/resources/values/get", "post">;
export type ValueResourceItem = NonNullable<ValueGetResponse["items"]>[number];

export interface ValuesProps {
  value_ids?: string[]; // Current value resource IDs (wrapped singular for compat)
  value_resources?: ValueResourceItem[]; // Selected value resources
  show_values?: boolean;
  value_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  values?: ValueResourceItem[]; // All available values (for autocomplete)
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
  createValuesAction?:
    | ((input: CreateDraftValuesIn) => Promise<CreateDraftValuesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save */
  registerFlush?: (flush: () => Promise<{ values_id: string | null } | void>) => void;
  aiValueResources?: Pick<ValueResourceItem, "id" | "value">[] | null;
}

export function Values({
  value_ids,
  value_resources,
  show_values = false,
  value_suggestions,
  values,
  disabled = false,
  onChange,
  label = "Value",
  id = "value",
  required = false,
  placeholder = "Enter value",
  description,
  group_id,
  create_tool_id,
  createValuesAction,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
}: ValuesProps) {
  // Treat as single-value (callers wrap singular id into array)
  const resourceId = value_ids?.[0] ?? null;
  const resource = value_resources?.[0] ?? null;
  const show = show_values ?? false;
  const suggestionsList = useMemo(
    () => value_suggestions ?? [],
    [value_suggestions]
  );
  const valuesArray = useMemo(() => values ?? [], [values]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "values",
    groupId: group_id,
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion?.value;

  // Handle nullable resource properties
  const resourceValue = resource?.value ?? null;
  const initialValue = resourceValue || "";
  const [internalValue, setInternalValue] = useState(initialValue);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ values_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ values_id: string | null } | void> => {
    if (!createValuesAction || !group_id) {
      return;
    }

    // Skip if no change AND we already have a resource
    if (internalValue === lastSavedValueRef.current && resourceId) {
      return { values_id: resourceId };
    }

    try {
      if (internalValue.trim()) {
        const result = await createValuesAction({
          body: {
            group_id: group_id,
            value: internalValue,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        if (result.values_id) {
          onChange([result.values_id]);
          lastSavedValueRef.current = internalValue;
          return { values_id: result.values_id };
        }
      } else {
        onChange([]);
        lastSavedValueRef.current = internalValue;
        return { values_id: null };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create value resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert value_suggestions UUIDs to value strings for autocomplete
  const suggestionValues = useMemo(() => {
    if (valuesArray.length > 0) {
      return suggestionsList
        .map((id) => {
          const obj = valuesArray.find((v) => v.id === id);
          return obj?.value ?? null;
        })
        .filter((val): val is string => val !== null && val.trim() !== "");
    }
    if (resource?.value && suggestionsList.includes(resource.id ?? "")) {
      return [resource.value];
    }
    return [];
  }, [suggestionsList, valuesArray, resource]);

  // Ghost autocomplete: find first prefix match and compute the untyped suffix
  const ghostMatch = useMemo(() => {
    const trimmed = internalValue.trim();
    if (!trimmed) return null;
    const valueLower = trimmed.toLowerCase();
    return suggestionValues.find((s) => {
      const sLower = s.toLowerCase();
      return sLower.startsWith(valueLower) && sLower !== valueLower;
    }) ?? null;
  }, [suggestionValues, internalValue]);

  const ghostSuffix = ghostMatch ? ghostMatch.slice(internalValue.length) : "";

  // Update internal value when resource changes
  useEffect(() => {
    if (resourceValue) {
      if (internalValue !== resourceValue) {
        setInternalValue(resourceValue);
      }
      lastSavedValueRef.current = resourceValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceValue]);

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
    if (!createValuesAction) return;

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
  }, [internalValue, createValuesAction, isAutosaveEnabled]);

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

  // Check if any value resource is generated
  const hasGenerated = useMemo(() => {
    return resource?.generated ?? false;
  }, [resource]);

  // Accept AI suggestion
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const text = aiSuggestion.value || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    onChange([aiSuggestion.id]);
    clearAi();
  }, [aiSuggestion, onChange, clearAi]);

  // Reject AI suggestion
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_values is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // AI suggestion text
  const aiValue = aiSuggestion?.value || "";

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
            {aiValue}
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
