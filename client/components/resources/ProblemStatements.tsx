/**
 * ProblemStatements.tsx
 * Resource component for problem statement input fields
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftProblemStatementsIn = InputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;
type CreateDraftProblemStatementsOut = OutputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;

export interface ProblemStatementsProps {
  problem_statement_id?: string | null; // Current problem_statement_id (standardized prop name)
  problem_statement_resource?: {
    id: string | null;
    problem_statement: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_problem_statement?: boolean; // Whether to show this resource picker
  problem_statement_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  problem_statements?: Array<{
    id: string | null;
    problem_statement: string | null;
    generated?: boolean | null;
  }>; // Array of problem statement suggestion objects (for autocomplete)
  disabled?: boolean; // Based on can_edit flag
  onProblemStatementIdChange: (problemStatementId: string | null) => void; // Update problem_statement_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  defaultProblemStatement?: string; // Default problem statement value (for header style - reverts to this on blur if empty)
  hideDescription?: boolean; // Hide the "Click to edit" description text (useful when parent provides description)
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createProblemStatementsAction?:
    | ((
        input: CreateDraftProblemStatementsIn
      ) => Promise<CreateDraftProblemStatementsOut>)
    | undefined;
}

export function ProblemStatements({
  problem_statement_id,
  problem_statement_resource,
  show_problem_statement = true,
  problem_statement_suggestions,
  problem_statements,
  disabled = false,
  onProblemStatementIdChange,
  onGenerate,
  isGenerating = false,
  placeholder = "Enter problem statement",
  required = false,
  id = "problem_statement",
  "data-testid": dataTestId,
  defaultProblemStatement,
  hideDescription = false,
  group_id,
  agent_id,
  createProblemStatementsAction,
}: ProblemStatementsProps) {
  const resource = problem_statement_resource ?? null;
  const resourceId = problem_statement_id ?? null;
  const show = show_problem_statement ?? true;
  const suggestionsList = useMemo(
    () => problem_statement_suggestions ?? [],
    [problem_statement_suggestions]
  );
  const problemStatementsArray = useMemo(
    () => problem_statements ?? [],
    [problem_statements]
  );

  // Handle nullable resource properties
  const resourceProblemStatement = resource?.problem_statement ?? null;
  const initialValue =
    resourceProblemStatement || defaultProblemStatement || "";
  const [internalValue, setInternalValue] = useState(initialValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number>(300); // Default min width
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert problem_statement_suggestions UUIDs to problem statement strings for autocomplete
  const suggestionProblemStatements = useMemo(() => {
    if (problemStatementsArray.length > 0) {
      // Use problem_statements array to map UUIDs to problem statement strings
      return suggestionsList
        .map((id) => {
          const psObj = problemStatementsArray.find((ps) => ps.id === id);
          return psObj?.problem_statement ?? null;
        })
        .filter((ps): ps is string => ps !== null && ps.trim() !== "");
    }
    // Fallback: if we have problem_statement_resource and it matches a suggestion, use it
    if (
      resource?.problem_statement &&
      suggestionsList.includes(resource.id ?? "")
    ) {
      return [resource.problem_statement];
    }
    return [];
  }, [suggestionsList, problemStatementsArray, resource]);

  // Simple prefix/substring matching for autocomplete filtering
  const filteredSuggestions = useMemo(() => {
    if (!internalValue.trim()) return suggestionProblemStatements;
    const valueLower = internalValue.toLowerCase().trim();
    return suggestionProblemStatements
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        // Skip exact matches
        if (sLower === valueLower) return false;
        // Include if starts with or contains the typed text
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5); // Show top 5 matches
  }, [suggestionProblemStatements, internalValue]);

  // Measure text width and update input width dynamically
  useEffect(() => {
    if (measureRef.current) {
      // Use scrollWidth for more accurate measurement
      const textWidth = measureRef.current.scrollWidth;
      // Add padding (px-2 = 8px on each side = 16px total)
      const padding = 16;
      const minWidth = 50; // Much smaller minimum to allow text-width matching
      setInputWidth(Math.max(textWidth + padding, minWidth));
    }
  }, [internalValue, placeholder, defaultProblemStatement]);

  // Update internal value when problem_statement_resource changes
  useEffect(() => {
    if (resourceProblemStatement) {
      setInternalValue(resourceProblemStatement);
      lastSavedValueRef.current = resourceProblemStatement;
    } else if (defaultProblemStatement && !resourceProblemStatement) {
      // If no resource problem statement but defaultProblemStatement exists, use defaultProblemStatement
      setInternalValue(defaultProblemStatement);
      lastSavedValueRef.current = defaultProblemStatement;
    }
  }, [resourceProblemStatement, defaultProblemStatement]);

  // Debounced resource creation
  useEffect(() => {
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
    if (!createProblemStatementsAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        if (internalValue.trim() && agent_id && group_id) {
          const result = await createProblemStatementsAction({
            body: {
              agent_id: agent_id,
              group_id: group_id,
              problem_statement: internalValue,
              mcp: false,
            },
          });
          if (result.problem_statement_id) {
            onProblemStatementIdChange(result.problem_statement_id);
          }
        } else {
          // Clear resource ID if value is empty
          onProblemStatementIdChange(null);
        }
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create problem statement resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    internalValue,
    createProblemStatementsAction,
    onProblemStatementIdChange,
    agent_id,
    group_id,
  ]);

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
      // If value equals defaultProblemStatement, select all text on focus
      if (
        defaultProblemStatement &&
        e.target.value === defaultProblemStatement
      ) {
        e.target.select();
      }
    },
    [defaultProblemStatement]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // If empty on blur and defaultProblemStatement exists, revert to defaultProblemStatement
      if (
        defaultProblemStatement &&
        (!e.target.value || e.target.value.trim() === "")
      ) {
        setInternalValue(defaultProblemStatement);
        lastSavedValueRef.current = defaultProblemStatement;
      }
    },
    [defaultProblemStatement]
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

  // Don't render if show_problem_statement is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Get the display value for measurement
  // When input has value, measure that; otherwise measure placeholder
  const displayValue =
    internalValue ||
    placeholder ||
    defaultProblemStatement ||
    "Enter problem statement";

  return (
    <div className="flex-1 items-end">
      <div className="flex items-end gap-1">
        {/* Hidden span to measure text width - positioned off-screen but in normal flow */}
        <span
          ref={measureRef}
          className="absolute text-2xl font-semibold whitespace-pre"
          style={{
            visibility: "hidden",
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
          }}
          aria-hidden="true"
        >
          {displayValue || "\u00A0"}
        </span>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            id={id}
            data-testid={dataTestId}
            value={internalValue || ""}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={
              placeholder ||
              defaultProblemStatement ||
              "Enter problem statement"
            }
            required={required}
            disabled={disabled}
            style={{ width: `${inputWidth}px` }}
            className="text-2xl font-semibold border-none outline-none bg-transparent px-2 py-0.5 hover:bg-muted/50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
          />
          {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
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
        {onGenerate && agent_id && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onGenerate}
                  disabled={disabled || isGenerating}
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
      </div>
      {!hideDescription && (
        <p className="text-xs text-muted-foreground mt-1 px-2">
          {internalValue === defaultProblemStatement || !internalValue
            ? "Click to edit"
            : "Click to edit"}
        </p>
      )}
    </div>
  );
}
