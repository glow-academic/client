/**
 * ParameterSelector.tsx
 * Component for selecting scenario parameters with dynamic parameter items
 * Updated to work with refactored ParameterItemPicker
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { X } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import type { ParameterItemMappingItem } from "@/lib/api/v2/schemas/base";
import { ParameterItemPicker } from "./ParameterItemPicker";

interface ParameterSelectorProps {
  parameterMapping: Record<string, { name: string; description: string }>;
  parameterItemMapping: Record<string, ParameterItemMappingItem>;
  validParameterItemIds: string[];
  selectedParameterItemIds: string[];
  onParameterItemIdsChange: (parameterItemIds: string[]) => void;
  disabled?: boolean;
}

export function ParameterSelector({
  parameterMapping,
  parameterItemMapping,
  validParameterItemIds,
  selectedParameterItemIds,
  onParameterItemIdsChange,
  disabled = false,
}: ParameterSelectorProps) {
  // Group valid parameter items by parameter (from mapping)
  const parameterItemsByParameter = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    validParameterItemIds.forEach((itemId) => {
      const item = parameterItemMapping[itemId];
      if (item) {
        const parameterId = item.parameter_id;
        if (!grouped[parameterId]) {
          grouped[parameterId] = [];
        }
        grouped[parameterId]!.push(itemId);
      }
    });
    return grouped;
  }, [validParameterItemIds, parameterItemMapping]);

  // Separate parameters into numerical and non-numerical
  // For V2, we need to determine this from the parameter_item_mapping
  // Assuming numerical parameters have numeric values
  const { numericalParameters, nonNumericalParameters } = useMemo(() => {
    const parameterIds = Object.keys(parameterItemsByParameter);
    const numerical: string[] = [];
    const nonNumerical: string[] = [];

    parameterIds.forEach((parameterId) => {
      // For now, assume all are non-numerical since we don't have type info in mapping
      // This will need to be enhanced when parameter type is added to the schema
      // TODO: Add numerical flag to ParameterMapping schema
      nonNumerical.push(parameterId);
    });

    return {
      numericalParameters: numerical,
      nonNumericalParameters: nonNumerical,
    };
  }, [parameterItemsByParameter]);

  // Group selected items by parameter
  const selectedItemsByParameter = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    selectedParameterItemIds.forEach((itemId) => {
      const item = parameterItemMapping[itemId];
      if (item) {
        const parameterId = item.parameter_id;
        if (!grouped[parameterId]) {
          grouped[parameterId] = [];
        }
        grouped[parameterId]!.push(itemId);
      }
    });
    return grouped;
  }, [selectedParameterItemIds, parameterItemMapping]);

  const handleNonNumericalParameterChange = (
    parameterId: string,
    newIds: string[]
  ) => {
    const currentItems = selectedParameterItemIds.filter(
      (id) => parameterItemMapping[id]?.parameter_id !== parameterId
    );

    if (newIds.length > 0) {
      onParameterItemIdsChange([...currentItems, newIds[0]!]);
    } else {
      onParameterItemIdsChange(currentItems);
    }
  };

  const handleNumericalParameterChange = (
    parameterId: string,
    newIds: string[]
  ) => {
    const currentItems = selectedParameterItemIds.filter(
      (id) => parameterItemMapping[id]?.parameter_id !== parameterId
    );

    if (newIds.length > 0) {
      onParameterItemIdsChange([...currentItems, newIds[0]!]);
    } else {
      onParameterItemIdsChange(currentItems);
    }
  };

  const getSelectedNumericalValue = (_parameterId: string): number[] => {
    // Note: ParameterItem value is not in ParameterItemMappingItem
    // We'll need to get it from a separate source or add it to the mapping
    // For now, returning [0] as placeholder
    return [0];
  };

  const getNumericalParameterRange = (
    _parameterId: string
  ): { min: number; max: number; step: number } => {
    // Note: We need parameter item values which are not in the current mapping
    // This is a limitation of the current V2 schema
    // For now, return default range
    return { min: 0, max: 10, step: 1 };
  };

  const handleNumericalSliderChange = (
    parameterId: string,
    _value: number[]
  ) => {
    const itemIds = parameterItemsByParameter[parameterId] || [];

    // Note: Without parameter item values in the mapping, we can't implement this properly
    // This is a limitation that needs to be addressed in the V2 schema
    // For now, just select the first item
    if (itemIds.length > 0 && itemIds[0]) {
      handleNumericalParameterChange(parameterId, [itemIds[0]]);
    }
  };

  const resetParameter = (parameterId: string) => {
    handleNonNumericalParameterChange(parameterId, []);
  };

  const resetNumericalParameter = (parameterId: string) => {
    handleNumericalParameterChange(parameterId, []);
  };

  const hasNonNumerical = nonNumericalParameters.length > 0;
  const hasNumerical = numericalParameters.length > 0;

  const showTwoColumns = hasNonNumerical && hasNumerical;

  return (
    <div className="relative">
      {/* Vertical divider only when both columns exist */}
      {showTwoColumns && (
        <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-border transform -translate-x-1/2" />
      )}

      <div
        className={`grid grid-cols-1 ${showTwoColumns ? "lg:grid-cols-2" : ""} gap-6`}
      >
        {/* Left side - Non-numerical parameters */}
        {hasNonNumerical && (
          <div className="space-y-4">
            <div className="space-y-4">
              {nonNumericalParameters.map((parameterId) => {
                const parameter = parameterMapping[parameterId];
                const itemIds = parameterItemsByParameter[parameterId] || [];
                const selectedItemIds =
                  selectedItemsByParameter[parameterId] || [];
                const selectedItemId = selectedItemIds[0];

                return (
                  <div key={parameterId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        {parameter?.name || "Parameter"}
                      </Label>
                      {selectedItemId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetParameter(parameterId)}
                          className="h-6 w-6 p-0 hover:bg-muted"
                          disabled={disabled}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <ParameterItemPicker
                      mapping={parameterItemMapping}
                      validIds={itemIds}
                      selectedIds={selectedItemIds}
                      onSelect={(ids) =>
                        handleNonNumericalParameterChange(parameterId, ids)
                      }
                      parameterId={parameterId}
                      parameterName={parameter?.name || ""}
                      parameterDescription={parameter?.description || ""}
                      isDefaultParameter={false}
                      disabled={disabled}
                    />

                    {selectedItemId && parameterItemMapping[selectedItemId] && (
                      <p className="text-xs text-muted-foreground">
                        {parameterItemMapping[selectedItemId].description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right side - Numerical parameters */}
        {hasNumerical && (
          <div className="space-y-4">
            <div className="space-y-6">
              {numericalParameters.map((parameterId) => {
                const parameter = parameterMapping[parameterId];
                const itemIds = parameterItemsByParameter[parameterId] || [];
                const selectedItemIds =
                  selectedItemsByParameter[parameterId] || [];
                const selectedItemId = selectedItemIds[0];
                const { min, max, step } =
                  getNumericalParameterRange(parameterId);
                const currentValue = getSelectedNumericalValue(parameterId);

                return (
                  <div key={parameterId} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">
                          {parameter?.name || "Parameter"}
                        </Label>
                        {selectedItemId &&
                          parameterItemMapping[selectedItemId] && (
                            <p className="text-xs text-muted-foreground">
                              {parameterItemMapping[selectedItemId].name}
                            </p>
                          )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {currentValue[0]}
                        </span>
                        {selectedItemId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetNumericalParameter(parameterId)}
                            className="h-6 w-6 p-0 hover:bg-muted"
                            disabled={disabled}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <Slider
                      min={min}
                      max={max}
                      step={step}
                      value={currentValue}
                      onValueChange={(value) =>
                        handleNumericalSliderChange(parameterId, value)
                      }
                      className="w-full"
                      disabled={itemIds.length === 0 || disabled}
                    />

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{min}</span>
                      <span>{max}</span>
                    </div>

                    {selectedItemId && parameterItemMapping[selectedItemId] && (
                      <p className="text-xs text-muted-foreground">
                        {parameterItemMapping[selectedItemId].description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!hasNonNumerical && !hasNumerical && (
        <p className="text-sm text-muted-foreground">
          No parameters available.
        </p>
      )}
    </div>
  );
}
