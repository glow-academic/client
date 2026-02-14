/**
 * Names.tsx
 * Resource component for name input fields
 * Header-style input with optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSocket } from "@/contexts/socket-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;

// Derive resource item type from the GET endpoint response
type NamesGetResponse = OutputOf<"/api/v4/resources/names/get", "post">;
export type NameResourceItem = NonNullable<NamesGetResponse["items"]>[number];

export interface NamesProps {
  name_id?: string | null; // Current name_id (standardized prop name)
  name_resource?: NameResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_name?: boolean; // Whether to show this resource picker
  name_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  names?: NameResourceItem[]; // Array of name suggestion objects (for autocomplete)
  disabled?: boolean; // Based on can_edit flag
  onNameIdChange: (nameId: string | null) => void; // Update name_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  defaultName?: string; // Default name value (for header style - reverts to this on blur if empty)
  hideDescription?: boolean; // Hide the "Click to edit" description text (useful when parent provides description)
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createNamesAction?:
    | ((input: CreateDraftNamesIn) => Promise<CreateDraftNamesOut>)
    | undefined;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ name_id: string | null } | void>) => void;
  // Legacy props for backward compatibility
  nameResource?: {
    id: string;
    name: string;
    generated?: boolean | null;
  } | null;
  nameId?: string | null;
  suggestions?: string[];
  // AI diff view props
  aiResource?: { id?: string | null; name?: string | null } | null | undefined;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
}

export function Names({
  name_id,
  name_resource,
  show_name = true,
  name_suggestions,
  names,
  disabled = false,
  onNameIdChange,
  onGenerate,
  isGenerating = false,
  placeholder = "Enter name",
  required = false,
  id = "name",
  "data-testid": dataTestId,
  defaultName,
  hideDescription = false,
  group_id,
  create_tool_id,
  showAiGenerate = false,
  createNamesAction,
  isAutosaveEnabled = true,
  registerFlush,
  // Legacy props for backward compatibility
  nameResource,
  nameId: _nameId,
  suggestions,
  // AI diff view props
  aiResource,
  onAccept,
  onReject,
  onGenerationComplete,
}: NamesProps) {
  // Use standardized props with fallback to legacy props
  const resource = name_resource ?? nameResource ?? null;
  const resourceId = name_id ?? _nameId ?? null;
  const show = show_name ?? true;
  const suggestionsList = useMemo(
    () => name_suggestions ?? suggestions ?? [],
    [name_suggestions, suggestions]
  );
  const namesArray = useMemo(() => names ?? [], [names]);

  // Socket-based AI suggestion handling
  const { socket: aiSocket, isConnected: aiIsConnected } = useSocket();
  const [internalAiResource, setInternalAiResource] = useState<{
    id?: string | null;
    name?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!aiSocket || !aiIsConnected) return;
    const handleResourceComplete = (data: {
      group_id?: string;
      id?: string | null;
      name?: string | null;
    }) => {
      if (group_id && data.group_id !== group_id) return;
      setInternalAiResource({
        id: data.id ?? null,
        name: data.name ?? null,
      });
      onGenerationComplete?.();
    };
    aiSocket.on("names_generation_complete", handleResourceComplete);
    return () => {
      aiSocket.off("names_generation_complete", handleResourceComplete);
    };
  }, [aiSocket, aiIsConnected, group_id, onGenerationComplete]);

  // Effective AI resource: internal (socket) takes priority, then prop fallback
  const effectiveAiResource = internalAiResource ?? aiResource ?? null;

  // AI suggestion state
  const showDiff = !!effectiveAiResource?.name;

  // Handle nullable resource properties
  const resourceName = resource?.name ?? null;
  const initialValue = resourceName || defaultName || "";
  const [internalValue, setInternalValue] = useState(initialValue);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ name_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ name_id: string | null } | void> => {
    // Skip if no action available
    if (!createNamesAction || !group_id) {
      return;
    }

    // Skip if no change AND we already have a resource for this value
    if (internalValue === lastSavedValueRef.current && resourceId) {
      return { name_id: resourceId };
    }

    try {
      if (internalValue.trim()) {
        const result = await createNamesAction({
          body: {
            group_id: group_id,
            name: internalValue,
            mcp: false,
          },
        });
        if (result.name_id) {
          onNameIdChange(result.name_id);
          lastSavedValueRef.current = internalValue;
          return { name_id: result.name_id };
        }
      } else {
        onNameIdChange(null);
        lastSavedValueRef.current = internalValue;
        return { name_id: null };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create name resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert name_suggestions UUIDs to name strings for autocomplete
  const suggestionNames = useMemo(() => {
    if (namesArray.length > 0) {
      // Use names array to map UUIDs to name strings
      return suggestionsList
        .map((id) => {
          const nameObj = namesArray.find((n) => n.id === id);
          return nameObj?.name ?? null;
        })
        .filter((name): name is string => name !== null && name.trim() !== "");
    }
    // Fallback: if we have name_resource and it matches a suggestion, use it
    if (resource?.name && suggestionsList.includes(resource.id ?? "")) {
      return [resource.name];
    }
    return [];
  }, [suggestionsList, namesArray, resource]);

  // Simple prefix/substring matching for autocomplete filtering
  const filteredSuggestions = useMemo(() => {
    if (!internalValue.trim()) return suggestionNames;
    const valueLower = internalValue.toLowerCase().trim();
    return suggestionNames
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        // Skip exact matches
        if (sLower === valueLower) return false;
        // Include if starts with or contains the typed text
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5); // Show top 5 matches
  }, [suggestionNames, internalValue]);

  // Update internal value when name_resource changes
  useEffect(() => {
    if (resourceName) {
      // Only update if value actually changed to prevent unnecessary re-renders
      if (internalValue !== resourceName) {
        setInternalValue(resourceName);
      }
      lastSavedValueRef.current = resourceName;
    } else if (defaultName && !resourceName) {
      // If no resource name but defaultName exists, use defaultName
      // Only update if value actually changed
      if (internalValue !== defaultName) {
        setInternalValue(defaultName);
      }
      lastSavedValueRef.current = defaultName;
    }
    // Note: internalValue is intentionally NOT in deps - we only want to sync
    // when external resourceName/defaultName changes, not when user types
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceName, defaultName]);

  // Track and report pending changes (for manual save mode only)
  useEffect(() => {
    // Only report pending changes when autosave is disabled
    // When autosave is enabled, Persona.tsx handles the "saving" state directly
    if (isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      return;
    }

    const hasPendingChanges = internalValue !== lastSavedValueRef.current;
    if (hasPendingChanges) {
      // Notify save context that there are unsaved changes
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: true } })
      );
    }
  }, [internalValue, isAutosaveEnabled]);

  // Debounced resource creation - only when autosave is enabled
  useEffect(() => {
    // Skip if autosave is disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    // Skip if value hasn't changed
    if (internalValue === lastSavedValueRef.current) {
      return;
    }

    // Skip if no action
    if (!createNamesAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createNamesAction, isAutosaveEnabled]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    setShowSuggestions(true);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setInternalValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // If value equals defaultName, select all text on focus
      if (defaultName && e.target.value === defaultName) {
        e.target.select();
      }
    },
    [defaultName]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // If empty on blur and defaultName exists, revert to defaultName
      if (defaultName && (!e.target.value || e.target.value.trim() === "")) {
        setInternalValue(defaultName);
        lastSavedValueRef.current = defaultName;
      }
    },
    [defaultName]
  );

  const handleInputFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      handleFocus(e);
      if (internalValue && filteredSuggestions.length > 0) {
        setShowSuggestions(true);
      }
    },
    [internalValue, filteredSuggestions, handleFocus]
  );

  const handleInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      handleBlur(e);
      // Delay hiding suggestions to allow clicks
      setTimeout(() => setShowSuggestions(false), 200);
    },
    [handleBlur]
  );

  // Accept AI suggestion - update internal value and notify parent
  const handleAccept = useCallback(() => {
    if (!effectiveAiResource?.id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const text = effectiveAiResource.name || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    onNameIdChange(effectiveAiResource.id);
    onAccept?.();
    setInternalAiResource(null);
  }, [effectiveAiResource, onNameIdChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    setInternalAiResource(null);
    onReject?.();
  }, [onReject]);

  // Don't render if show_name is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Get the display value for sizing
  // When input has value, measure that; otherwise measure placeholder
  const displayValue = internalValue || defaultName || "";

  // AI suggestion text
  const aiName = effectiveAiResource?.name || "";

  return (
    <div className="flex-1 items-end">
      <div className="flex items-end gap-1">
        {showDiff ? (
          // Diff view: show current name with strikethrough and AI suggestion
          <div className="flex items-baseline gap-2 px-2 py-0.5">
            <span className="text-2xl font-semibold text-destructive line-through opacity-70">
              {internalValue || defaultName || "Untitled"}
            </span>
            <span className="text-2xl font-semibold text-success">
              {aiName}
            </span>
          </div>
        ) : (
          <div className="relative inline-grid grid-cols-[max-content] items-center">
            <span
              aria-hidden="true"
              className="col-start-1 row-start-1 invisible whitespace-pre text-2xl font-semibold px-2 py-0.5"
            >
              {displayValue || "\u00A0"}
            </span>
            <input
              ref={inputRef}
              type="text"
              id={id}
              data-testid={dataTestId}
              value={internalValue || ""}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={placeholder || defaultName || "Enter name"}
              required={required}
              disabled={disabled}
              size={1}
              className="col-start-1 row-start-1 w-full min-w-0 text-2xl font-semibold border-none outline-none bg-transparent px-2 py-0.5 hover:bg-muted/50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
            />
            {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 top-full z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
                <div className="p-1">
                  {filteredSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {onGenerate && showAiGenerate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onGenerate}
                  disabled={disabled || isGenerating || showDiff}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {resource?.generated ? "Regenerate" : "Generate"}
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
                    className="h-8 w-8 text-success hover:text-success"
                    onClick={handleAccept}
                  >
                    <Check className="h-4 w-4" />
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
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={handleReject}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
      {!hideDescription && (
        <p className="text-xs text-muted-foreground mt-1 px-2">
          {internalValue === defaultName || !internalValue
            ? "Click to edit"
            : "Click to edit"}
        </p>
      )}
    </div>
  );
}
