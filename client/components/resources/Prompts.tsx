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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Eye } from "lucide-react";
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

export interface PromptsProps {
  prompt_id?: string | null; // Current prompt_id (standardized prop name)
  prompt_resource?: {
    id: string | null;
    system_prompt: string | null;
    name: string | null;
    description: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_prompts?: boolean; // Whether to show this resource picker
  prompt_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  prompts?: Array<{
    prompt_id: string | null;
    system_prompt: string | null;
    name: string | null;
    description: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    department_ids?: string[] | null;
    can_delete?: boolean | null;
    generated?: boolean | null;
  }>; // Array of all available prompt options
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
  agent_id?: string | null; // Agent ID for resource creation
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
  agent_id,
  createPromptsAction,
  // Legacy props for backward compatibility
  promptResource,
  promptId: _promptId,
  suggestions: _suggestions,
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

  // Track prompt content in local state
  const [promptContent, setPromptContent] = useState<string>(
    resource?.system_prompt || ""
  );
  const [editorMode, setEditorMode] = useState<"editor" | "preview">("editor");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
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
      const selectedPrompt = prompts.find((p) => p.prompt_id === resourceId);
      if (selectedPrompt?.system_prompt !== undefined) {
        setPromptContent(selectedPrompt.system_prompt || "");
        lastSavedContentRef.current = selectedPrompt.system_prompt || "";
      }
    }
  }, [resource?.system_prompt, resourceId, prompts]);

  // Debounced resource creation/update
  useEffect(() => {
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
    debounceTimerRef.current = setTimeout(async () => {
      try {
        if (!agent_id || !group_id) {
          return;
        }

        // If we have a resourceId, update existing prompt; otherwise create new
        const result = await createPromptsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            system_prompt: promptContent,
            name: resource?.name || "Untitled Prompt",
            description: resource?.description || "",
            mcp: false,
            ...(resourceId ? { prompt_id: resourceId } : {}),
          },
        });

        if (result && typeof result === "object" && "prompt_id" in result) {
          const newPromptId = (result as { prompt_id?: string | null })
            .prompt_id;
          if (newPromptId && newPromptId !== resourceId) {
            // New prompt created, update parent
            onPromptIdChange(newPromptId);
          }
        }
        lastSavedContentRef.current = promptContent;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create/update prompt resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    promptContent,
    createPromptsAction,
    agent_id,
    group_id,
    resourceId,
    resource?.name,
    resource?.description,
    onPromptIdChange,
  ]);

  const handlePromptSelect = (selectedPromptId: string | null) => {
    if (selectedPromptId && prompts) {
      const selectedPrompt = prompts.find(
        (p) => p.prompt_id === selectedPromptId
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
    () => import("@/components/common/chat/markdown/MarkdownRenderer"),
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
            getId={(item) => item.prompt_id || ""}
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
                {item.department_ids && item.department_ids.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Departments: {item.department_ids.length}
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
          {renderEditorContent()}
        </div>
        {helpText && (
          <p className="text-sm text-muted-foreground">{helpText}</p>
        )}
      </div>
    </div>
  );
}
