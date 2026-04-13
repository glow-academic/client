/**
 * Names.tsx
 * Resource component for name input fields
 * Header-style input with optional AI generate button
 * Pure UI component that reports value changes upward via onNameChange
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface NameResourceItem {
  id?: string | null;
  name?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
}

export interface NamesProps {
  name_id?: string | null; // Current name_id (standardized prop name)
  name_resource?: NameResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_name?: boolean; // Whether to show this resource picker
  names?: NameResourceItem[]; // Array of name suggestion objects (for autocomplete)
  disabled?: boolean; // Based on can_edit flag
  onNameIdChange: (nameId: string | null) => void; // Update name_id in parent form state
  onGenerate?: () => Promise<void>;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  defaultName?: string; // Default name value (for header style - reverts to this on blur if empty)
  hideDescription?: boolean; // Hide the "Click to edit" description text (useful when parent provides description)
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  onNameChange?: (name: string) => void; // Report value changes upward
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
}

export function Names({
  _name_id,
  name_resource,
  show_name = true,
  names,
  disabled = false,
  onNameIdChange,
  onGenerate,
  placeholder = "Enter name",
  required = false,
  id = "name",
  "data-testid": dataTestId,
  defaultName,
  hideDescription = false,
  group_id,
  _create_tool_id,
  showAiGenerate = false,
  onNameChange,
  isAutosaveEnabled = true,
}: NamesProps) {
  const resource = name_resource ?? null;
  const show = show_name ?? true;
  const namesArray = useMemo(() => names ?? [], [names]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "names",
    groupId: group_id,
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion?.name;

  // Handle nullable resource properties
  const resourceName = resource?.name ?? null;
  const initialValue = resourceName || defaultName || "";
  const [internalValue, setInternalValue] = useState(initialValue);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert suggested names to name strings for autocomplete
  const suggestionNames = useMemo(() => {
    if (namesArray.length > 0) {
      return namesArray
        .filter((n) => n.suggested && n.name && n.name.trim() !== "")
        .map((n) => n.name!);
    }
    return [];
  }, [namesArray]);

  // Ghost autocomplete: find first prefix match and compute the untyped suffix
  const ghostMatch = useMemo(() => {
    const trimmed = internalValue.trim();
    if (!trimmed) return null;
    const valueLower = trimmed.toLowerCase();
    return suggestionNames.find((s) => {
      const sLower = s.toLowerCase();
      return sLower.startsWith(valueLower) && sLower !== valueLower;
    }) ?? null;
  }, [suggestionNames, internalValue]);

  const ghostSuffix = ghostMatch ? ghostMatch.slice(internalValue.length) : "";

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
      isInitialMountRef.current = false;
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

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    onNameChange?.(newValue);
  }, [onNameChange]);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && ghostSuffix && ghostMatch) {
        e.preventDefault();
        // Cancel any pending create debounce
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        setInternalValue(ghostMatch);
        lastSavedValueRef.current = ghostMatch;

        // Look up the existing resource ID from the suggestion
        const matchedName = namesArray.find(
          (n) => n.name?.toLowerCase() === ghostMatch.toLowerCase()
        );
        if (matchedName?.id) {
          onNameIdChange(matchedName.id);
        }
      }
    },
    [ghostSuffix, ghostMatch, namesArray, onNameIdChange]
  );

  // Accept AI suggestion - update internal value and notify parent
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const text = aiSuggestion.name || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    onNameIdChange(aiSuggestion.id);
    clearAi();
  }, [aiSuggestion, onNameIdChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_name is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Get the display value for sizing
  // When input has value, measure that; otherwise measure placeholder
  const displayValue = internalValue || defaultName || "";

  // AI suggestion text
  const aiName = aiSuggestion?.name || "";

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
              {(internalValue || "") + ghostSuffix || displayValue || "\u00A0"}
            </span>
            <input
              ref={inputRef}
              type="text"
              id={id}
              data-testid={dataTestId}
              value={internalValue || ""}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || defaultName || "Enter name"}
              required={required}
              disabled={disabled}
              size={1}
              className="col-start-1 row-start-1 w-full min-w-0 text-2xl font-semibold border-none outline-none bg-transparent px-2 py-0.5 hover:bg-muted/50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
            />
            {ghostSuffix && !disabled && (
              <span
                aria-hidden="true"
                className="col-start-1 row-start-1 pointer-events-none whitespace-pre text-2xl font-semibold px-2 py-0.5"
              >
                <span className="invisible">{internalValue}</span>
                <span className="text-muted-foreground/40">{ghostSuffix}</span>
              </span>
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
                  disabled={disabled || aiIsGenerating || showDiff}
                >
                  {aiIsGenerating ? (
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
