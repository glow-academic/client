/**
 * ParameterFieldsNew.tsx
 * Clean rewrite of parameter field selection for Persona.
 * parameterIds (which groups are expanded) comes from URL state.
 * No conditional parameter chain resolution — just explore/close UI.
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
import { Check, ChevronDown, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftParameterFieldsIn = InputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftParameterFieldsOut = OutputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type LinkParameterFieldsIn = InputOf<"/api/v4/resources/parameter_fields/link", "post">;
type LinkParameterFieldsOut = OutputOf<"/api/v4/resources/parameter_fields/link", "post">;

// Derive resource item type from the GET endpoint response
type ParameterFieldGetResponse = OutputOf<"/api/v4/resources/parameter_fields/get", "post">;
export type ParameterFieldResourceItem = NonNullable<ParameterFieldGetResponse["items"]>[number];

export interface ParameterFieldsNewProps {
  parameterIds: string[];                    // from URL — which groups are expanded
  parameterFieldIds: string[];               // form state — selected field IDs
  parameterFieldResources: ParameterFieldResourceItem[];  // saved selections
  allParameters: Array<{ parameter_id?: string | null; name?: string | null; description?: string | null; conditional?: boolean | null }>;
  availableFields: ParameterFieldResourceItem[];  // all field options
  onToggleParameter: (parameterId: string, open: boolean) => void;
  onChange: (ids: string[]) => void;          // emit parameter_field_ids
  disabled?: boolean;
  group_id?: string | null;
  showAiGenerate?: boolean;
  createParameterFieldsAction?:
    | ((input: CreateDraftParameterFieldsIn) => Promise<CreateDraftParameterFieldsOut>)
    | undefined;
  link_tool_id?: string | null; // Tool ID for linking existing resources
  linkParameterFieldsAction?:
    | ((input: LinkParameterFieldsIn) => Promise<LinkParameterFieldsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isAutosaveEnabled?: boolean;
  registerFlush?: (flush: () => Promise<{ parameter_field_ids: string[] } | void>) => void;
  create_tool_id?: string | null;
  required?: boolean;
  label?: string;
  aiParameterFieldResources?: Array<Pick<ParameterFieldResourceItem, "id" | "field_id" | "parameter_id">> | null;
}

// Represents an available field option
type AvailableFieldOption = {
  field_id: string;
  parameter_id: string;
  name: string;
  description: string;
  conditional_parameter_id: string | null | undefined;
};

export function ParameterFieldsNew({
  parameterIds,
  parameterFieldIds: _parameterFieldIds,
  parameterFieldResources,
  allParameters,
  availableFields: availableFieldsProp,
  onToggleParameter,
  onChange,
  disabled = false,
  group_id,
  showAiGenerate = false,
  createParameterFieldsAction,
  link_tool_id,
  linkParameterFieldsAction,
  onGenerate,
  isAutosaveEnabled = true,
  registerFlush,
  create_tool_id,
  required = false,
  label = "Parameter Fields",
  aiParameterFieldResources,
}: ParameterFieldsNewProps) {
  const availableFields = useMemo(() => availableFieldsProp ?? [], [availableFieldsProp]);
  const selectedResources = useMemo(() => parameterFieldResources ?? [], [parameterFieldResources]);

  // Map: "parameterId:fieldId" -> parameter_fields_resource.id
  const selectedFieldKeyToResourceId = useMemo(() => {
    const map = new Map<string, string>();
    selectedResources.forEach((resource) => {
      if (resource.parameter_id && resource.field_id && resource.id) {
        map.set(`${resource.parameter_id}:${resource.field_id}`, resource.id);
      }
    });
    return map;
  }, [selectedResources]);

  // Track parameter_fields_resource IDs to emit
  const [resourceIds, setResourceIds] = useState<Map<string, string>>(new Map());
  const [localKeyToResourceId, setLocalKeyToResourceId] = useState<Map<string, string>>(new Map());
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const creatingKeysRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);
  const lastEmittedRef = useRef<string>("");
  const flushRef = useRef<(() => Promise<{ parameter_field_ids: string[] } | void>) | undefined>(undefined);

  // Sync resourceIds with selected resources from server
  useEffect(() => {
    setResourceIds((prev) => {
      const next = new Map(prev);
      selectedResources.forEach((resource) => {
        if (resource.id) {
          next.set(resource.id, resource.id);
        }
      });
      return next;
    });
  }, [selectedResources]);

  // Emit changes to parent
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      lastEmittedRef.current = Array.from(resourceIds.values()).sort().join(",");
      return;
    }
    const currentIds = Array.from(resourceIds.values()).sort().join(",");
    if (currentIds !== lastEmittedRef.current) {
      lastEmittedRef.current = currentIds;
      onChange(Array.from(resourceIds.values()));
    }
  }, [resourceIds, onChange]);

  // Flush function for manual save mode
  flushRef.current = async (): Promise<{ parameter_field_ids: string[] } | void> => {
    if (!createParameterFieldsAction || !group_id) return;
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
                  tool_id: create_tool_id ?? null,
                },
              });
              if (result?.parameter_fields_id) {
                const resultId = result.parameter_fields_id as string;
                setLocalKeyToResourceId((prev) => new Map(prev).set(key, resultId));
                setResourceIds((prev) => new Map(prev).set(resultId, resultId));
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

    const newlyCreatedIds = results.filter((id): id is string => id !== null);
    const existingIds = Array.from(resourceIds.values());
    return { parameter_field_ids: [...new Set([...existingIds, ...newlyCreatedIds])] };
  };

  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const createParameterField = useCallback(
    async (parameterId: string, fieldId: string) => {
      const key = `${parameterId}:${fieldId}`;
      if (!isAutosaveEnabled) {
        setPendingSelections((prev) => new Set(prev).add(key));
        return null;
      }
      if (!createParameterFieldsAction || !group_id) return null;
      if (creatingKeysRef.current.has(key)) return null;
      creatingKeysRef.current.add(key);

      try {
        const result = await createParameterFieldsAction({
          body: {
            group_id: group_id,
            parameter_id: parameterId,
            field_id: fieldId,
            mcp: false,
            tool_id: create_tool_id ?? null,
          },
        });
        if (!result?.parameter_fields_id) {
          creatingKeysRef.current.delete(key);
          return null;
        }
        const resultId = result.parameter_fields_id as string;
        setLocalKeyToResourceId((prev) => new Map(prev).set(key, resultId));
        setResourceIds((prev) => new Map(prev).set(resultId, resultId));
        // Clear optimistic pending now that we have the real ID
        setPendingSelections((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return resultId;
      } catch {
        creatingKeysRef.current.delete(key);
        // Clear optimistic pending on failure too
        setPendingSelections((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return null;
      }
    },
    [createParameterFieldsAction, group_id, isAutosaveEnabled, create_tool_id]
  );

  const handleToggle = useCallback(
    (option: AvailableFieldOption, checked: boolean) => {
      const key = `${option.parameter_id}:${option.field_id}`;
      const existingResourceId = selectedFieldKeyToResourceId.get(key) ?? localKeyToResourceId.get(key);

      if (checked) {
        if (existingResourceId) {
          setResourceIds((prev) => new Map(prev).set(existingResourceId, existingResourceId));
          // Fire link tracking for selecting an existing resource
          if (linkParameterFieldsAction && group_id && link_tool_id) {
            linkParameterFieldsAction({
              body: { resource_id: existingResourceId, group_id, tool_id: link_tool_id },
            }).catch(() => {});
          }
        } else {
          void createParameterField(option.parameter_id, option.field_id);
        }
      } else {
        if (pendingSelections.has(key)) {
          setPendingSelections((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        } else if (existingResourceId) {
          setResourceIds((prev) => {
            const next = new Map(prev);
            next.delete(existingResourceId);
            return next;
          });
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
    },
    [selectedFieldKeyToResourceId, localKeyToResourceId, pendingSelections, createParameterField, isAutosaveEnabled, linkParameterFieldsAction, group_id, link_tool_id]
  );

  const isFieldSelected = useCallback(
    (parameterId: string, fieldId: string): boolean => {
      const key = `${parameterId}:${fieldId}`;
      if (pendingSelections.has(key)) return true;
      const resourceId = selectedFieldKeyToResourceId.get(key) ?? localKeyToResourceId.get(key);
      return resourceId ? resourceIds.has(resourceId) : false;
    },
    [selectedFieldKeyToResourceId, localKeyToResourceId, resourceIds, pendingSelections]
  );

  // AI suggestion handling
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "parameter_fields",
    groupId: group_id,
  });

  type AiFieldSuggestion = Pick<ParameterFieldResourceItem, "id" | "field_id" | "parameter_id">;
  const effectiveAiParameterFieldResources: AiFieldSuggestion[] | null =
    (aiSuggestion as AiFieldSuggestion[] | null) ?? aiParameterFieldResources ?? null;
  const showDiff = !!effectiveAiParameterFieldResources?.length;
  const aiSuggestedFieldIds = useMemo(
    () => new Set(
      effectiveAiParameterFieldResources
        ?.map((f: AiFieldSuggestion) => f.field_id)
        .filter(Boolean) as string[]
    ),
    [effectiveAiParameterFieldResources]
  );

  const handleAcceptAi = useCallback(() => {
    if (!effectiveAiParameterFieldResources?.length) return;
    const newIds = effectiveAiParameterFieldResources
      .map((f: AiFieldSuggestion) => f.id)
      .filter((id): id is string => !!id && !resourceIds.has(id));
    if (newIds.length > 0) {
      setResourceIds((prev) => {
        const next = new Map(prev);
        newIds.forEach((id) => next.set(id, id));
        return next;
      });
    }
    clearAi();
  }, [effectiveAiParameterFieldResources, resourceIds, clearAi]);

  const handleRejectAi = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Group available fields by parameter_id
  const fieldOptionsByParameter = useMemo(() => {
    const map = new Map<string, AvailableFieldOption[]>();
    availableFields
      .filter((field) => field.field_id && field.name && field.parameter_id)
      .forEach((field) => {
        const parameterId = field.parameter_id as string;
        if (!map.has(parameterId)) map.set(parameterId, []);
        map.get(parameterId)!.push({
          field_id: field.field_id as string,
          parameter_id: parameterId,
          name: field.name as string,
          description: field.description ?? "",
          conditional_parameter_id: field.conditional_parameter_id as string | null | undefined,
        });
      });
    return map;
  }, [availableFields]);

  // Build list of all parameter groups with their names
  const parameterGroups = useMemo(() => {
    return (allParameters ?? [])
      .filter((p) => p.parameter_id && p.name)
      .map((p) => ({
        parameter_id: p.parameter_id as string,
        name: p.name as string,
        description: p.description ?? undefined,
        conditional: !!p.conditional,
      }));
  }, [allParameters]);

  const hasGenerated = useMemo(() => {
    return selectedResources.some((field) => field.generated);
  }, [selectedResources]);

  const expandedSet = useMemo(() => new Set(parameterIds), [parameterIds]);

  // Visible groups: root (non-conditional) params always visible,
  // conditional params visible when explicitly in URL parameterIds
  const visibleParameterGroups = useMemo(() => {
    return parameterGroups.filter(
      (p) => !p.conditional || expandedSet.has(p.parameter_id)
    );
  }, [parameterGroups, expandedSet]);

  // Don't render if no parameters available
  if (parameterGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">
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
      <div className="space-y-3">
        {visibleParameterGroups.map((param) => {
          const isExpanded = expandedSet.has(param.parameter_id);
          const parameterOptions = fieldOptionsByParameter.get(param.parameter_id) ?? [];
          const selectedCount = parameterOptions.filter(
            (opt) => isFieldSelected(opt.parameter_id, opt.field_id)
          ).length;

          return (
            <div key={param.parameter_id} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-3 text-left transition-colors",
                  "hover:bg-accent/50",
                  isExpanded && "bg-accent/30"
                )}
                onClick={() => onToggleParameter(param.parameter_id, !isExpanded)}
                disabled={disabled}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-medium text-sm flex-1">{param.name}</span>
                {selectedCount > 0 && (
                  <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                    {selectedCount} selected
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {isExpanded ? "Close" : "Explore"}
                </span>
              </button>

              {isExpanded && parameterOptions.length > 0 && (
                <div className="px-4 pb-4 pt-2">
                  <SelectableGrid<AvailableFieldOption>
                    items={parameterOptions}
                    selectedId={null}
                    selectedIds={parameterOptions
                      .filter((opt) => isFieldSelected(opt.parameter_id, opt.field_id))
                      .map((opt) => opt.field_id)}
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
                      const hasExplore = !!item.conditional_parameter_id;
                      const isExploreExpanded = hasExplore && expandedSet.has(item.conditional_parameter_id!);
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
                          {isSelected && (
                            <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
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
                          {hasExplore && (
                            <button
                              type="button"
                              className={cn(
                                "mt-1 text-xs font-medium flex items-center gap-0.5 self-start",
                                isExploreExpanded
                                  ? "text-muted-foreground"
                                  : "text-primary hover:text-primary/80"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleParameter(
                                  item.conditional_parameter_id!,
                                  !isExploreExpanded
                                );
                              }}
                              disabled={disabled}
                            >
                              {isExploreExpanded ? "Exploring" : "Explore →"}
                            </button>
                          )}
                        </div>
                      );
                    }}
                    emptyMessage="No fields available for this parameter."
                    disabled={disabled}
                    horizontal
                  />
                </div>
              )}

              {isExpanded && parameterOptions.length === 0 && (
                <div className="px-4 pb-4 pt-2 text-sm text-muted-foreground">
                  No fields available for this parameter.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
