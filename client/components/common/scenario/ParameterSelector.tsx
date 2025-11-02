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

    // Accept all selected IDs (unlimited multi-select)
    if (newIds.length > 0) {
      onParameterItemIdsChange([...currentItems, ...newIds]);
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

    // Accept all IDs (for range selection, multiple items within range)
    if (newIds.length > 0) {
      onParameterItemIdsChange([...currentItems, ...newIds]);
    } else {
      onParameterItemIdsChange(currentItems);
    }
  };

  const getSelectedNumericalValue = (parameterId: string): number[] => {
    const selectedItemIds = selectedItemsByParameter[parameterId] || [];

    if (selectedItemIds.length === 0) {
      // Return [min, max] as default range if nothing selected
      const { min, max } = getNumericalParameterRange(parameterId);
      return [min, max];
    }

    // Get all values from selected items and find min/max
    const values = selectedItemIds
      .map((itemId) => {
        const item = parameterItemMapping[itemId];
        return item ? parseFloat(item.value) : NaN;
      })
      .filter((v) => !isNaN(v));

    if (values.length === 0) {
      const { min, max } = getNumericalParameterRange(parameterId);
      return [min, max];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    return [min, max];
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

    if (itemIds.length === 0 || value.length < 2) return;

    const [minRange, maxRange] = value;
    if (minRange === undefined || maxRange === undefined) return;

    // Find ALL parameter items whose values fall within the range (inclusive)
    const matchingItemIds: string[] = [];

    for (const itemId of itemIds) {
      const item = parameterItemMapping[itemId];
      if (item) {
        const itemValue = parseFloat(item.value);
        if (
          !isNaN(itemValue) &&
          itemValue >= minRange &&
          itemValue <= maxRange
        ) {
          matchingItemIds.push(itemId);
        }
      }
    }

    // Update selection with all matching items
    handleNumericalParameterChange(parameterId, matchingItemIds);
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

                return (
                  <div key={parameterId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        {parameter?.name || "Parameter"}
                      </Label>
                      {selectedItemIds.length > 0 && (
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
                      multiSelect={true}
                    />

                    {selectedItemIds.length > 0 && (
                      <div className="space-y-1">
                        {selectedItemIds.map((id) => {
                          const item = parameterItemMapping[id];
                          return item ? (
                            <p
                              key={id}
                              className="text-xs text-muted-foreground"
                            >
                              {item.description}
                            </p>
                          ) : null;
                        })}
                      </div>
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
                const { min, max, step } =
                  getNumericalParameterRange(parameterId);
                const currentValue = getSelectedNumericalValue(parameterId);
                const [minValue, maxValue] = currentValue;
                const hasSelection = selectedItemIds.length > 0;

                return (
                  <div key={parameterId} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">
                          {parameter?.name || "Parameter"}
                        </Label>
                        {hasSelection && (
                          <p className="text-xs text-muted-foreground">
                            {selectedItemIds.length} item
                            {selectedItemIds.length !== 1 ? "s" : ""} selected
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {hasSelection &&
                          minValue !== undefined &&
                          maxValue !== undefined
                            ? `${minValue} - ${maxValue}`
                            : `${min} - ${max}`}
                        </span>
                        {hasSelection && (
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

                    {hasSelection && (
                      <div className="space-y-1">
                        {selectedItemIds.slice(0, 3).map((id) => {
                          const item = parameterItemMapping[id];
                          return item ? (
                            <p
                              key={id}
                              className="text-xs text-muted-foreground"
                            >
                              {item.name}: {item.description}
                            </p>
                          ) : null;
                        })}
                        {selectedItemIds.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{selectedItemIds.length - 3} more
                          </p>
                        )}
                      </div>
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
