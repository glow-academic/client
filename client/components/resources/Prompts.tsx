/**
 * Prompts.tsx
 * Resource component for prompt selection and editing
 * Inline Monaco editor for prompt content editing
 * Creates resources independently and reports resource IDs to parent
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
import { Check, Eye, Loader2, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Dynamically import Monaco to avoid SSR issues
const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    </div>
  ),
});

type CreateDraftPromptsIn = InputOf<"/api/v4/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v4/resources/prompts", "post">;

// Derive resource item type from the GET endpoint response
type PromptsGetResponse = OutputOf<"/api/v4/resources/prompts/get", "post">;
export type PromptResourceItem = NonNullable<PromptsGetResponse["items"]>[number];

// Word-based diff types and utilities
type DiffSegment = { type: "same" | "removed" | "added"; text: string };

function computeDiff(oldText: string, newText: string): DiffSegment[] {
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
  const m = oldWords.length;
  const n = newWords.length;

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

function DiffView({ current, proposed }: { current: string; proposed: string }) {
  const segments = useMemo(() => computeDiff(current, proposed), [current, proposed]);

  return (
    <div
      className={cn(
        "min-h-[500px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "whitespace-pre-wrap overflow-auto font-mono"
      )}
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

export interface PromptsProps {
  prompt_id?: string | null; // Current prompt_id (standardized prop name)
  prompt_resource?: PromptResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_prompts?: boolean; // Whether to show this resource picker
  prompt_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  prompts?: PromptResourceItem[]; // Array of all available prompt options
  disabled?: boolean; // Based on can_edit flag
  onPromptIdChange: (promptId: string | null) => void; // Update prompt_id in parent form state
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createPromptsAction?:
    | ((input: CreateDraftPromptsIn) => Promise<CreateDraftPromptsOut>)
    | undefined;
  // Legacy props for backward compatibility
  promptResource?: {
    id: string;
    system_prompt: string;
    name: string;
    description: string;
    generated?: boolean | null;
  } | null;
  promptId?: string | null;
  suggestions?: string[];
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
    prompt_id?: string | null;
    system_prompt?: string | null;
    name?: string | null;
  } | null;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ prompt_id: string | null } | void>) => void;
}

export function Prompts({
  prompt_id,
  prompt_resource,
  show_prompts = true,
  prompt_suggestions: _prompt_suggestions,
  prompts,
  disabled = false,
  onPromptIdChange,
  label = "Prompt",
  placeholder = "Select a prompt",
  required = false,
  id = "prompt",
  "data-testid": dataTestId,
  helpText,
  searchTerm,
  onSearchChange,
  group_id,
  createPromptsAction,
  // Legacy props for backward compatibility
  promptResource,
  promptId: _promptId,
  suggestions: _suggestions,
  showAiGenerate = false,
  onGenerate,
  isAutosaveEnabled = true,
  registerFlush,
}: PromptsProps) {
  // Use standardized props with fallback to legacy props
  const resource = prompt_resource ?? promptResource ?? null;
  const resourceId = prompt_id ?? _promptId ?? null;

  // Use prompts array for GenericPicker items
  const pickerItems = useMemo(() => {
    if (prompts && prompts.length > 0) {
      return prompts;
    }
    return [];
  }, [prompts]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "prompts",
    groupId: group_id,
  });

  // AI diff view state
  const showDiff = !!aiSuggestion?.system_prompt;
  const aiText = aiSuggestion?.system_prompt || "";

  // Accept AI suggestion - update prompt content and notify parent
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.prompt_id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const text = aiSuggestion.system_prompt || "";
    setPromptContent(text);
    lastSavedContentRef.current = text;
    onPromptIdChange(aiSuggestion.prompt_id);
    clearAi();
  }, [aiSuggestion, onPromptIdChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Track prompt content in local state
  const [promptContent, setPromptContent] = useState<string>(
    resource?.system_prompt || ""
  );
  const [editorMode, setEditorMode] = useState<"editor" | "preview">("editor");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>(resource?.system_prompt || "");
  const isInitialMountRef = useRef(true);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ prompt_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ prompt_id: string | null } | void> => {
    // Skip if no action available
    if (!createPromptsAction || !group_id) {
      return;
    }

    // Skip if no change AND we already have a resource for this value
    if (promptContent === lastSavedContentRef.current && resourceId) {
      return { prompt_id: resourceId };
    }

    try {
      if (promptContent.trim()) {
        const result = await createPromptsAction({
          body: {
            group_id: group_id,
            system_prompt: promptContent,
            name: resource?.name || "Untitled Prompt",
            description: resource?.description || "",
            mcp: false,
            ...(resourceId ? { prompt_id: resourceId } : {}),
          },
        });
        if (result && typeof result === "object" && "prompt_id" in result) {
          const newPromptId = (result as { prompt_id?: string | null }).prompt_id;
          if (newPromptId) {
            if (newPromptId !== resourceId) {
              onPromptIdChange(newPromptId);
            }
            lastSavedContentRef.current = promptContent;
            return { prompt_id: newPromptId };
          }
        }
      } else {
        onPromptIdChange(null);
        lastSavedContentRef.current = promptContent;
        return { prompt_id: null };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create prompt resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Detect dark mode for Monaco editor
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setTheme("vs-dark");
    } else {
      setTheme("light");
    }
  }, []);

  // Update prompt content when resource or resourceId changes
  useEffect(() => {
    if (resource?.system_prompt !== undefined) {
      setPromptContent(resource.system_prompt || "");
      lastSavedContentRef.current = resource.system_prompt || "";
    } else if (resourceId && prompts) {
      // Find prompt by ID and load its content
      const selectedPrompt = prompts.find((p) => p.id === resourceId);
      if (selectedPrompt?.system_prompt !== undefined) {
        setPromptContent(selectedPrompt.system_prompt || "");
        lastSavedContentRef.current = selectedPrompt.system_prompt || "";
      }
    }
  }, [resource?.system_prompt, resourceId, prompts]);

  // Debounced resource creation/update - only when autosave is enabled
  useEffect(() => {
    // Skip if autosave is disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedContentRef.current = promptContent;
      return;
    }

    // Skip if content hasn't changed
    if (promptContent === lastSavedContentRef.current) {
      return;
    }

    // Skip if no action or empty content
    if (!createPromptsAction || !promptContent.trim()) {
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
  }, [
    promptContent,
    createPromptsAction,
    isAutosaveEnabled,
  ]);

  const handlePromptSelect = (selectedPromptId: string | null) => {
    if (selectedPromptId && prompts) {
      const selectedPrompt = prompts.find(
        (p) => p.id === selectedPromptId
      );
      if (selectedPrompt?.system_prompt !== undefined) {
        setPromptContent(selectedPrompt.system_prompt || "");
        lastSavedContentRef.current = selectedPrompt.system_prompt || "";
      }
    }
    onPromptIdChange(selectedPromptId);
  };

  const handlePromptContentChange = useCallback(
    (value: string) => {
      setPromptContent(value);
      // Clear prompt_id when editing, indicating new prompt
      if (resourceId) {
        onPromptIdChange(null);
      }
    },
    [resourceId, onPromptIdChange]
  );

  // Dynamically import markdown renderer to avoid SSR issues
  const MarkdownRenderer = dynamic(
    () =>
      import(
        "@/components/artifacts/attempt/chat/markdown/Markdown"
      ).then((mod) => ({
        default: ({ content }: { content: string }) => (
          <mod.default>{content}</mod.default>
        ),
      })),
    {
      ssr: false,
      loading: () => (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ),
    }
  );

  const renderEditorContent = useCallback(() => {
    if (editorMode === "preview") {
      return (
        <div className="w-full h-full border rounded-md p-4 overflow-auto">
          <MarkdownRenderer content={promptContent || ""} />
        </div>
      );
    }
    return (
      <div className="w-full h-full">
        <Monaco
          height="100%"
          defaultLanguage="markdown"
          value={promptContent || ""}
          onChange={(val) => handlePromptContentChange(val || "")}
          theme={theme}
          options={{
            readOnly: disabled,
            wordWrap: "on",
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderLineHighlight: "all",
            selectOnLineNumbers: true,
            roundedSelection: false,
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            placeholder:
              "System prompt that defines how the agent should behave and respond. You can use markdown formatting.",
          }}
        />
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode, promptContent, disabled, theme, handlePromptContentChange]);

  // Don't render if show_prompts is false (AFTER all hooks)
  if (show_prompts === false) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Prompt Selection */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {onGenerate && showAiGenerate && (
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
        {/* Preview button and GenericPicker */}
        <div className="flex items-center gap-2">
          {/* Preview icon button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={editorMode === "preview" ? "default" : "secondary"}
                  size="sm"
                  onClick={() =>
                    setEditorMode(
                      editorMode === "preview" ? "editor" : "preview"
                    )
                  }
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Preview</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* GenericPicker for version history */}
          <GenericPicker
            items={pickerItems}
            selectedIds={resourceId ? [resourceId] : []}
            onSelect={(ids) => handlePromptSelect(ids[0] || null)}
            multiSelect={false}
            getId={(item) => item.id || ""}
            getLabel={(item) =>
              item.name || item.system_prompt || "Unknown Prompt"
            }
            getSearchText={(item) =>
              `${item.name || ""} ${item.description || ""} ${item.system_prompt || ""}`.trim()
            }
            renderPreview={(item) => (
              <div className="space-y-1">
                <div className="font-medium">
                  {item.name || "Untitled Prompt"}
                </div>
                {item.description && (
                  <div className="text-sm text-muted-foreground">
                    {item.description}
                  </div>
                )}
                {item.system_prompt && (
                  <div className="text-xs text-muted-foreground max-w-md line-clamp-3">
                    {item.system_prompt}
                  </div>
                )}
              </div>
            )}
            placeholder={placeholder}
            disabled={disabled}
            compact={true}
            buttonClassName="h-8"
            showLabel={false}
            emptyMessage="No prompts available"
            groupHeading="Prompts"
            data-testid={dataTestId}
            {...(searchTerm ? { initialSearchTerm: searchTerm } : {})}
            {...(onSearchChange ? { onSearchChange } : {})}
          />
        </div>
      </div>

      {/* Prompt Editor */}
      <div className="space-y-2">
        <div className="h-[500px]" data-testid={`${dataTestId || id}-editor`}>
          {showDiff ? (
            <DiffView current={promptContent} proposed={aiText} />
          ) : (
            renderEditorContent()
          )}
        </div>
        {helpText && (
          <p className="text-sm text-muted-foreground">{helpText}</p>
        )}
      </div>
    </div>
  );
}
