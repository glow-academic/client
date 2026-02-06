/**
 * ProblemStatements.tsx
 * Resource component for problem statement input fields
 * Header-style input with optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftProblemStatementsIn = InputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;
type CreateDraftProblemStatementsOut = OutputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;

// Word-based diff types and utilities
type DiffSegment = { type: "same" | "removed" | "added"; text: string };

function computeDiff(oldText: string, newText: string): DiffSegment[] {
  // Split text into words while preserving whitespace
  const splitWords = (text: string): string[] => {
    const result: string[] = [];
    let current = "";
    for (const char of text) {
      if (/\s/.test(char)) {
        if (current) {
          result.push(current);
          current = "";
        }
        result.push(char);
      } else {
        current += char;
      }
    }
    if (current) result.push(current);
    return result;
  };

  const oldWords = splitWords(oldText);
  const newWords = splitWords(newText);

  // Simple LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to find diff
  const segments: DiffSegment[] = [];
  let i = m, j = n;
  const tempSegments: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      tempSegments.push({ type: "same", text: oldWords[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      tempSegments.push({ type: "added", text: newWords[j - 1]! });
      j--;
    } else {
      tempSegments.push({ type: "removed", text: oldWords[i - 1]! });
      i--;
    }
  }

  // Reverse and merge consecutive segments of same type
  tempSegments.reverse();
  for (const seg of tempSegments) {
    if (segments.length > 0 && segments[segments.length - 1]!.type === seg.type) {
      segments[segments.length - 1]!.text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}

// Inline DiffView component
function DiffView({
  current,
  proposed,
  rows,
}: {
  current: string;
  proposed: string;
  rows: number;
}) {
  const segments = useMemo(() => computeDiff(current, proposed), [current, proposed]);

  return (
    <div
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "whitespace-pre-wrap overflow-auto"
      )}
      style={{ minHeight: `${rows * 1.5}rem` }}
    >
      {segments.map((seg, i) => (
        <span
          key={i}
          className={cn(
            seg.type === "removed" && "bg-destructive/20 text-destructive line-through",
            seg.type === "added" && "bg-success/20 text-success"
          )}
        >
          {seg.text}
        </span>
      ))}
    </div>
  );
}

export interface ProblemStatementsProps {
  problem_statement_id?: string | null; // Current problem_statement_id (standardized prop name)
  problem_statement_resource?: {
    id?: string | null;
    problem_statement_id?: string | null;
    name?: string | null;
    problem_statement?: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_problem_statement?: boolean; // Whether to show this resource picker
  problem_statement_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  problem_statements?: Array<{
    id?: string | null;
    problem_statement_id?: string | null;
    name?: string | null;
    problem_statement?: string | null;
    generated?: boolean | null;
  }>; // Array of problem statement suggestion objects (for autocomplete)
  disabled?: boolean; // Based on can_edit flag
  onProblemStatementIdChange: (problemStatementId: string | null) => void; // Update problem_statement_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  id?: string;
  "data-testid"?: string;
  defaultProblemStatement?: string; // Default problem statement value (for header style - reverts to this on blur if empty)
  hideDescription?: boolean; // Legacy prop (no-op)
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  createProblemStatementsAction?:
    | ((
        input: CreateDraftProblemStatementsIn
      ) => Promise<CreateDraftProblemStatementsOut>)
    | undefined;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  // AI diff view props
  aiResource?: {
    problem_statement_id?: string | null;
    name?: string | null;
    problem_statement?: string | null;
    generated?: boolean | null;
  } | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  label = "Problem Statement",
  placeholder = "Enter problem statement",
  required = false,
  rows = 4,
  id = "problem_statement",
  "data-testid": dataTestId,
  defaultProblemStatement,
  group_id,
  create_tool_id,
  link_tool_id,
  createProblemStatementsAction,
  searchTerm,
  onSearchChange,
  // AI diff view props
  aiResource,
  onAccept,
  onReject,
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
        if (internalValue.trim() && create_tool_id && group_id) {
          const result = await createProblemStatementsAction({
            body: {
              group_id: group_id,
              name: "",
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
    create_tool_id,
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

  const problemStatementsById = useMemo(() => {
    const mapping: Record<string, string> = {};
    problemStatementsArray.forEach((ps) => {
      if (ps.problem_statement) {
        // Map by problem_statement_id (API's primary key)
        if (ps.problem_statement_id) {
          mapping[ps.problem_statement_id] = ps.problem_statement;
        }
        // Also map by id for backwards compatibility
        if (ps.id) {
          mapping[ps.id] = ps.problem_statement;
        }
      }
    });
    return mapping;
  }, [problemStatementsArray]);

  // Update internal value when problem_statement_resource changes
  useEffect(() => {
    const resourceMatchesId =
      (resourceId && resource?.id && resourceId === resource.id) ||
      (resourceId === null &&
        (resource?.id === null || resource?.id === undefined));
    const resourceValue = resourceMatchesId ? resourceProblemStatement : "";
    const mappedValue = resourceId ? problemStatementsById[resourceId] : undefined;
    const hasServerValue =
      resourceValue !== "" || mappedValue !== undefined || resourceId === null;
    if (!hasServerValue) return;
    const serverValue =
      resourceValue !== ""
        ? resourceValue
        : mappedValue ?? defaultProblemStatement ?? "";
    if (serverValue === lastServerTextRef.current) return;
    if (!isDirtyRef.current) {
      setInternalValue(serverValue);
      lastSavedValueRef.current = serverValue;
    }
    lastServerTextRef.current = serverValue;
  }, [resourceProblemStatement, defaultProblemStatement, resourceId, problemStatementsById]);

  // Transform to ensure id and problem_statement are non-null for GenericPicker
  // API returns problem_statement_id, not id
  const pickerItems = useMemo(() => {
    if (problemStatementsArray.length > 0) {
      return problemStatementsArray
        .filter((ps) => (ps.problem_statement_id || ps.id) != null && ps.problem_statement != null)
        .map((ps) => ({
          id: (ps.problem_statement_id ?? ps.id)!,
          problem_statement: ps.problem_statement!,
          ...(ps.generated !== undefined ? { generated: ps.generated } : {}),
        }));
    }
    return Object.values(suggestionsMapping);
  }, [problemStatementsArray, suggestionsMapping]);

  // AI diff view state
  const showDiff = !!aiResource?.problem_statement;
  const currentText = internalValue || "";
  const aiText = aiResource?.problem_statement || "";

  // Accept AI suggestion - update internal value and notify parent
  const handleAccept = useCallback(() => {
    if (!aiResource?.problem_statement_id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    saveSeqRef.current += 1;
    const text = aiResource.problem_statement || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    lastServerTextRef.current = text;
    isDirtyRef.current = false;
    onProblemStatementIdChange(aiResource.problem_statement_id);
    onAccept?.();
  }, [aiResource, onProblemStatementIdChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_problem_statement is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {onGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
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
          {...(searchTerm ? { initialSearchTerm: searchTerm } : {})}
          {...(onSearchChange ? { onSearchChange } : {})}
        />
      </div>
      {/* Conditional: DiffView when AI suggestion pending, otherwise Textarea */}
      {showDiff ? (
        <DiffView current={currentText} proposed={aiText} rows={rows} />
      ) : (
        <Textarea
          id={id}
          data-testid={dataTestId}
          value={internalValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder || defaultProblemStatement || ""}
          required={required}
          disabled={disabled}
          rows={rows}
        />
      )}
    </div>
  );
}
