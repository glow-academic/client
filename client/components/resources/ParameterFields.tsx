/**
 * ParameterFields.tsx
 * Resource component for per-parameter field selection
 * Uses base fields list and creates parameter_fields_resource entries
 * Groups fields by parameter_id, similar to ScenarioFlags pattern
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftParameterFieldsIn = InputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftParameterFieldsOut = OutputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;

export interface ParameterFieldsProps {
  parameter_field_ids?: string[];
  parameter_field_resources?: Array<{
    id: string | null;
    field_id: string | null;
    parameter_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  show_parameter_fields?: boolean;
  parameter_fields?: Array<{
    id: string | null;
    field_id: string | null;
    parameter_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  parameter_ids?: string[];
  parameters?: Array<{
    parameter_id: string | null;
    name: string | null;
    description?: string | null;
  }>;
  parameter_resources?: Array<{
    parameter_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createParameterFieldsAction?:
    | ((
        input: CreateDraftParameterFieldsIn
      ) => Promise<CreateDraftParameterFieldsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

// Represents an available field option from parameter_fields_junction
type AvailableFieldOption = {
  field_id: string; // fields_resource.id (used to create parameter_fields_resource)
  parameter_id: string;
  name: string;
  description?: string;
};

export function ParameterFields({
  parameter_field_ids: _parameter_field_ids,
  parameter_field_resources,
  show_parameter_fields = false,
  parameter_fields,
  parameter_ids = [],
  parameters,
  parameter_resources,
  disabled = false,
  onChange,
  label = "Parameter Fields",
  id = "parameter_fields",
  required = false,
  description,
  group_id,
  agent_id,
  createParameterFieldsAction,
  onGenerate,
  isGenerating = false,
}: ParameterFieldsProps) {
  const show = show_parameter_fields ?? false;
  // Available fields from parameter_fields_junction (what user CAN select)
  const availableFields = useMemo(() => parameter_fields ?? [], [parameter_fields]);
  // Already selected/created parameter_fields_resource entries
  const selectedResources = useMemo(
    () => parameter_field_resources ?? [],
    [parameter_field_resources]
  );

  // Build parameter label map from parameters and parameter_resources
  const parameterLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    // Use full parameters list as base
    (parameters ?? []).forEach((param) => {
      if (param.parameter_id) {
        const name = param.name?.trim() || null;
        const desc = param.description?.trim() || null;
        if (name || desc) {
          map.set(param.parameter_id, name || desc || "Untitled parameter");
        }
      }
    });
    // Override with parameter_resources (server-confirmed data takes priority)
    (parameter_resources ?? []).forEach((param) => {
      if (param.parameter_id) {
        const name = param.name?.trim() || "";
        const descriptionText = param.description?.trim() || "";
        map.set(
          param.parameter_id,
          name || descriptionText || "Untitled parameter"
        );
      }
    });
    return map;
  }, [parameters, parameter_resources]);

  // Map: "parameterId:fieldId" → parameter_fields_resource.id (for already-selected fields)
  const selectedFieldKeyToResourceId = useMemo(() => {
    const map = new Map<string, string>();
    selectedResources.forEach((resource) => {
      if (resource.parameter_id && resource.field_id && resource.id) {
        const key = `${resource.parameter_id}:${resource.field_id}`;
        map.set(key, resource.id);
      }
    });
    return map;
  }, [selectedResources]);

  // Track parameter_fields_resource IDs to emit (starts from selected resources)
  const [resourceIds, setResourceIds] = useState<Map<string, string>>(new Map());
  // Track pending creations to prevent duplicates
  const creatingKeysRef = useRef<Set<string>>(new Set());

  // Initialize resourceIds from selected resources
  useEffect(() => {
    const nextResourceIds = new Map<string, string>();
    selectedResources.forEach((resource) => {
      if (resource.id) {
        nextResourceIds.set(resource.id, resource.id);
      }
    });
    setResourceIds(nextResourceIds);
  }, [selectedResources]);

  const emitAllIds = useCallback(
    (ids: Map<string, string>) => {
      onChange(Array.from(ids.values()));
    },
    [onChange]
  );

  const createParameterField = useCallback(
    async (parameterId: string, fieldId: string) => {
      if (!createParameterFieldsAction || !agent_id || !group_id) {
        return null;
      }
      const key = `${parameterId}:${fieldId}`;
      if (creatingKeysRef.current.has(key)) {
        return null;
      }
      creatingKeysRef.current.add(key);

      try {
        const result = await createParameterFieldsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            parameter_id: parameterId,
            field_id: fieldId,
            mcp: false,
          },
        });

        if (!result?.parameter_fields_id) {
          creatingKeysRef.current.delete(key);
          return null;
        }

        const resultId = result.parameter_fields_id as string;
        setResourceIds((prev) => {
          const next = new Map(prev);
          next.set(resultId, resultId);
          emitAllIds(next);
          return next;
        });
        return resultId;
      } catch {
        creatingKeysRef.current.delete(key);
        return null;
      }
    },
    [createParameterFieldsAction, agent_id, group_id, emitAllIds]
  );

  const handleToggle = useCallback(
    (option: AvailableFieldOption, checked: boolean) => {
      const key = `${option.parameter_id}:${option.field_id}`;
      const existingResourceId = selectedFieldKeyToResourceId.get(key);

      if (checked) {
        if (existingResourceId) {
          // Field was already selected, just add to tracking
          setResourceIds((prev) => {
            const next = new Map(prev);
            next.set(existingResourceId, existingResourceId);
            emitAllIds(next);
            return next;
          });
        } else {
          // Need to create a new parameter_fields_resource
          void createParameterField(option.parameter_id, option.field_id);
        }
      } else {
        // Remove from selection
        if (existingResourceId) {
          setResourceIds((prev) => {
            const next = new Map(prev);
            next.delete(existingResourceId);
            emitAllIds(next);
            return next;
          });
        }
      }
    },
    [selectedFieldKeyToResourceId, createParameterField, emitAllIds]
  );

  // Check if a field is currently selected
  const isFieldSelected = useCallback(
    (parameterId: string, fieldId: string): boolean => {
      const key = `${parameterId}:${fieldId}`;
      const resourceId = selectedFieldKeyToResourceId.get(key);
      return resourceId ? resourceIds.has(resourceId) : false;
    },
    [selectedFieldKeyToResourceId, resourceIds]
  );

  // Group available fields by parameter_id
  const fieldOptionsByParameter = useMemo(() => {
    const map = new Map<string, AvailableFieldOption[]>();

    availableFields
      .filter((field) => field.field_id && field.name && field.parameter_id)
      .forEach((field) => {
        const parameterId = field.parameter_id as string;
        if (!map.has(parameterId)) {
          map.set(parameterId, []);
        }
        map.get(parameterId)!.push({
          field_id: field.field_id as string,
          parameter_id: parameterId,
          name: field.name as string,
          description: field.description ?? "",
        });
      });

    return map;
  }, [availableFields]);

  const hasGenerated = useMemo(() => {
    return selectedResources.some((field) => field.generated);
  }, [selectedResources]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <div className="space-y-2">
        {parameter_ids.map((parameterId) => {
          const labelText =
            parameterLabelMap.get(parameterId) ?? parameterId.slice(0, 8);
          const parameterOptions = fieldOptionsByParameter.get(parameterId) ?? [];
          return (
            <div
              key={parameterId}
              className="space-y-2 rounded-lg border p-2"
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {parameterOptions.map((option) => {
                  const isSelected = isFieldSelected(option.parameter_id, option.field_id);
                  return (
                    <div
                      key={`${option.parameter_id}:${option.field_id}`}
                      className={cn(
                        "flex items-start justify-between gap-2 rounded-md border px-2 py-1.5",
                        isSelected && "border-primary/50 bg-accent/40"
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium">{option.name}</div>
                        {option.description && (
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            {option.description}
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          handleToggle(option, checked);
                        }}
                        disabled={disabled}
                        className="shrink-0"
                      />
                    </div>
                  );
                })}
                {parameterOptions.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground">
                    No fields available for this parameter.
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {parameter_ids.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No parameters selected. Select parameters first to choose fields.
          </div>
        )}
      </div>
    </div>
  );
}
