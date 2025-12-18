"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PricingEntry {
  unit_id: string;
  price: number;
}

export interface Unit {
  id: string;
  name: string;
  unit_category: string;
  value: number;
}

export interface PricingEntryListProps {
  entries: PricingEntry[];
  units: Unit[];
  onEntriesChange: (entries: PricingEntry[]) => void;
  readonly?: boolean;
  placeholder?: string;
}

export function PricingEntryList({
  entries,
  units,
  onEntriesChange,
  readonly = false,
  placeholder = "Price (USD)",
}: PricingEntryListProps) {
  const handlePriceChange = (index: number, price: number) => {
    const newEntries = [...entries];
    newEntries[index] = {
      ...newEntries[index],
      unit_id: newEntries[index]?.unit_id || "",
      price: Math.max(0, price), // Ensure price is not negative
    };
    onEntriesChange(newEntries);
  };

  const handleRemoveEntry = (index: number) => {
    const newEntries = entries.filter((_, i) => i !== index);
    onEntriesChange(newEntries);
  };

  const handleAddEntry = () => {
    if (units.length === 0) return;
    // Find first unit that's not already in entries
    const existingUnitIds = new Set(entries.map((e) => e.unit_id));
    const availableUnit = units.find((u) => !existingUnitIds.has(u.id));
    if (availableUnit) {
      onEntriesChange([...entries, { unit_id: availableUnit.id, price: 0.0 }]);
    } else {
      // If all units are already added, just add the first unit again
      if (units[0]) {
        onEntriesChange([...entries, { unit_id: units[0].id, price: 0.0 }]);
      }
    }
  };

  const getUnit = (unitId: string) => {
    return units.find((u) => u.id === unitId);
  };

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddEntry}
            disabled={readonly || units.length === 0}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add pricing entry
          </Button>
        </div>
      ) : (
        <>
          {entries.map((entry, index) => {
            const unit = getUnit(entry.unit_id);
            return (
              <div
                key={`entry-${entry.unit_id}-${index}`}
                className="flex items-end gap-2"
              >
                {/* Unit Name Display */}
                <div className="flex-1">
                  {index === 0 && (
                    <Label className="text-sm font-medium mb-2 block">
                      Unit
                    </Label>
                  )}
                  <div className="flex h-10 items-center px-3 py-2 text-sm bg-muted rounded-md border border-input">
                    <span className="font-medium">
                      {unit?.name || "Unknown Unit"}
                    </span>
                    {unit && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({unit.unit_category.toUpperCase()},{" "}
                        {unit.value.toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                {/* Price Input */}
                <div className="flex-1">
                  {index === 0 && (
                    <Label className="text-sm font-medium mb-2 block">
                      Price
                    </Label>
                  )}
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={entry.price}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0.0;
                      handlePriceChange(index, value);
                    }}
                    disabled={readonly}
                    placeholder={
                      unit
                        ? `Price (per ${unit.value.toLocaleString()} ${unit.name})`
                        : placeholder
                    }
                    className={cn(
                      "h-10",
                      entry.price < 0 && "border-destructive",
                    )}
                  />
                </div>

                {/* Delete Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemoveEntry(index)}
                  className="h-10 w-10 shrink-0"
                  disabled={readonly}
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
              disabled={readonly || units.length === 0}
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
