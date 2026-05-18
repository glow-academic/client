/**
 * Thresholds.tsx — per-type threshold slider.
 *
 * One invocation = one type (success / warning / danger / …). The slider
 * emits a numeric value; parent tracks the draft in a
 * `threshold_values: [{id?, type, value}]` array. Server resolver
 * find-or-creates a thresholds_resource row matching (type, value) and
 * swaps the id of the same type into threshold_ids on save.
 *
 * No catalog grid — just a single slider per type. The suggested
 * starting value is pulled from the currently-attached threshold of
 * that type (if any) or the min of the `thresholds` catalog for that
 * type, falling back to `defaultValue`.
 */
"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCallback, useMemo } from "react";

export interface ThresholdResourceItem {
  id?: string | null;
  type?: string | null;
  value?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

export interface ThresholdsProps {
  /** Threshold type this slider controls — e.g. "success" / "warning" / "danger". */
  type: string;
  /** Human-readable label shown above the slider. Defaults to capitalized type. */
  label?: string;
  /** Full thresholds catalog from the server. Filtered to this `type` internally. */
  thresholds: ThresholdResourceItem[];
  /** Currently-attached threshold id for this type (via setting's threshold_ids). */
  current_id?: string | null;
  /** Fallback starting value when no catalog/selection exists. */
  defaultValue?: number;
  /** Slider bounds. */
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Called with the new integer value when the user finishes a drag. */
  onChange: (value: number) => void;
  description?: string;
}

export function Thresholds({
  type,
  label,
  thresholds,
  current_id,
  defaultValue = 70,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  onChange,
  description,
}: ThresholdsProps) {
  const rowsForType = useMemo(
    () =>
      thresholds.filter(
        (t) =>
          t.type === type && typeof t.value === "number" && t.value !== null,
      ),
    [thresholds, type],
  );

  // Current value: prefer the selected row, then any matching row, then
  // the default fallback.
  const currentValue = useMemo(() => {
    if (current_id) {
      const picked = rowsForType.find((t) => t.id === current_id);
      if (picked && typeof picked.value === "number") return picked.value;
    }
    const selected = rowsForType.find((t) => t.selected);
    if (selected && typeof selected.value === "number") return selected.value;
    if (rowsForType.length > 0) {
      const firstValue = rowsForType[0]!.value;
      if (typeof firstValue === "number") return firstValue;
    }
    return defaultValue;
  }, [rowsForType, current_id, defaultValue]);

  const displayLabel =
    label ??
    type
      .split("_")
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join(" ");

  const handleCommit = useCallback(
    (values: number[]) => {
      const next = values[0];
      if (typeof next !== "number") return;
      if (next === currentValue) return;
      onChange(next);
    },
    [currentValue, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {displayLabel}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {currentValue}
        </span>
      </div>
      <Slider
        value={[currentValue]}
        onValueCommit={handleCommit}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}
