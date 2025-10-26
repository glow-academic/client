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

import type {
  ParameterItemMapping,
  ParameterMapping,
} from "@/lib/api/v2/schemas/base";
import { ParameterItemPicker } from "./ParameterItemPicker";

interface ParameterSelectorProps {
  parameterMapping: ParameterMapping;
  parameterItemMapping: ParameterItemMapping;
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
  const { numericalParameters, nonNumericalParameters } = useMemo(() => {
    const parameterIds = Object.keys(parameterItemsByParameter);
    const numerical: string[] = [];
    const nonNumerical: string[] = [];

    parameterIds.forEach((parameterId) => {
      const parameter = parameterMapping[parameterId];
      if (parameter?.numerical) {
        numerical.push(parameterId);
      } else {
        nonNumerical.push(parameterId);
      }
    });

    return {
      numericalParameters: numerical,
      nonNumericalParameters: nonNumerical,
    };
  }, [parameterItemsByParameter, parameterMapping]);

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

  const getSelectedNumericalValue = (parameterId: string): number[] => {
    const selectedItemIds = selectedItemsByParameter[parameterId] || [];
    const selectedItemId = selectedItemIds[0];
    if (selectedItemId) {
      const item = parameterItemMapping[selectedItemId];
      if (item) {
        const value = parseFloat(item.value);
        return isNaN(value) ? [0] : [value];
      }
    }
    return [0];
  };

  const getNumericalParameterRange = (
    parameterId: string
  ): { min: number; max: number; step: number } => {
    const itemIds = parameterItemsByParameter[parameterId] || [];
    const values = itemIds
      .map((itemId) => {
        const item = parameterItemMapping[itemId];
        return item ? parseFloat(item.value) : NaN;
      })
      .filter((v) => !isNaN(v));

    if (values.length === 0) return { min: 0, max: 10, step: 1 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = values.length > 1 ? (max - min) / (values.length - 1) : 1;

    return { min, max, step };
  };

  const handleNumericalSliderChange = (
    parameterId: string,
    value: number[]
  ) => {
    const itemIds = parameterItemsByParameter[parameterId] || [];
    const targetValue = value[0];

    if (itemIds.length === 0 || targetValue === undefined) return;

    // Find the closest parameter item value
    let closestItemId = itemIds[0];
    let minDistance = Infinity;

    for (const itemId of itemIds) {
      const item = parameterItemMapping[itemId];
      if (item) {
        const itemValue = parseFloat(item.value);
        if (!isNaN(itemValue)) {
          const distance = Math.abs(itemValue - targetValue);
          if (distance < minDistance) {
            minDistance = distance;
            closestItemId = itemId;
          }
        }
      }
    }

    if (closestItemId) {
      handleNumericalParameterChange(parameterId, [closestItemId]);
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
