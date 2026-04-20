/**
 * Prompts.tsx
 * Resource component for prompt selection and editing
 * Inline Monaco editor for prompt content editing
 * Reports raw prompt data to parent form state; draft endpoint handles resource creation
 * Pure UI component: pending state drives accept/reject diff view
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

import { cn } from "@/lib/utils";
import { Check, Eye, X } from "lucide-react";
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


export interface PromptResourceItem {
  id?: string | null;
  prompt_id?: string | null;
  name?: string | null;
  description?: string | null;
  system_prompt?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

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
  prompt_id?: string | null;
  prompt_resource?: PromptResourceItem | null;
  show_prompts?: boolean;
  prompts?: PromptResourceItem[];
  disabled?: boolean;
  onPromptIdChange: (promptId: string | null) => void;
  /** Report raw prompt text to parent form state (like onNameChange for Names) */
  onPromptChange?: (prompt: { system_prompt: string; name: string; description: string } | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Prompts({
  prompt_id,
  prompt_resource,
  show_prompts = true,
  prompts,
  disabled = false,
  onPromptIdChange,
  onPromptChange,
  label = "Prompt",
  placeholder = "Select a prompt",
  required = false,
  id = "prompt",
  "data-testid": dataTestId,
  helpText,
  searchTerm,
  onSearchChange,
}: PromptsProps) {
  const resource = prompt_resource ?? null;
  const resourceId = prompt_id ?? null;

  // Use prompts array for GenericPicker items
  const pickerItems = useMemo(() => {
    if (prompts && prompts.length > 0) {
      return prompts;
    }
    return [];
  }, [prompts]);

  // Pending state: current resource has pending=true (soft draft, awaiting acceptance)
  const isPending = resource?.pending === true;
  const showDiff = isPending;
  const currentText = "";
  const pendingText = resource?.system_prompt || "";

  // Accept pending — confirm the pending resource
  const handleAccept = useCallback(() => {
    if (!resource?.id) return;
    const text = resource.system_prompt || "";
    setPromptContent(text);
    lastSavedContentRef.current = text;
    onPromptIdChange(resource.id);
  }, [resource, onPromptIdChange]);

  // Reject pending — remove the pending resource
  const handleReject = useCallback(() => {
    onPromptIdChange(null);
  }, [onPromptIdChange]);

  // Track prompt content in local state
  const [promptContent, setPromptContent] = useState<string>(
    resource?.system_prompt || ""
  );
  const [editorMode, setEditorMode] = useState<"editor" | "preview">("editor");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const lastSavedContentRef = useRef<string>(resource?.system_prompt || "");
  const isInitialMountRef = useRef(true);

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

  // Report prompt changes to parent form state (parent's draft autosave handles persistence)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedContentRef.current = promptContent;
      return;
    }

    if (promptContent === lastSavedContentRef.current) {
      return;
    }

    lastSavedContentRef.current = promptContent;

    if (onPromptChange) {
      if (promptContent.trim()) {
        onPromptChange({
          system_prompt: promptContent,
          name: resource?.name || "",
          description: resource?.description || "",
        });
      } else {
        onPromptChange(null);
      }
    }
  }, [promptContent, onPromptChange, resource?.name, resource?.description]);

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
        "@/components/common/markdown/Markdown"
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
            <div className="ring-2 ring-success rounded-md h-full">
              <DiffView current={currentText} proposed={pendingText} />
            </div>
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
