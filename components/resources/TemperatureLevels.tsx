/**
 * TemperatureLevels.tsx — dual-handle range picker.
 *
 * Picks a [lower, upper] pair from the temperature_levels_resource catalog
 * via a Radix two-handle Slider. The catalog defines bounds (min/max) and
 * step (tightest spacing between rows). On commit, each handle snaps to
 * the nearest catalog row's id, and the parent receives a length-2
 * `temperature_level_ids: [lowerId, upperId]` array sorted ascending by
 * temperature.
 *
 * The DB junction (`model_temperature_levels_junction`) is many-to-many
 * keyed on (model_id, temperature_levels_id), so persisting two ids is a
 * native shape — no schema change required.
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface TemperatureLevelResourceItem {
  id?: string | null | undefined;
  temperature?: number | string | null | undefined;
  generated?: boolean | null | undefined;
  suggested?: boolean | null | undefined;
  pending?: boolean | null | undefined;
}

export interface TemperatureLevelsProps {
  /** Currently-selected temperature_levels_resource ids. Length 0, 1, or 2. */
  temperature_level_ids?: string[];
  show_temperature_levels?: boolean;
  /** Full catalog. Bounds + step derive from this. */
  temperature_levels?: TemperatureLevelResourceItem[];
  disabled?: boolean;
  /** Emitted as [lowerId, upperId] sorted ascending by temperature. */
  onChange: (ids: string[]) => void;
  label?: string;
  required?: boolean;
  id?: string;
  helpText?: string;
}

interface CatalogRow {
  id: string;
  value: number;
  pending: boolean;
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TemperatureLevels({
  temperature_level_ids,
  show_temperature_levels = true,
  temperature_levels,
  disabled = false,
  onChange,
  label = "Temperature Range",
  required = false,
  id = "temperature_level",
  helpText,
}: TemperatureLevelsProps) {
  const show = show_temperature_levels ?? true;
  const ids = useMemo(() => temperature_level_ids ?? [], [temperature_level_ids]);

  // Catalog → sorted-by-value array of usable rows.
  const catalog = useMemo<CatalogRow[]>(() => {
    return (temperature_levels ?? [])
      .map((tl) => {
        const value = toNumber(tl.temperature ?? null);
        if (!tl.id || value == null) return null;
        return { id: tl.id, value, pending: tl.pending === true };
      })
      .filter((r): r is CatalogRow => r !== null)
      .sort((a, b) => a.value - b.value);
  }, [temperature_levels]);

  const byId = useMemo(() => {
    const m = new Map<string, CatalogRow>();
    for (const row of catalog) m.set(row.id, row);
    return m;
  }, [catalog]);

  // Bounds + step from catalog. If catalog is empty/single, fall back to
  // a sane [0, 2] / 0.01 default so the slider is still mountable.
  const min = catalog[0]?.value ?? 0;
  const max = catalog[catalog.length - 1]?.value ?? 2;
  const step = useMemo(() => {
    if (catalog.length < 2) return 0.01;
    let smallest = Infinity;
    for (let i = 1; i < catalog.length; i++) {
      const a = catalog[i - 1]!.value;
      const b = catalog[i]!.value;
      const d = b - a;
      if (d > 0 && d < smallest) smallest = d;
    }
    return Number.isFinite(smallest) ? Number(smallest.toFixed(3)) : 0.01;
  }, [catalog]);

  // Resolve current selection → {lower, upper} numeric values.
  const { lowerValue, upperValue } = useMemo(() => {
    const selected = ids
      .map((selId) => byId.get(selId))
      .filter((r): r is CatalogRow => !!r)
      .sort((a, b) => a.value - b.value);
    if (selected.length === 0) return { lowerValue: min, upperValue: max };
    if (selected.length === 1) {
      const only = selected[0]!;
      return { lowerValue: only.value, upperValue: only.value };
    }
    return {
      lowerValue: selected[0]!.value,
      upperValue: selected[selected.length - 1]!.value,
    };
  }, [ids, byId, min, max]);

  // Snap a numeric slider position to the nearest catalog row id.
  const snapToCatalog = useCallback(
    (value: number): CatalogRow | null => {
      if (catalog.length === 0) return null;
      let best = catalog[0]!;
      let bestDist = Math.abs(best.value - value);
      for (let i = 1; i < catalog.length; i++) {
        const row = catalog[i]!;
        const d = Math.abs(row.value - value);
        if (d < bestDist) {
          best = row;
          bestDist = d;
        }
      }
      return best;
    },
    [catalog],
  );

  const handleCommit = useCallback(
    (values: number[]) => {
      const a = values[0];
      const b = values[1];
      if (a == null || b == null) return;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const lowerRow = snapToCatalog(lo);
      const upperRow = snapToCatalog(hi);
      if (!lowerRow || !upperRow) return;
      const next =
        lowerRow.id === upperRow.id
          ? [lowerRow.id]
          : [lowerRow.id, upperRow.id];
      if (
        next.length === ids.length &&
        next.every((nid, i) => nid === ids[i])
      ) {
        return;
      }
      onChange(next);
    },
    [snapToCatalog, ids, onChange],
  );

  // Pending: any selected id is flagged pending.
  const pendingIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of catalog) if (row.pending) set.add(row.id);
    return set;
  }, [catalog]);
  const showDiff = ids.some((selId) => pendingIds.has(selId));

  const handleAccept = useCallback(() => {
    // Pending ids are already in selection — next save persists them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(ids.filter((selId) => !pendingIds.has(selId)));
  }, [ids, pendingIds, onChange]);

  if (!show) return null;

  const formatValue = (v: number) => v.toFixed(2);

  return (
    <div className="space-y-3 min-w-0 w-full">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
        {showDiff && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success hover:text-success"
                    onClick={handleAccept}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Accept</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={handleReject}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
        <span className="ml-auto text-sm font-mono tabular-nums text-muted-foreground">
          {formatValue(lowerValue)} – {formatValue(upperValue)}
        </span>
      </div>

      <div className="px-1 pt-1">
        <Slider
          value={[lowerValue, upperValue]}
          onValueCommit={handleCommit}
          min={min}
          max={max}
          step={step}
          disabled={disabled || catalog.length === 0}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 font-mono tabular-nums">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      </div>

      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
