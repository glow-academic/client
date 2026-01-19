/**
 * ProblemStatements.tsx
 * Resource component for problem statement input fields
 * Header-style input with optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const resourceProblemStatement = resource?.problem_statement ?? "";
  const initialValue =
    resourceProblemStatement || defaultProblemStatement || "";
  const [internalValue, setInternalValue] = useState(initialValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);
  const saveSeqRef = useRef(0);
  const isDirtyRef = useRef(false);
  const lastServerTextRef = useRef<string>(initialValue);

  // Update internal value when problem_statement_resource changes
  useEffect(() => {
    const serverValue = resourceProblemStatement || defaultProblemStatement || "";
    if (serverValue === lastServerTextRef.current) return;
    if (!isDirtyRef.current) {
      setInternalValue(serverValue);
      lastSavedValueRef.current = serverValue;
    }
    lastServerTextRef.current = serverValue;
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
      const seq = ++saveSeqRef.current;
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
          if (seq !== saveSeqRef.current) return;
          if (result.problem_statement_id) {
            onProblemStatementIdChange(result.problem_statement_id);
          }
        } else {
          if (seq !== saveSeqRef.current) return;
          // Clear resource ID if value is empty
          onProblemStatementIdChange(null);
        }
        lastSavedValueRef.current = internalValue;
        isDirtyRef.current = false;
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
    isDirtyRef.current = newValue !== lastSavedValueRef.current;
  }, []);

  // Use problem_statements array if available, otherwise create placeholder mapping
  const suggestionsMapping = useMemo(() => {
    if (problemStatementsArray.length > 0) {
      const mapping: Record<string, { id: string; problem_statement: string }> =
        {};
      problemStatementsArray.forEach((ps) => {
        if (ps.id) {
          mapping[ps.id] = {
            id: ps.id,
            problem_statement:
              ps.problem_statement ||
              `Problem statement ${ps.id.slice(0, 8)}...`,
          };
        }
      });
      return mapping;
    }
    const mapping: Record<string, { id: string; problem_statement: string }> =
      {};
    suggestionsList.forEach((suggestionId) => {
      mapping[suggestionId] = {
        id: suggestionId,
        problem_statement: `Problem statement ${suggestionId.slice(0, 8)}...`,
      };
    });
    return mapping;
  }, [problemStatementsArray, suggestionsList]);

  const pickerItems: Array<{
    id: string | null;
    problem_statement: string | null;
    generated?: boolean | null;
  }> = useMemo(() => {
    if (problemStatementsArray.length > 0) {
      return problemStatementsArray;
    }
    return Object.values(suggestionsMapping);
  }, [problemStatementsArray, suggestionsMapping]);

  const problemStatementsById = useMemo(() => {
    const mapping: Record<string, string> = {};
    problemStatementsArray.forEach((ps) => {
      if (ps.id && ps.problem_statement) {
        mapping[ps.id] = ps.problem_statement;
      }
    });
    return mapping;
  }, [problemStatementsArray]);

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

  // Don't render if show_problem_statement is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <Input
          id={id}
          data-testid={dataTestId}
          value={internalValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder || defaultProblemStatement || ""}
          required={required}
          disabled={disabled}
        />
        <GenericPicker
          items={pickerItems}
          selectedIds={resourceId ? [resourceId] : []}
          onSelect={(ids) => {
            const selectedId = ids[0] || null;
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            saveSeqRef.current += 1;
            if (selectedId) {
              const nextValue = problemStatementsById[selectedId] ?? "";
              setInternalValue(nextValue);
              lastSavedValueRef.current = nextValue;
              lastServerTextRef.current = nextValue;
            } else {
              setInternalValue("");
              lastSavedValueRef.current = "";
              lastServerTextRef.current = "";
            }
            isDirtyRef.current = false;
            onProblemStatementIdChange(selectedId);
          }}
          getId={(item) => {
            if (typeof item === "string") {
              return item;
            }
            return item.id || "";
          }}
          getLabel={(
            item: { id: string | null; problem_statement: string | null } | string
          ) => {
            if (typeof item === "string") {
              return `Problem statement ${item.slice(0, 8)}...`;
            }
            const ps = item.problem_statement;
            const id = item.id;
            if (ps && typeof ps === "string") return ps;
            if (id && typeof id === "string")
              return `Problem statement ${id.slice(0, 8)}...`;
            return "Problem statement";
          }}
          getSearchText={(
            item: { id: string | null; problem_statement: string | null } | string
          ) => {
            if (typeof item === "string") {
              return `Problem statement ${item.slice(0, 8)}... ${item}`;
            }
            const ps = item.problem_statement;
            const id = item.id;
            const psStr = ps && typeof ps === "string" ? ps : "";
            const idStr = id && typeof id === "string" ? id : "";
            return `${psStr} ${idStr}`;
          }}
          placeholder="Problem statements"
          disabled={disabled}
          multiSelect={false}
          compact={true}
          buttonClassName="h-8"
          showLabel={false}
        />
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
