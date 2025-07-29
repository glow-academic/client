/**
 * ParameterSelector.tsx
 * Component for selecting scenario parameters with dynamic parameter items
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { X } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

import { Parameter, ParameterItem } from "@/types";

interface ParameterSelectorProps {
  parameters: Parameter[];
  parameterItems: ParameterItem[];
  selectedParameterItemIds: string[];
  onParameterItemIdsChange: (parameterItemIds: string[]) => void;
  disabled?: boolean;
}

export function ParameterSelector({
  parameters,
  parameterItems,
  selectedParameterItemIds,
  onParameterItemIdsChange,
  disabled = false,
}: ParameterSelectorProps) {
  // Group parameter items by parameter
  const parameterItemsByParameter = useMemo(() => {
    return parameterItems.reduce(
      (acc, item) => {
        if (!acc[item.parameterId]) {
          acc[item.parameterId] = [];
        }
        acc[item.parameterId]!.push(item);
        return acc;
      },
      {} as Record<string, ParameterItem[]>
    );
  }, [parameterItems]);

  // Separate active parameters into numerical and non-numerical
  const { numericalParameters, nonNumericalParameters } = useMemo(() => {
    const activeParameters = parameters.filter((p) => p.active);
    return {
      numericalParameters: activeParameters.filter((p) => p.numerical),
      nonNumericalParameters: activeParameters.filter((p) => !p.numerical),
    };
  }, [parameters]);

  // Get currently selected parameter items
  const selectedParameterItems = useMemo(() => {
    return parameterItems.filter((item) =>
      selectedParameterItemIds.includes(item.id)
    );
  }, [parameterItems, selectedParameterItemIds]);

  // Group selected items by parameter
  const selectedItemsByParameter = useMemo(() => {
    return selectedParameterItems.reduce(
      (acc, item) => {
        if (!acc[item.parameterId]) {
          acc[item.parameterId] = [];
        }
        acc[item.parameterId]!.push(item);
        return acc;
      },
      {} as Record<string, ParameterItem[]>
    );
  }, [selectedParameterItems]);

  const handleNonNumericalParameterChange = (
    parameterId: string,
    parameterItemId: string | null
  ) => {
    const currentItems = selectedParameterItemIds.filter(
      (id) =>
        parameterItems.find((item) => item.id === id)?.parameterId !==
        parameterId
    );

    if (parameterItemId) {
      onParameterItemIdsChange([...currentItems, parameterItemId]);
    } else {
      onParameterItemIdsChange(currentItems);
    }
  };

  const handleNumericalParameterChange = (
    parameterId: string,
    parameterItemId: string | null
  ) => {
    const currentItems = selectedParameterItemIds.filter(
      (id) =>
        parameterItems.find((item) => item.id === id)?.parameterId !==
        parameterId
    );

    if (parameterItemId) {
      onParameterItemIdsChange([...currentItems, parameterItemId]);
    } else {
      onParameterItemIdsChange(currentItems);
    }
  };

  const getSelectedNumericalValue = (parameterId: string): number[] => {
    const selectedItem = selectedItemsByParameter[parameterId]?.[0];
    if (selectedItem) {
      const value = parseFloat(selectedItem.value);
      return isNaN(value) ? [0] : [value];
    }
    return [0];
  };

  const getNumericalParameterRange = (
    parameterId: string
  ): { min: number; max: number; step: number } => {
    const items = parameterItemsByParameter[parameterId] || [];
    const values = items
      .map((item) => parseFloat(item.value))
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
    const items = parameterItemsByParameter[parameterId] || [];
    const targetValue = value[0];

    if (items.length === 0 || targetValue === undefined) return;

    // Find the closest parameter item value
    let closestItem = items[0];
    let minDistance = Infinity;

    for (const item of items) {
      const itemValue = parseFloat(item.value);
      if (!isNaN(itemValue)) {
        const distance = Math.abs(itemValue - targetValue);
        if (distance < minDistance) {
          minDistance = distance;
          closestItem = item;
        }
      }
    }

    if (closestItem) {
      handleNumericalParameterChange(parameterId, closestItem.id);
    }
  };

  const resetParameter = (parameterId: string) => {
    handleNonNumericalParameterChange(parameterId, null);
  };

  const resetNumericalParameter = (parameterId: string) => {
    handleNumericalParameterChange(parameterId, null);
  };

  return (
    <div className="relative">
      {/* Vertical divider - only visible on large screens */}
      <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-border transform -translate-x-1/2" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Non-numerical parameters */}
        <div className="space-y-4">
          {nonNumericalParameters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categorical parameters available
            </p>
          ) : (
            <div className="space-y-4">
              {nonNumericalParameters.map((parameter) => {
                const items = parameterItemsByParameter[parameter.id] || [];
                const selectedItem =
                  selectedItemsByParameter[parameter.id]?.[0];

                return (
                  <div key={parameter.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        {parameter.name}
                      </Label>
                      {selectedItem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetParameter(parameter.id)}
                          className="h-6 w-6 p-0 hover:bg-muted"
                          disabled={disabled}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <Select
                      value={selectedItem?.id || "none"}
                      onValueChange={(value) =>
                        handleNonNumericalParameterChange(
                          parameter.id,
                          value === "none" ? null : value
                        )
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={`Select ${parameter.name.toLowerCase()}`}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No preference</SelectItem>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{item.name}</span>
                              {!item.defaultItem && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs ml-2"
                                >
                                  Custom
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedItem && (
                      <p className="text-xs text-muted-foreground">
                        {selectedItem.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right side - Numerical parameters */}
        <div className="space-y-4">
          {numericalParameters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No numerical parameters available
            </p>
          ) : (
            <div className="space-y-6">
              {numericalParameters.map((parameter) => {
                const items = parameterItemsByParameter[parameter.id] || [];
                const selectedItem =
                  selectedItemsByParameter[parameter.id]?.[0];
                const { min, max, step } = getNumericalParameterRange(
                  parameter.id
                );
                const currentValue = getSelectedNumericalValue(parameter.id);

                return (
                  <div key={parameter.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">
                          {parameter.name}
                        </Label>
                        {selectedItem && (
                          <p className="text-xs text-muted-foreground">
                            {selectedItem.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {currentValue[0]}
                        </span>
                        {selectedItem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              resetNumericalParameter(parameter.id)
                            }
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
                        handleNumericalSliderChange(parameter.id, value)
                      }
                      className="w-full"
                      disabled={items.length === 0 || disabled}
                    />

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{min}</span>
                      <span>{max}</span>
                    </div>

                    {selectedItem && (
                      <p className="text-xs text-muted-foreground">
                        {selectedItem.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
