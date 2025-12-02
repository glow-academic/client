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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnitPicker, type UnitItem } from "./UnitPicker";

export type PricingType = "input" | "output" | "cached";

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

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: "input", label: "Input" },
  { value: "output", label: "Output" },
  { value: "cached", label: "Cached" },
];

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
    value: string | number
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

  const getFilteredUnitsForType = (
    pricingType: PricingType
  ): UnitItem[] => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Pricing Configuration</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddEntry}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Pricing Entry
        </Button>
      </div>

      {pricing.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
          No pricing entries configured. Click "Add Pricing Entry" to add pricing
          for this model.
        </div>
      ) : (
        <div className="space-y-3">
          {pricing.map((entry, index) => {
            const unit = getUnitForEntry(entry.unit_id);
            const filteredUnits = getFilteredUnitsForType(entry.type);

            return (
              <div
                key={index}
                className="p-4 border rounded-lg space-y-3 bg-card"
              >
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Entry {index + 1}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEntry(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                  {/* Pricing Type */}
                  <div className="space-y-2">
                    <Label htmlFor={`pricing-type-${index}`}>Type</Label>
                    <Select
                      value={entry.type}
                      onValueChange={(value) =>
                        handleEntryChange(
                          index,
                          "type",
                          value as PricingType
                        )
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger id={`pricing-type-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICING_TYPES.map((pt) => (
                          <SelectItem key={pt.value} value={pt.value}>
                            {pt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Unit */}
                  <div className="space-y-2">
                    <Label htmlFor={`pricing-unit-${index}`}>Unit</Label>
                    <UnitPicker
                      units={filteredUnits}
                      selectedId={entry.unit_id || null}
                      onSelect={(unitId) =>
                        handleEntryChange(index, "unit_id", unitId || "")
                      }
                      placeholder="Select unit..."
                      disabled={disabled}
                    />
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <Label htmlFor={`pricing-price-${index}`}>
                      Price (USD)
                      {unit && (
                        <span className="text-xs text-muted-foreground ml-1">
                          per {unit.value.toLocaleString()} {unit.name}
                        </span>
                      )}
                    </Label>
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
                          parseFloat(e.target.value) || 0.0
                        )
                      }
                      disabled={disabled}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

