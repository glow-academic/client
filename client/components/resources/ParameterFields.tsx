/**
 * ParameterFields.tsx
 * Resource component for per-parameter field selection
 * Uses base fields list and creates parameter_fields_resource entries
 * Groups fields by parameter_id, similar to ScenarioFlags pattern
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
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
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftParameterFieldsIn = InputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftParameterFieldsOut = OutputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;

// Derive resource item type from the GET endpoint response
type ParameterFieldGetResponse = OutputOf<"/api/v4/resources/parameter_fields/get", "post">;
export type ParameterFieldResourceItem = NonNullable<ParameterFieldGetResponse["items"]>[number];

export interface ParameterFieldsProps {
  parameter_field_ids?: string[];
  parameter_field_resources?: ParameterFieldResourceItem[];
  show_parameter_fields?: boolean;
  parameter_fields?: ParameterFieldResourceItem[];
  parameter_ids?: string[];
  parameters?: Array<{
    parameter_id?: string | null;
    name?: string | null;
    description?: string | null;
    conditional?: boolean | null;
  }>;
  parameter_resources?: Array<{
    parameter_id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
    conditional?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  onConditionalParameterToggle?: (parameterId: string, selected: boolean) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createParameterFieldsAction?:
    | ((
        input: CreateDraftParameterFieldsIn
      ) => Promise<CreateDraftParameterFieldsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  onGenerationComplete?: () => void;
  isGenerating?: boolean;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ parameter_field_ids: string[] } | void>) => void;
  // AI diff view props
  aiParameterFieldResources?: Pick<ParameterFieldResourceItem, "id" | "field_id" | "parameter_id">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
}

// Represents an available field option from parameter_fields_junction
type AvailableFieldOption = {
  field_id: string; // fields_resource.id (used to create parameter_fields_resource)
  parameter_id: string;
  name: string;
  description?: string;
  conditional_parameter_id?: string | null; // The parameter this field unlocks when selected
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
  onConditionalParameterToggle,
  label = "Parameter Fields",
  id = "parameter_fields",
  required = false,
  description,
  group_id,
  showAiGenerate = false,
  createParameterFieldsAction,
  onGenerate,
  onGenerationComplete: _onGenerationComplete,
  isGenerating: _isGenerating = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiParameterFieldResources,
  onAccept: _onAccept,
  onReject: _onReject,
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
  // Track locally created field keys to resource IDs (for selection state before server sync)
  const [localKeyToResourceId, setLocalKeyToResourceId] = useState<Map<string, string>>(new Map());
  // Track pending selections (for manual save mode - fields selected but not yet created)
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  // Track pending creations to prevent duplicates
  const creatingKeysRef = useRef<Set<string>>(new Set());
  // Track if we should emit changes (skip initial sync)
  const hasInitializedRef = useRef(false);
  // Track the last emitted IDs to avoid duplicate emissions
  const lastEmittedRef = useRef<string>("");
  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ parameter_field_ids: string[] } | void>) | undefined>(undefined);

  // Sync resourceIds with selected resources from server
  // IMPORTANT: Merge server data with local state, don't replace
  // This preserves locally-created IDs that haven't synced to server yet
  useEffect(() => {
    setResourceIds((prev) => {
      const next = new Map(prev);
      // Add all server-confirmed IDs
      selectedResources.forEach((resource) => {
        if (resource.id) {
          next.set(resource.id, resource.id);
        }
      });
      // Keep any locally-created IDs that are in localKeyToResourceId
      // (they'll be removed when explicitly deselected)
      return next;
    });
  }, [selectedResources]);

  // Emit changes to parent via useEffect (not during render)
  useEffect(() => {
    // Skip the initial render to avoid emitting empty array
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Set initial lastEmitted to current state
      lastEmittedRef.current = Array.from(resourceIds.values()).sort().join(",");
      return;
    }

    // Only emit if IDs actually changed
    const currentIds = Array.from(resourceIds.values()).sort().join(",");
    if (currentIds !== lastEmittedRef.current) {
      lastEmittedRef.current = currentIds;
      onChange(Array.from(resourceIds.values()));
    }
  }, [resourceIds, onChange]);

  // Update flush function when dependencies change (for manual save mode)
  flushRef.current = async (): Promise<{ parameter_field_ids: string[] } | void> => {
    // Skip if no action or missing required params
    if (!createParameterFieldsAction || !group_id) return;

    // If no pending selections, return current IDs
    if (pendingSelections.size === 0) {
      return { parameter_field_ids: Array.from(resourceIds.values()) };
    }

    const promises: Promise<string | null>[] = [];
    pendingSelections.forEach((key) => {
      const [parameterId, fieldId] = key.split(":");
      if (parameterId && fieldId) {
        promises.push(
          (async () => {
            try {
              const result = await createParameterFieldsAction({
                body: {
                  group_id: group_id,
                  parameter_id: parameterId,
                  field_id: fieldId,
                  mcp: false,
                },
              });
              if (result?.parameter_fields_id) {
                const resultId = result.parameter_fields_id as string;
                setLocalKeyToResourceId((prev) => {
                  const next = new Map(prev);
                  next.set(key, resultId);
                  return next;
                });
                setResourceIds((prev) => {
                  const next = new Map(prev);
                  next.set(resultId, resultId);
                  return next;
                });
                return resultId;
              }
              return null;
            } catch {
              return null;
            }
          })()
        );
      }
    });

    const results = await Promise.all(promises);
    setPendingSelections(new Set());

    // Return all IDs: existing resourceIds + newly created IDs
    const newlyCreatedIds = results.filter((id): id is string => id !== null);
    const existingIds = Array.from(resourceIds.values());
    const allIds = [...new Set([...existingIds, ...newlyCreatedIds])];
    return { parameter_field_ids: allIds };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Track if we've synced conditional parameters on initial load
  const hasInitializedConditionalsRef = useRef(false);

  // Sync conditional parameters on load: if a selected field has a conditional_parameter_id,
  // ensure that parameter is added to parameter_ids.
  // This follows the FULL transitive chain: if field A unlocks param B, and param B has
  // selected field C that unlocks param D, we need to enable both B and D.
  useEffect(() => {
    // Only run once when we have both selected resources and available fields
    if (hasInitializedConditionalsRef.current) return;
    if (!onConditionalParameterToggle) return;
    if (selectedResources.length === 0 || availableFields.length === 0) return;

    hasInitializedConditionalsRef.current = true;

    // Build a set of field_ids that are currently selected
    const selectedFieldIds = new Set<string>();
    selectedResources.forEach((resource) => {
      if (resource.field_id) {
        selectedFieldIds.add(resource.field_id);
      }
    });

    // Build a map: parameter_id -> fields that belong to it
    const fieldsByParameter = new Map<string, typeof availableFields>();
    availableFields.forEach((field) => {
      if (field.parameter_id) {
        const existing = fieldsByParameter.get(field.parameter_id) ?? [];
        existing.push(field);
        fieldsByParameter.set(field.parameter_id, existing);
      }
    });

    // Compute the full transitive chain of conditional parameters
    // Start with parameters that have selected fields with conditional_parameter_id
    const conditionalParamsToEnable = new Set<string>();

    // First pass: find all conditional params from currently selected fields
    availableFields.forEach((field) => {
      if (
        field.field_id &&
        field.conditional_parameter_id &&
        selectedFieldIds.has(field.field_id)
      ) {
        conditionalParamsToEnable.add(field.conditional_parameter_id);
      }
    });

    // Transitive pass: for each newly added param, check if its selected fields
    // unlock more conditional params
    let changed = true;
    while (changed) {
      changed = false;
      conditionalParamsToEnable.forEach((paramId) => {
        const paramFields = fieldsByParameter.get(paramId) ?? [];
        paramFields.forEach((field) => {
          if (
            field.field_id &&
            field.conditional_parameter_id &&
            selectedFieldIds.has(field.field_id) &&
            !conditionalParamsToEnable.has(field.conditional_parameter_id)
          ) {
            conditionalParamsToEnable.add(field.conditional_parameter_id);
            changed = true;
          }
        });
      });
    }

    // Trigger all conditional parameters at once
    conditionalParamsToEnable.forEach((paramId) => {
      onConditionalParameterToggle(paramId, true);
    });
  }, [selectedResources, availableFields, onConditionalParameterToggle]);

  const createParameterField = useCallback(
    async (parameterId: string, fieldId: string) => {
      const key = `${parameterId}:${fieldId}`;

      // In manual save mode, just track the pending selection
      if (!isAutosaveEnabled) {
        setPendingSelections((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        return null;
      }

      // Autosave mode: create resource immediately
      if (!createParameterFieldsAction || !group_id) {
        return null;
      }
      if (creatingKeysRef.current.has(key)) {
        return null;
      }
      creatingKeysRef.current.add(key);

      try {
        const result = await createParameterFieldsAction({
          body: {
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
        // Track the local key→resourceId mapping for immediate selection state
        setLocalKeyToResourceId((prev) => {
          const next = new Map(prev);
          next.set(key, resultId);
          return next;
        });
        // Add to resourceIds - useEffect will emit the change
        setResourceIds((prev) => {
          const next = new Map(prev);
          next.set(resultId, resultId);
          return next;
        });
        return resultId;
      } catch {
        creatingKeysRef.current.delete(key);
        return null;
      }
    },
    [createParameterFieldsAction, group_id, isAutosaveEnabled]
  );

  const handleToggle = useCallback(
    (option: AvailableFieldOption, checked: boolean) => {
      const key = `${option.parameter_id}:${option.field_id}`;
      // Check both server-synced and locally-created mappings
      const existingResourceId = selectedFieldKeyToResourceId.get(key) ?? localKeyToResourceId.get(key);

      if (checked) {
        if (existingResourceId) {
          // Field was already selected, just add to tracking
          // useEffect will emit the change
          setResourceIds((prev) => {
            const next = new Map(prev);
            next.set(existingResourceId, existingResourceId);
            return next;
          });
        } else {
          // Need to create a new parameter_fields_resource
          void createParameterField(option.parameter_id, option.field_id);
        }
      } else {
        // Remove from selection
        // First check if it's a pending selection (manual save mode)
        if (pendingSelections.has(key)) {
          setPendingSelections((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        } else if (existingResourceId) {
          // useEffect will emit the change
          setResourceIds((prev) => {
            const next = new Map(prev);
            next.delete(existingResourceId);
            return next;
          });
          // Also clean up local mapping if it was locally created
          setLocalKeyToResourceId((prev) => {
            if (prev.has(key)) {
              const next = new Map(prev);
              next.delete(key);
              return next;
            }
            return prev;
          });
        }
      }

      // Handle conditional parameter auto-select/deselect
      if (option.conditional_parameter_id && onConditionalParameterToggle) {
        onConditionalParameterToggle(option.conditional_parameter_id, checked);
      }
    },
    [selectedFieldKeyToResourceId, localKeyToResourceId, pendingSelections, createParameterField, onConditionalParameterToggle]
  );

  // Check if a field is currently selected
  const isFieldSelected = useCallback(
    (parameterId: string, fieldId: string): boolean => {
      const key = `${parameterId}:${fieldId}`;
      // Check pending selections (manual save mode)
      if (pendingSelections.has(key)) {
        return true;
      }
      // Check both server-synced and locally-created mappings
      const resourceId = selectedFieldKeyToResourceId.get(key) ?? localKeyToResourceId.get(key);
      return resourceId ? resourceIds.has(resourceId) : false;
    },
    [selectedFieldKeyToResourceId, localKeyToResourceId, resourceIds, pendingSelections]
  );

  // AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, accept: acceptAi, reject: rejectAi } = useResourceAi({
    resourceType: "parameter_fields",
    groupId: group_id,
      ];
    },
  });

  const effectiveAiParameterFieldResources = aiSuggestion ?? aiParameterFieldResources ?? null;

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
          conditional_parameter_id: field.conditional_parameter_id ?? null,
        });
      });

    return map;
  }, [availableFields]);

  const hasGenerated = useMemo(() => {
    return selectedResources.some((field) => field.generated);
  }, [selectedResources]);

  // AI suggestion state
  const showDiff = !!effectiveAiParameterFieldResources?.length;
  // Track by field_id for matching during rendering
  const aiSuggestedFieldIds = useMemo(
    () =>
      new Set(
        effectiveAiParameterFieldResources
          ?.map((f) => f.field_id)
          .filter(Boolean) as string[]
      ),
    [effectiveAiParameterFieldResources]
  );

  // Accept AI suggestion - add AI-suggested parameter fields to selection
  const handleAcceptAi = useCallback(() => {
    if (!effectiveAiParameterFieldResources?.length) return;
    const newIds = effectiveAiParameterFieldResources
      .map((f) => f.id)
      .filter((id): id is string => !!id && !resourceIds.has(id));
    if (newIds.length > 0) {
      setResourceIds((prev) => {
        const next = new Map(prev);
        newIds.forEach((id) => next.set(id, id));
        return next;
      });
    }
    acceptAi();
  }, [effectiveAiParameterFieldResources, resourceIds, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleRejectAi = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

  // Don't render if show is false or no parameters selected
  if (!show || parameter_ids.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
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
                  {hasGenerated ? "Regenerate" : "Generate"}
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
                      onClick={handleAcceptAi}
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
                      onClick={handleRejectAi}
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
      )}
      <div className="space-y-4 pl-4">
        {parameter_ids.map((parameterId) => {
          const labelText =
            parameterLabelMap.get(parameterId) ?? parameterId.slice(0, 8);
          const parameterOptions = fieldOptionsByParameter.get(parameterId) ?? [];

          // Get selected IDs for this parameter's fields
          const selectedFieldIds = parameterOptions
            .filter((opt) => isFieldSelected(opt.parameter_id, opt.field_id))
            .map((opt) => opt.field_id);

          return (
            <div key={parameterId} className="space-y-2">
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <SelectableGrid<AvailableFieldOption>
                items={parameterOptions}
                selectedId={null}
                selectedIds={selectedFieldIds}
                onSelect={(fieldId) => {
                  const option = parameterOptions.find((opt) => opt.field_id === fieldId);
                  if (option) {
                    const isSelected = isFieldSelected(option.parameter_id, option.field_id);
                    handleToggle(option, !isSelected);
                  }
                }}
                getId={(item) => item.field_id}
                renderItem={(item, isSelected) => {
                  const isAiSuggested = showDiff && aiSuggestedFieldIds.has(item.field_id);

                  return (
                  <div
                    className={cn(
                      "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                      "hover:shadow-md hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected && "ring-2 ring-primary bg-accent",
                      isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
                    )}
                  >
                    {/* Check icon - top right */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}

                    {/* AI suggested badge - top right */}
                    {isAiSuggested && !isSelected && (
                      <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                        AI Suggested
                      </div>
                    )}

                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="font-medium text-sm leading-tight truncate pr-8">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
                }}
                emptyMessage="No fields available for this parameter."
                disabled={disabled}
                horizontal
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
