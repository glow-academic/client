/**
 * PricingPicker.tsx
 * Used to configure pricing entries for models (input/output/cached with units and prices)
 * @AshokSaravanan222
 * 12/02/2025
 */

"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { PricingTypePicker, type PricingType } from "./PricingTypePicker";
import type { UnitItem } from "./unit-types";

export interface PricingEntry {
  type: PricingType;
  unit_id: string;
  price: number;
}

export interface PricingPickerProps {
  pricing: PricingEntry[];
  units: UnitItem[];
  onPricingChange: (pricing: PricingEntry[]) => void;
  disabled?: boolean;
}

export function PricingPicker({
  pricing,
  units,
  onPricingChange,
  disabled = false,
}: PricingPickerProps) {
  const handleAddEntry = () => {
    const newEntry: PricingEntry = {
      type: "input",
      unit_id: units[0]?.id || "",
      price: 0.0,
    };
    onPricingChange([...pricing, newEntry]);
  };

  const handleRemoveEntry = (index: number) => {
    const newPricing = pricing.filter((_, i) => i !== index);
    onPricingChange(newPricing);
  };

  const handleEntryChange = (
    index: number,
    field: keyof PricingEntry,
    value: string | number,
  ) => {
    const newPricing = [...pricing];
    newPricing[index] = {
      ...newPricing[index]!,
      [field]: value,
    };
    onPricingChange(newPricing);
  };

  const getUnitForEntry = (unitId: string): UnitItem | undefined => {
    return units.find((u) => u.id === unitId);
  };

  const getFilteredUnitsForType = (pricingType: PricingType): UnitItem[] => {
    // Filter units based on pricing type
    // Input/Output typically use tokens, cached uses tokens, but could also use other units
    if (pricingType === "cached") {
      return units.filter((u) => u.unit_category === "tokens");
    }
    // For input/output, allow tokens, seconds, or units depending on modality
    // For now, show all units - the user can filter based on model modality
    return units;
  };

  return (
    <div className="space-y-2">
      {pricing.length === 0 ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddEntry}
            disabled={disabled}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add entry
          </Button>
        </div>
      ) : (
        <>
          {pricing.map((entry, index) => {
            const unit = getUnitForEntry(entry.unit_id);
            const filteredUnits = getFilteredUnitsForType(entry.type);

            return (
              <div
                key={index}
                className={`flex items-end gap-2 ${index === 0 ? "" : ""}`}
              >
                {/* Pricing Type */}
                <div className={`flex-1 ${index === 0 ? "space-y-2" : ""}`}>
                  {index === 0 && (
                    <Label
                      htmlFor={`pricing-type-${index}`}
                      className="text-sm font-medium"
                    >
                      Type
                    </Label>
                  )}
                  <PricingTypePicker
                    selectedType={entry.type}
                    onSelect={(type) => handleEntryChange(index, "type", type)}
                    placeholder="Select type..."
                    disabled={disabled}
                  />
                </div>

                {/* Unit */}
                <div className={`flex-1 ${index === 0 ? "space-y-2" : ""}`}>
                  {index === 0 && (
                    <Label
                      htmlFor={`pricing-unit-${index}`}
                      className="text-sm font-medium"
                    >
                      Unit
                    </Label>
                  )}
                  <GenericPicker
                    items={filteredUnits}
                    selectedIds={entry.unit_id ? [entry.unit_id] : []}
                    onSelect={(ids) =>
                      handleEntryChange(index, "unit_id", ids[0] || "")
                    }
                    getId={(item) => item.id}
                    getLabel={(item) => `${item.name} (${item.value.toLocaleString()})`}
                    getSearchText={(item) => `${item.name} ${item.unit_category} ${item.value.toLocaleString()}`}
                    renderItem={(item, _isSelected) => (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({item.unit_category.toUpperCase()})
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              Value: {item.value.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    placeholder="Select unit..."
                    disabled={disabled}
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                    groupHeading="Units"
                  />
                </div>

                {/* Price */}
                <div className={`flex-1 ${index === 0 ? "space-y-2" : ""}`}>
                  {index === 0 && (
                    <Label
                      htmlFor={`pricing-price-${index}`}
                      className="text-sm font-medium"
                    >
                      Price
                    </Label>
                  )}
                  <Input
                    id={`pricing-price-${index}`}
                    type="number"
                    step="0.0001"
                    min="0"
                    value={entry.price}
                    onChange={(e) =>
                      handleEntryChange(
                        index,
                        "price",
                        parseFloat(e.target.value) || 0.0,
                      )
                    }
                    disabled={disabled}
                    placeholder={
                      unit
                        ? `Price (per ${unit.value.toLocaleString()} ${unit.name})`
                        : "Price (USD)"
                    }
                  />
                </div>

                {/* Delete Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemoveEntry(index)}
                  className={`h-8 w-8 shrink-0 ${index === 0 ? "mb-0.5" : ""}`}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddEntry}
              disabled={disabled}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add pricing entry
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
