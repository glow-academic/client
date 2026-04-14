/**
 * ParameterFields.tsx
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
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ParameterFieldResourceItem {
  id?: string | null;
  field_id?: string | null;
  parameter_id?: string | null;
  name?: string | null;
  description?: string | null;
  value?: string | null;
  conditional_parameter_id?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ParameterFieldsProps {
  parameterIds: string[];                    // from URL — which groups are expanded
  parameterFieldIds: string[];               // form state — selected field IDs
  parameterFieldResources: ParameterFieldResourceItem[];  // saved selections
  allParameters: Array<{ parameter_id?: string | null; name?: string | null; description?: string | null; conditional?: boolean | null }>;
  availableFields: ParameterFieldResourceItem[];  // all field options
  onToggleParameter: (parameterId: string, open: boolean) => void;
  onChange: (ids: string[]) => void;          // emit parameter_field_ids
  disabled?: boolean;
  isAutosaveEnabled?: boolean;
  required?: boolean;
  label?: string;
}

// Represents an available field option
type AvailableFieldOption = {
  id: string;
  field_id: string;
  parameter_id: string;
  name: string;
  description: string;
  conditional_parameter_id: string | null | undefined;
};

export function ParameterFields({
  parameterIds,
  parameterFieldIds: _parameterFieldIds,
  parameterFieldResources,
  allParameters,
  availableFields: availableFieldsProp,
  onToggleParameter,
  onChange,
  disabled = false,
  _isAutosaveEnabled = true,
  required = false,
  label = "Parameter Fields",
}: ParameterFieldsProps) {
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
  const hasInitializedRef = useRef(false);
  const lastEmittedRef = useRef<string>("");
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

  const createParameterField = useCallback(
    async (_parameterId: string, _fieldId: string) => {
      // In draft context, parameter fields only link by ID (no creation needed)
      return null;
    },
    []
  );

  const handleToggle = useCallback(
    (option: AvailableFieldOption, checked: boolean) => {
      const key = `${option.parameter_id}:${option.field_id}`;
      const existingResourceId = selectedFieldKeyToResourceId.get(key) ?? localKeyToResourceId.get(key);

      if (checked) {
        const resolvedId = existingResourceId ?? option.id;
        if (resolvedId) {
          setResourceIds((prev) => new Map(prev).set(resolvedId, resolvedId));
          setLocalKeyToResourceId((prev) => new Map(prev).set(key, resolvedId));
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
    [selectedFieldKeyToResourceId, localKeyToResourceId, pendingSelections, createParameterField]
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

  // Pending items: fields with pending=true from the API
  const pendingItems = useMemo(() => {
    return availableFields.filter((f) => f.pending);
  }, [availableFields]);
  const pendingFieldIds = useMemo(
    () => new Set(pendingItems.map((f) => f.field_id).filter(Boolean) as string[]),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in selection, just confirm (no-op for form state)
  const handleAccept = useCallback(() => {
    // Pending items are already in the selection; accepting is a no-op for form state.
  }, []);

  // Reject pending — remove pending item IDs from selection
  const handleReject = useCallback(() => {
    const pendingResourceIds = new Set(
      pendingItems.map((f) => f.id).filter((id): id is string => !!id)
    );
    setResourceIds((prev) => {
      const next = new Map(prev);
      pendingResourceIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [pendingItems]);

  // Group available fields by parameter_id
  const fieldOptionsByParameter = useMemo(() => {
    const map = new Map<string, AvailableFieldOption[]>();
    availableFields
      .filter((field) => field.field_id && field.name && field.parameter_id)
      .forEach((field) => {
        const parameterId = field.parameter_id as string;
        if (!map.has(parameterId)) map.set(parameterId, []);
        map.get(parameterId)!.push({
          id: field.id as string,
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

  const expandedSet = useMemo(() => new Set(parameterIds), [parameterIds]);

  // Local UI-only collapsed state (visual collapse, doesn't affect data loading)
  // Initialize: parameters NOT in expandedSet start collapsed
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    (allParameters ?? []).forEach((p) => {
      if (p.parameter_id && !parameterIds.includes(p.parameter_id)) {
        initial.add(p.parameter_id);
      }
    });
    return initial;
  });
  const toggleCollapsed = useCallback((parameterId: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(parameterId)) {
        next.delete(parameterId);
      } else {
        next.add(parameterId);
      }
      return next;
    });
  }, []);

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
      )}
      <div className="space-y-3">
        {visibleParameterGroups.map((param) => {
          const isExpanded = expandedSet.has(param.parameter_id);
          const parameterOptions = fieldOptionsByParameter.get(param.parameter_id) ?? [];
          const selectedCount = parameterOptions.filter(
            (opt) => isFieldSelected(opt.parameter_id, opt.field_id)
          ).length;

          const isCollapsed = collapsedSet.has(param.parameter_id);

          return (
            <div key={param.parameter_id}>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 py-2 text-left transition-colors rounded-md",
                  "hover:bg-accent/50"
                )}
                onClick={() => {
                  if (!isExpanded) {
                    // First open: load data from server via URL
                    onToggleParameter(param.parameter_id, true);
                  }
                  toggleCollapsed(param.parameter_id);
                }}
                disabled={disabled}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-medium text-sm flex-1">{param.name}</span>
                {selectedCount > 0 && (
                  <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                    {selectedCount} selected
                  </span>
                )}
              </button>

              {!isCollapsed && parameterOptions.length > 0 && (
                <div className="pb-2 pt-1">
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
                      const isPendingField = showDiff && pendingFieldIds.has(item.field_id);
                      const hasExplore = !!item.conditional_parameter_id;
                      const isExploreExpanded = hasExplore && expandedSet.has(item.conditional_parameter_id!);
                      return (
                        <div
                          className={cn(
                            "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                            "hover:shadow-md hover:bg-accent/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            isPendingField && "ring-2 ring-success bg-success/10",
                            isSelected && !isPendingField && "ring-2 ring-primary bg-accent"
                          )}
                        >
                          {isSelected && !isPendingField && (
                            <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                          {isPendingField && (
                            <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                              Pending
                            </div>
                          )}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-1 pr-8">
                              {hasExplore && (
                                <button
                                  type="button"
                                  className={cn(
                                    "p-0.5 -ml-1 rounded transition-colors shrink-0",
                                    isExploreExpanded
                                      ? "text-muted-foreground hover:bg-accent/50"
                                      : "text-primary hover:text-primary/80 hover:bg-primary/10"
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
                                  {isExploreExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              <h3 className="font-medium text-sm leading-tight truncate">{item.name}</h3>
                            </div>
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
              )}

              {!isCollapsed && parameterOptions.length === 0 && (
                <div className="pb-2 pt-1 text-sm text-muted-foreground">
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
