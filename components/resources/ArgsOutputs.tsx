/**
 * ArgsOutputs.tsx
 * Component for editing args_outputs Jinja templates
 * Pure UI: receives data arrays + selected IDs, reports changes via onChange
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ArgsOutputsResourceItem {
  id?: string | null;
  name?: string | null;
}

export interface ArgsOutputsDetail {
  args_outputs_id: string;
  args_id: string;
  name: string;
  template: string;
  generated: boolean;
  pending?: boolean | null;
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
  /** Callback to update args_outputs_ids in parent (used for reject pending) */
  onArgsOutputsIdsChange?: (ids: string[]) => void;
}

export function ArgsOutputs({
  args_outputs_ids,
  output_args_outputs,
  input_args_fields,
  disabled = false,
  onArgsOutputsIdsChange,
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
  const lastSavedTemplatesRef = useRef<Record<string, string>>({});
  const isTemplateInitialMountRef = useRef(true);

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

  // Handle output name change
  const handleOutputNameChange = useCallback(
    (outputId: string, name: string) => {
      setOutputNames((prev) => ({
        ...prev,
        [outputId]: name,
      }));
    },
    []
  );

  // Handle output template change
  const handleOutputTemplateChange = useCallback(
    (outputId: string, template: string) => {
      setOutputTemplates((prev) => ({
        ...prev,
        [outputId]: template,
      }));
    },
    []
  );

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return output_args_outputs.filter((o) => o.pending && o.args_outputs_id);
  }, [output_args_outputs]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((o) => o.args_outputs_id).filter(Boolean)),
    [pendingItems]
  );

  // Accept pending — keep pending items in selection (no-op, they're already included)
  const handleAccept = useCallback(() => {
    // Pending items are already in args_outputs_ids (selected=true), just confirm
    // The next draft save will persist them as active
  }, []);

  // Reject pending — remove pending items from selection
  const handleReject = useCallback(() => {
    if (!onArgsOutputsIdsChange) return;
    const newIds = args_outputs_ids.filter((id) => !pendingIds.has(id));
    onArgsOutputsIdsChange(newIds);
  }, [args_outputs_ids, pendingIds, onArgsOutputsIdsChange]);

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
      {/* Header with pending accept/reject controls */}
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
                const isPending = pendingIds.has(output.args_outputs_id);
                return (
                  <div
                    key={output.args_outputs_id}
                    className={cn(
                      "relative border rounded p-4 space-y-3 bg-muted/30",
                      isPending && "ring-2 ring-success bg-success/10"
                    )}
                  >
                    {/* Pending badge */}
                    {isPending && (
                      <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                        Pending
                      </div>
                    )}

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
