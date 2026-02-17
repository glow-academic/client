/**
 * ArgsOutputs.tsx
 * Component for editing args_outputs Jinja templates
 * Follows SchemaOutput.tsx pattern - manages own state, calls save actions directly
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftArgsOutputsIn = InputOf<"/api/v4/resources/args_outputs", "post">;
type CreateDraftArgsOutputsOut = OutputOf<
  "/api/v4/resources/args_outputs",
  "post"
>;

// Derive resource item type from the GET endpoint response
type ArgsOutputsGetResponse = OutputOf<"/api/v4/resources/args_outputs/get", "post">;
export type ArgsOutputsResourceItem = NonNullable<ArgsOutputsGetResponse["items"]>[number];

export interface ArgsOutputsDetail {
  args_outputs_id: string;
  args_id: string;
  name: string;
  template: string;
  generated: boolean;
}

export interface ArgsFieldDetail {
  args_id: string;
  name: string;
  description: string;
  field_type: string;
  required: boolean;
  default_value: string;
  generated: boolean;
}

export interface ArgsOutputsProps {
  args_outputs_ids: string[]; // From Tool.tsx formState - which args_outputs are selected
  output_args_outputs: ArgsOutputsDetail[]; // From API - detailed args_outputs data for selected args_outputs_ids
  input_args_fields: ArgsFieldDetail[]; // From API - for Jinja variable autocomplete/reference
  disabled: boolean; // Based on can_edit flag from Tool.tsx
  // Note: args_outputs_ids selection is managed by Tool.tsx in separate "args_outputs" step
  // This component only edits args_outputs within selected args_outputs_ids
  createArgsOutputsAction?:
    | ((input: CreateDraftArgsOutputsIn) => Promise<CreateDraftArgsOutputsOut>)
    | undefined;
  group_id?: string | null; // Group ID for resource creation
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  // Component handles args_outputs changes internally and calls createArgsOutputsAction
  // No onChange callback needed - component manages its own state like SchemaOutput
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ args_outputs_id: string | null } | void>) => void;
  aiArgsOutputsResources?: Pick<ArgsOutputsResourceItem, "id" | "name">[] | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
}

export function ArgsOutputs({
  args_outputs_ids,
  output_args_outputs,
  input_args_fields,
  disabled = false,
  createArgsOutputsAction,
  group_id,
  create_tool_id,
  isAutosaveEnabled = true,
  registerFlush,
  aiArgsOutputsResources: _aiArgsOutputsResources,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
}: ArgsOutputsProps) {
  // Get available Jinja variables from input args fields
  const availableVariables = useMemo(() => {
    return input_args_fields.map((field) => field.name);
  }, [input_args_fields]);

  // Create a map of args by id for displaying which arg each output belongs to
  const argsMap = useMemo(() => {
    const map = new Map<string, ArgsFieldDetail>();
    input_args_fields.forEach((field) => {
      map.set(field.args_id, field);
    });
    return map;
  }, [input_args_fields]);

  // Group args_outputs by args_id
  const outputsByArgs = useMemo(() => {
    const grouped: Record<string, ArgsOutputsDetail[]> = {};
    output_args_outputs.forEach((output) => {
      const argsId = output.args_id;
      if (!grouped[argsId]) {
        grouped[argsId] = [];
      }
      grouped[argsId]!.push(output);
    });
    // Sort outputs within each args_id by name
    Object.keys(grouped).forEach((argsId) => {
      const outputs = grouped[argsId];
      if (outputs) {
        grouped[argsId] = outputs.sort((a, b) => a.name.localeCompare(b.name));
      }
    });
    return grouped;
  }, [output_args_outputs]);

  // Internal state for args_outputs names
  const [outputNames, setOutputNames] = useState<Record<string, string>>({});
  const nameDebounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastSavedNamesRef = useRef<Record<string, string>>({});
  const isNameInitialMountRef = useRef(true);

  // Initialize output names from props
  useEffect(() => {
    if (isNameInitialMountRef.current) {
      const initialNames: Record<string, string> = {};
      output_args_outputs.forEach((output) => {
        initialNames[output.args_outputs_id] = output.name;
      });
      setOutputNames(initialNames);
      lastSavedNamesRef.current = initialNames;
      isNameInitialMountRef.current = false;
    }
  }, [output_args_outputs]);

  // Sync output names when props change
  useEffect(() => {
    const newNames: Record<string, string> = {};
    let hasChanges = false;
    output_args_outputs.forEach((output) => {
      const currentName = lastSavedNamesRef.current[output.args_outputs_id];
      if (!currentName || currentName !== output.name) {
        newNames[output.args_outputs_id] = output.name;
        hasChanges = true;
      } else {
        newNames[output.args_outputs_id] = currentName;
      }
    });
    if (hasChanges) {
      setOutputNames(newNames);
      lastSavedNamesRef.current = newNames;
    }
  }, [output_args_outputs]);

  // Internal state for args_outputs templates (Jinja content)
  const [outputTemplates, setOutputTemplates] = useState<
    Record<string, string>
  >({});
  const templateDebounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastSavedTemplatesRef = useRef<Record<string, string>>({});
  const isTemplateInitialMountRef = useRef(true);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ args_outputs_id: string | null } | void>) | undefined>(undefined);

  // Initialize output templates from props
  useEffect(() => {
    if (isTemplateInitialMountRef.current) {
      const initialTemplates: Record<string, string> = {};
      output_args_outputs.forEach((output) => {
        initialTemplates[output.args_outputs_id] = output.template;
      });
      setOutputTemplates(initialTemplates);
      lastSavedTemplatesRef.current = initialTemplates;
      isTemplateInitialMountRef.current = false;
    }
  }, [output_args_outputs]);

  // Sync output templates when props change
  useEffect(() => {
    const newTemplates: Record<string, string> = {};
    let hasChanges = false;
    output_args_outputs.forEach((output) => {
      const currentTemplate =
        lastSavedTemplatesRef.current[output.args_outputs_id];
      if (!currentTemplate || currentTemplate !== output.template) {
        newTemplates[output.args_outputs_id] = output.template;
        hasChanges = true;
      } else {
        newTemplates[output.args_outputs_id] = currentTemplate;
      }
    });
    if (hasChanges) {
      setOutputTemplates(newTemplates);
      lastSavedTemplatesRef.current = newTemplates;
    }
  }, [output_args_outputs]);

  // Debounced save function for output name (creates new args_outputs resource)
  const saveOutputName = useCallback(
    async (outputId: string, name: string) => {
      if (!createArgsOutputsAction || !create_tool_id || !group_id) return;

      const output = output_args_outputs.find(
        (o) => o.args_outputs_id === outputId
      );
      if (!output) return;

      try {
        // Create new args_outputs resource with updated name (write-only pattern)
        await createArgsOutputsAction({
          body: {
            group_id: group_id,
            args_id: output.args_id,
            name: name,
            template: outputTemplates[outputId] ?? output.template,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        lastSavedNamesRef.current[outputId] = name;
        // Note: The new args_outputs will need to be linked to the tool via tool_args_outputs junction table
        // This happens when Tool.tsx saves with the new args_outputs_id
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create args_outputs:", error);
      }
    },
    [
      createArgsOutputsAction,
      output_args_outputs,
      create_tool_id,
      group_id,
      outputTemplates,
    ]
  );

  // Debounced save function for output template (creates new args_outputs resource)
  const saveOutputTemplate = useCallback(
    async (outputId: string, template: string) => {
      if (!createArgsOutputsAction || !create_tool_id || !group_id) return;

      const output = output_args_outputs.find(
        (o) => o.args_outputs_id === outputId
      );
      if (!output) return;

      try {
        // Create new args_outputs resource with updated template (write-only pattern)
        await createArgsOutputsAction({
          body: {
            group_id: group_id,
            args_id: output.args_id,
            name: outputNames[outputId] ?? output.name,
            template: template,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        lastSavedTemplatesRef.current[outputId] = template;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create args_outputs:", error);
      }
    },
    [
      createArgsOutputsAction,
      output_args_outputs,
      create_tool_id,
      group_id,
      outputNames,
    ]
  );

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ args_outputs_id: string | null } | void> => {
    // Skip if no action available
    if (!createArgsOutputsAction || !group_id) {
      return;
    }

    // Flush all pending name changes
    for (const outputId of Object.keys(outputNames)) {
      const currentName = outputNames[outputId];
      const lastSavedName = lastSavedNamesRef.current[outputId];
      if (currentName && currentName !== lastSavedName) {
        await saveOutputName(outputId, currentName);
      }
    }

    // Flush all pending template changes
    for (const outputId of Object.keys(outputTemplates)) {
      const currentTemplate = outputTemplates[outputId];
      const lastSavedTemplate = lastSavedTemplatesRef.current[outputId];
      if (currentTemplate && currentTemplate !== lastSavedTemplate) {
        await saveOutputTemplate(outputId, currentTemplate);
      }
    }

    // Return null since ArgsOutputs manages multiple outputs, not a single resource ID
    return { args_outputs_id: null };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Handle output name change with debouncing
  const handleOutputNameChange = useCallback(
    (outputId: string, name: string) => {
      setOutputNames((prev) => ({
        ...prev,
        [outputId]: name,
      }));

      // Skip autosave if disabled (manual save mode)
      if (!isAutosaveEnabled) {
        return;
      }

      // Clear existing timer for this output
      if (nameDebounceTimerRef.current[outputId]) {
        clearTimeout(nameDebounceTimerRef.current[outputId]);
      }

      // Set new timer (500ms debounce)
      nameDebounceTimerRef.current[outputId] = setTimeout(() => {
        const lastSaved = lastSavedNamesRef.current[outputId];
        // Only save if value actually changed
        if (!lastSaved || lastSaved !== name) {
          saveOutputName(outputId, name);
        }
      }, 500);
    },
    [saveOutputName, isAutosaveEnabled]
  );

  // Handle output template change with debouncing
  const handleOutputTemplateChange = useCallback(
    (outputId: string, template: string) => {
      setOutputTemplates((prev) => ({
        ...prev,
        [outputId]: template,
      }));

      // Skip autosave if disabled (manual save mode)
      if (!isAutosaveEnabled) {
        return;
      }

      // Clear existing timer for this output
      if (templateDebounceTimerRef.current[outputId]) {
        clearTimeout(templateDebounceTimerRef.current[outputId]);
      }

      // Set new timer (500ms debounce)
      templateDebounceTimerRef.current[outputId] = setTimeout(() => {
        const lastSaved = lastSavedTemplatesRef.current[outputId];
        // Only save if value actually changed
        if (!lastSaved || lastSaved !== template) {
          saveOutputTemplate(outputId, template);
        }
      }, 500);
    },
    [saveOutputTemplate, isAutosaveEnabled]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(nameDebounceTimerRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      Object.values(templateDebounceTimerRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: _aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "args_outputs",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;

  // Accept AI suggestion - add AI-suggested args_outputs names
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    // For ArgsOutputs, we accept the suggested output names by updating internal state
    const newOutputNames: Record<string, string> = { ...outputNames };
    aiSuggestions.forEach((aiOutput) => {
      if (aiOutput.id && aiOutput.name) {
        newOutputNames[aiOutput.id] = aiOutput.name;
      }
    });
    setOutputNames(newOutputNames);
    clearAi();
  }, [aiSuggestions, outputNames, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if no args_outputs selected
  if (args_outputs_ids.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No args_outputs selected. Select args_outputs in the "Args Outputs" step
        to edit them.
      </div>
    );
  }

  // Don't render if no outputs
  if (output_args_outputs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No args_outputs found for selected args_outputs_ids.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with AI diff controls */}
      {showDiff && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">Args Outputs</Label>
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
        </div>
      )}

      {/* AI-suggested args_outputs preview */}
      {showDiff && aiSuggestions.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Args Outputs</p>
          <div className="space-y-2">
            {aiSuggestions.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.name || ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available variables reference */}
      {availableVariables.length > 0 && (
        <div className="rounded-md border p-4 bg-muted/50">
          <Label className="text-sm font-medium mb-2">
            Available Jinja Variables (from Input Args)
          </Label>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <code
                key={variable}
                className="text-xs px-2 py-1 rounded bg-background border"
              >
                {`{{ ${variable} }}`}
              </code>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use these variables in template fields below. Variables reference
            input arg names.
          </p>
        </div>
      )}

      {/* Args_outputs grouped by args_id */}
      {Object.entries(outputsByArgs).map(([argsId, outputs]) => {
        const arg = argsMap.get(argsId);
        const argName = arg?.name || argsId.slice(0, 8) + "...";
        return (
          <div key={argsId} className="border rounded-md p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Outputs for Arg: {argName}
              </Label>
              {arg?.description && (
                <p className="text-sm text-muted-foreground">
                  {arg.description}
                </p>
              )}
            </div>
            <div className="space-y-4">
              {outputs.map((output) => {
                const outputName =
                  outputNames[output.args_outputs_id] ?? output.name;
                const outputTemplate =
                  outputTemplates[output.args_outputs_id] ?? output.template;
                return (
                  <div
                    key={output.args_outputs_id}
                    className="border rounded p-4 space-y-3 bg-muted/30"
                  >
                    {/* Output Name */}
                    <div className="space-y-2">
                      <Label htmlFor={`${output.args_outputs_id}-name`}>
                        Output Name
                      </Label>
                      <Input
                        id={`${output.args_outputs_id}-name`}
                        value={outputName}
                        onChange={(e) =>
                          handleOutputNameChange(
                            output.args_outputs_id,
                            e.target.value
                          )
                        }
                        disabled={disabled}
                        placeholder="Output name"
                      />
                    </div>

                    {/* Template (Jinja) */}
                    <div className="space-y-2">
                      <Label htmlFor={`${output.args_outputs_id}-template`}>
                        Template (Jinja)
                      </Label>
                      <Textarea
                        id={`${output.args_outputs_id}-template`}
                        value={outputTemplate}
                        onChange={(e) =>
                          handleOutputTemplateChange(
                            output.args_outputs_id,
                            e.target.value
                          )
                        }
                        disabled={disabled}
                        placeholder={`{{ ${argName} }}`}
                        rows={4}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Jinja template that transforms input arguments into this
                        output's value. Use variables from input args:{" "}
                        {availableVariables
                          .slice(0, 5)
                          .map((v) => `{{ ${v} }}`)
                          .join(", ")}
                        {availableVariables.length > 5 && "..."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
