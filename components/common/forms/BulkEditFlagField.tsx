"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface BulkEditFlagFieldProps {
  /** Top-level label, e.g. "Active Status". */
  label: string;
  /** Label for the "on" state; shown in pill + switch copy. Default: "Active". */
  trueLabel?: string;
  /** Label for the "off" state; shown in pill + switch copy. Default: "Inactive". */
  falseLabel?: string;
  /** Tri-state value. null = "no change" (field will be omitted from payload). */
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}

/**
 * BulkEditFlagField
 *
 * One row per flag type in a bulk-edit dialog. Supports tri-state:
 *   - null  → "No change" (two pill buttons visible to set true/false)
 *   - true  → Switch on,  "Reset" button to go back to null
 *   - false → Switch off, "Reset" button to go back to null
 *
 * Stack multiple instances inside <BulkEditDialog> — one per flag type the
 * artifact exposes (active, template, practice, mcp, etc.).
 */
export function BulkEditFlagField({
  label,
  trueLabel = "Active",
  falseLabel = "Inactive",
  value,
  onChange,
}: BulkEditFlagFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        {value === null ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">No change</span>
            <span className="text-xs text-muted-foreground">—</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(true)}
            >
              Set {trueLabel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(false)}
            >
              Set {falseLabel}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Switch checked={value} onCheckedChange={onChange} />
            <span className="text-sm">{value ? trueLabel : falseLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => onChange(null)}
            >
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BulkEditFlagField;
