/**
 * ParameterSelector.tsx
 * Component for selecting scenario parameters with dynamic parameter items
 * Updated to work with refactored ParameterItemPicker
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";


type ParameterMappingItem = {
  name: string;
  description: string;
  numerical: boolean;
  document_parameter: boolean;
  persona_parameter: boolean;
};

type FieldMappingItem = {
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
};

type FieldMapping = Record<string, FieldMappingItem>;
type ParameterMapping = Record<string, ParameterMappingItem>;

// Component for slider with precisely aligned labels
function SliderLabelContainer({
  min,
  max,
  minValue,
  maxValue,
  hasSelection,
  value,
  onValueChange,
  step,
  disabled,
}: {
  min: number;
  max: number;
  minValue: number | undefined;
  maxValue: number | undefined;
  hasSelection: boolean;
  value: number[];
  onValueChange: (value: number[]) => void;
  step: number;
  disabled: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [handlePositions, setHandlePositions] = useState<
    Record<number, number>
  >({});

  useEffect(() => {
    const updateHandlePositions = () => {
      if (containerRef.current && sliderRef.current) {
        const handles = sliderRef.current.querySelectorAll(
          '[data-slot="slider-thumb"]',
        ) as NodeListOf<HTMLElement>;
        const containerRect = containerRef.current.getBoundingClientRect();
        const positions: Record<number, number> = {};

        handles.forEach((handle, index) => {
          const handleRect = handle.getBoundingClientRect();
          const handleCenter = handleRect.left + handleRect.width / 2;
          const positionInContainer = handleCenter - containerRect.left;
          const containerWidth = containerRef.current!.offsetWidth;
          if (containerWidth > 0) {
            const handleValue = value[index];
            if (handleValue !== undefined) {
              positions[handleValue] =
                (positionInContainer / containerWidth) * 100;
            }
          }
        });

        setHandlePositions(positions);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      updateHandlePositions();
    });

    window.addEventListener("resize", updateHandlePositions);
    // Use MutationObserver to watch for slider changes
    const observer = new MutationObserver(() => {
      requestAnimationFrame(updateHandlePositions);
    });
    if (sliderRef.current) {
      observer.observe(sliderRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateHandlePositions);
      observer.disconnect();
    };
  }, [value, min, max]);

  const getLabelPosition = (val: number): number => {
    // Use measured handle position if available, otherwise fallback to calculation
    if (handlePositions[val] !== undefined) {
      return handlePositions[val];
    }
    // Fallback to percentage calculation
    return ((val - min) / (max - min)) * 100;
  };

  return (
    <div
      className="relative"
      style={{ paddingBottom: "8px" }}
      ref={containerRef}
    >
      <div ref={sliderRef}>
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={onValueChange}
          className="w-full"
          disabled={disabled}
        />
      </div>

      {/* Combined labels container - all at bottom-0 for perfect alignment */}
      <div className="absolute bottom-0 inset-x-0">
        {/* Min edge label - always shown */}
        <span className="absolute left-0 text-xs text-muted-foreground leading-none">
          {min}
        </span>

        {/* Max edge label - always shown */}
        <span className="absolute right-0 text-xs text-muted-foreground leading-none">
          {max}
        </span>

        {/* Handle value labels - only show when not at edges */}
        {hasSelection && minValue !== undefined && maxValue !== undefined && (
          <>
            {minValue === maxValue ? (
              // Single handle case - only show if not at min or max
              minValue !== min &&
              minValue !== max && (
                <span
                  className="absolute text-xs font-medium text-muted-foreground leading-none whitespace-nowrap"
                  style={{
                    left: `${getLabelPosition(minValue)}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {minValue}
                </span>
              )
            ) : (
              // Range case - show handles only if not at edges
              <>
                {minValue !== min && (
                  <span
                    className="absolute text-xs font-medium text-muted-foreground leading-none whitespace-nowrap"
                    style={{
                      left: `${getLabelPosition(minValue)}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {minValue}
                  </span>
                )}
                {maxValue !== max && (
                  <span
                    className="absolute text-xs font-medium text-muted-foreground leading-none whitespace-nowrap"
                    style={{
                      left: `${getLabelPosition(maxValue)}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {maxValue}
                  </span>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ParameterSelectorProps {
  parameterMapping: ParameterMapping;
  fieldMapping: FieldMapping;
  validParameterItemIds: string[];
  selectedParameterItemIds: string[];
  onParameterItemIdsChange: (parameterItemIds: string[]) => void;
  disabled?: boolean;
  maxItemsPerParameter?: number; // Maximum items allowed per parameter
}

export function ParameterSelector({
  parameterMapping,
  fieldMapping,
  validParameterItemIds,
  selectedParameterItemIds,
  onParameterItemIdsChange,
  disabled = false,
  maxItemsPerParameter,
}: ParameterSelectorProps) {
  // Search state per parameter
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  
  // Refs to track scroll containers for each parameter
  const scrollContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Preserve scroll position when selectedParameterItemIds changes
  useEffect(() => {
    // Store scroll positions before potential re-render
    const scrollPositions: Record<string, number> = {};
    Object.entries(scrollContainerRefs.current).forEach(([paramId, container]) => {
      if (container) {
        scrollPositions[paramId] = container.scrollTop;
      }
    });
    
    // Restore scroll positions after render
    requestAnimationFrame(() => {
      Object.entries(scrollContainerRefs.current).forEach(([paramId, container]) => {
        if (container && scrollPositions[paramId] !== undefined) {
          container.scrollTop = scrollPositions[paramId];
        }
      });
    });
  }, [selectedParameterItemIds]);
  
  // Group valid parameter items by parameter (from mapping)
  const parameterItemsByParameter = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    validParameterItemIds.forEach((itemId) => {
      const item = fieldMapping[itemId];
      if (item) {
        const parameterId = item.parameter_id;
        if (!grouped[parameterId]) {
          grouped[parameterId] = [];
        }
        grouped[parameterId]!.push(itemId);
      }
    });
    return grouped;
  }, [validParameterItemIds, fieldMapping]);

  // Separate parameters into numerical and non-numerical
  // Use all parameters from parameterMapping (not just those with fields) so we can see parameters with 0 fields
  const { numericalParameters, nonNumericalParameters } = useMemo(() => {
    const parameterIds = Object.keys(parameterMapping);
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
  }, [parameterMapping]);

  // Group selected items by parameter
  const selectedItemsByParameter = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    selectedParameterItemIds.forEach((itemId) => {
      const item = fieldMapping[itemId];
      if (item) {
        const parameterId = item.parameter_id;
        if (!grouped[parameterId]) {
          grouped[parameterId] = [];
        }
        grouped[parameterId]!.push(itemId);
      }
    });
    return grouped;
  }, [selectedParameterItemIds, fieldMapping]);

  const handleNonNumericalParameterChange = (
    parameterId: string,
    newIds: string[],
  ) => {
    const currentItems = selectedParameterItemIds.filter(
      (id) => fieldMapping[id]?.parameter_id !== parameterId,
    );

    // Limit to maxItemsPerParameter if specified
    let limitedIds = newIds;
    if (
      maxItemsPerParameter !== undefined &&
      newIds.length > maxItemsPerParameter
    ) {
      limitedIds = newIds.slice(0, maxItemsPerParameter);
    }

    // Accept selected IDs (with limit if specified)
    if (limitedIds.length > 0) {
      onParameterItemIdsChange([...currentItems, ...limitedIds]);
    } else {
      onParameterItemIdsChange(currentItems);
    }
  };

  const handleNumericalParameterChange = (
    parameterId: string,
    newIds: string[],
  ) => {
    const currentItems = selectedParameterItemIds.filter(
      (id) => fieldMapping[id]?.parameter_id !== parameterId,
    );

    // Accept all IDs (for range selection, multiple items within range)
    if (newIds.length > 0) {
      onParameterItemIdsChange([...currentItems, ...newIds]);
    } else {
      onParameterItemIdsChange(currentItems);
    }
  };

  // Extract numeric value from field name (for numerical parameters)
  // Names may be in format "Name (5)" or just "5"
  const extractNumericValue = (name: string): number => {
    // Try to extract number from parentheses: "Name (5)" -> 5
    const parenMatch = name.match(/\((\d+(?:\.\d+)?)\)/);
    if (parenMatch && parenMatch[1]) {
      return parseFloat(parenMatch[1]);
    }
    // Try parsing the entire name as a number
    const parsed = parseFloat(name.trim());
    return isNaN(parsed) ? NaN : parsed;
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
        const item = fieldMapping[itemId];
        return item ? extractNumericValue(item.name) : NaN;
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
    parameterId: string,
  ): { min: number; max: number; step: number } => {
    const itemIds = parameterItemsByParameter[parameterId] || [];
    const values = itemIds
      .map((itemId) => {
        const item = fieldMapping[itemId];
        return item ? extractNumericValue(item.name) : NaN;
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
    value: number[],
  ) => {
    const itemIds = parameterItemsByParameter[parameterId] || [];

    if (itemIds.length === 0 || value.length < 2) return;

    const [minRange, maxRange] = value;
    if (minRange === undefined || maxRange === undefined) return;

    // Find ALL parameter items whose values fall within the range (inclusive)
    const matchingItemIds: string[] = [];

    for (const itemId of itemIds) {
      const item = fieldMapping[itemId];
      if (item) {
        // Extract numeric value from name (format: "Name (value)" or just "value")
        const numericValue = extractNumericValue(item.name);
        if (
          !isNaN(numericValue) &&
          numericValue >= minRange &&
          numericValue <= maxRange
        ) {
          matchingItemIds.push(itemId);
        }
      }
    }

    // Update selection with all matching items
    handleNumericalParameterChange(parameterId, matchingItemIds);
  };

  const resetNumericalParameter = (parameterId: string) => {
    handleNumericalParameterChange(parameterId, []);
  };

  // Combine all parameters into a single list, maintaining order
  const allParameters = useMemo(() => {
    return [...nonNumericalParameters, ...numericalParameters];
  }, [nonNumericalParameters, numericalParameters]);

  // Compute filtered item IDs for all non-numerical parameters (moved outside map to avoid hook violation)
  const filteredItemIdsByParameter = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const parameterId of nonNumericalParameters) {
      const itemIds = parameterItemsByParameter[parameterId] || [];
      const searchTerm = searchTerms[parameterId] || "";
      if (!searchTerm.trim()) {
        result[parameterId] = itemIds;
      } else {
        const searchLower = searchTerm.toLowerCase();
        result[parameterId] = itemIds.filter((itemId) => {
          const item = fieldMapping[itemId];
          if (!item) return false;
          const searchText = `${item.name} ${item.description || ""}`.toLowerCase();
          return searchText.includes(searchLower);
        });
      }
    }
    return result;
  }, [nonNumericalParameters, parameterItemsByParameter, searchTerms, fieldMapping]);

  const hasParameters = allParameters.length > 0;

  return (
    <div className="space-y-6">
      {hasParameters ? (
        allParameters.map((parameterId) => {
          const parameter = parameterMapping[parameterId];
          const isNumerical = parameter?.numerical ?? false;
          const itemIds = parameterItemsByParameter[parameterId] || [];
          const selectedItemIds = selectedItemsByParameter[parameterId] || [];

          if (isNumerical) {
            // Numerical parameter rendering
            const { min, max, step } = getNumericalParameterRange(parameterId);
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

                <SliderLabelContainer
                  min={min}
                  max={max}
                  minValue={minValue}
                  maxValue={maxValue}
                  hasSelection={hasSelection}
                  value={currentValue}
                  onValueChange={(value) =>
                    handleNumericalSliderChange(parameterId, value)
                  }
                  step={step}
                  disabled={itemIds.length === 0 || disabled}
                />

                {hasSelection && selectedItemIds.length > 0 && (
                  <div className="space-y-1 mt-6">
                    {(() => {
                      // Sort selected items by their numerical values to get start and end
                      const sortedItems = selectedItemIds
                        .map((id) => {
                          const item = fieldMapping[id];
                          if (!item) return null;
                          const value = extractNumericValue(item.name);
                          return {
                            id,
                            item,
                            value: isNaN(value) ? 0 : value,
                          };
                        })
                        .filter(
                          (
                            item,
                          ): item is {
                            id: string;
                            item: (typeof fieldMapping)[string];
                            value: number;
                          } => item !== null,
                        )
                        .sort((a, b) => a.value - b.value);

                      if (sortedItems.length === 0) return null;

                      const startItem = sortedItems[0];
                      if (!startItem) return null;

                      const endItem =
                        sortedItems.length > 1
                          ? sortedItems[sortedItems.length - 1]
                          : null;

                      return (
                        <>
                          {/* Show start value */}
                          <p
                            key={startItem.id}
                            className="text-xs text-muted-foreground"
                          >
                            {startItem.item.name}: {startItem.item.description}
                          </p>
                          {/* Show end value only if different from start */}
                          {endItem && endItem.id !== startItem.id && (
                            <p
                              key={endItem.id}
                              className="text-xs text-muted-foreground"
                            >
                              {endItem.item.name}: {endItem.item.description}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          } else {
            // Non-numerical parameter rendering with card grid
            const filteredItemIds = filteredItemIdsByParameter[parameterId] || itemIds;
            
            return (
              <div key={parameterId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {parameter?.name || "Parameter"}
                  </Label>
                </div>

                {maxItemsPerParameter !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Select up to {maxItemsPerParameter}{" "}
                    {parameter?.name?.toLowerCase() || "items"}
                  </p>
                )}

                {/* Search bar */}
                <div className="flex h-9 items-center gap-2 border-b px-0">
                  <Search className="size-4 shrink-0 opacity-50" />
                  <input
                    type="text"
                    placeholder={`Search ${parameter?.name?.toLowerCase() || "items"}...`}
                    value={searchTerm}
                    onChange={(e) =>
                      setSearchTerms((prev) => ({
                        ...prev,
                        [parameterId]: e.target.value,
                      }))
                    }
                    className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div 
                  ref={(el) => {
                    scrollContainerRefs.current[parameterId] = el;
                  }}
                  className="grid grid-cols-5 gap-3 max-h-[184px] overflow-y-auto py-2 -mx-6 px-6"
                >
                  {filteredItemIds.map((itemId) => {
                    const item = fieldMapping[itemId];
                    if (!item) return null;
                    
                    const isSelected = selectedItemIds.includes(itemId);
                    const isDisabled =
                      disabled ||
                      (maxItemsPerParameter !== undefined &&
                        !isSelected &&
                        selectedItemIds.length >= maxItemsPerParameter);
                    
                    return (
                      <button
                        key={itemId}
                        type="button"
                        onClick={(e) => {
                          if (isDisabled) return;
                          // Prevent default to avoid any scroll behavior
                          e.preventDefault();
                          const isCurrentlySelected = selectedItemIds.includes(itemId);
                          let newIds: string[];
                          
                          if (isCurrentlySelected) {
                            newIds = selectedItemIds.filter((id) => id !== itemId);
                          } else {
                            // Enforce maxItemsPerParameter limit
                            let limitedIds = [...selectedItemIds, itemId];
                            if (
                              maxItemsPerParameter !== undefined &&
                              limitedIds.length > maxItemsPerParameter
                            ) {
                              limitedIds = limitedIds.slice(0, maxItemsPerParameter);
                            }
                            newIds = limitedIds;
                          }
                          handleNonNumericalParameterChange(parameterId, newIds);
                        }}
                        disabled={isDisabled}
                        className={cn(
                          "relative flex flex-col gap-2 p-3 rounded-lg border bg-card text-card-foreground shadow-sm transition-all text-left",
                          "hover:shadow-md hover:bg-accent/50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "disabled:pointer-events-none disabled:opacity-50",
                          isSelected && "ring-2 ring-primary bg-accent"
                        )}
                      >
                        <div className="font-medium text-sm line-clamp-1">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </div>
                        )}
                        {isSelected && (
                          <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
        })
      ) : (
        <p className="text-sm text-muted-foreground">
          No parameters available.
        </p>
      )}
    </div>
  );
}
