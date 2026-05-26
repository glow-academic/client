/**
 * Points.tsx
 * Resource component for points.
 *
 *   mode="picker"   → compact numeric input for user-settable points (e.g. pass
 *                    threshold). Optional suggestion chips render if `points`
 *                    contains a short list of pre-seeded options.
 *   mode="readonly" → plain value display (e.g. computed total). No input, no
 *                    chips, no accept/reject UI.
 *
 * The picker reports the numeric `value` upward via `onChange`. Callers that
 * need a resolved resource ID should pair the value with an ID lookup on save
 * (server resolves numeric → pass-type Points resource).
 */

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PointsResourceItem {
  id?: string | null;
  value?: number | null;
  type?: string | null; // "pass" | "total"
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface PointsProps {
  mode?: "picker" | "readonly";
  value?: number | null;
  points?: PointsResourceItem[]; // optional suggestion pool (picker only)
  disabled?: boolean;
  onChange?: (value: number | null) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  filterType?: string; // only show suggestions with this `type` (default "pass")
  className?: string;
  /**
   * Per-field pending lifecycle (single-value, `pass_points_id`).
   * Pattern after Instructions.tsx / Colors.tsx — pending = the one
   * pending points resource. TODO: wire accept/reject UI in the picker;
   * props are accepted now so the parent can pass them down once a
   * pending affordance is added.
   */
  onAcceptPending?: (pendingId: string) => void;
  onRejectPending?: (pendingId: string) => void;
}

export function Points({
  mode = "picker",
  value,
  points,
  disabled = false,
  onChange,
  label = "Points",
  id = "points",
  required = false,
  placeholder = "e.g. 16",
  filterType = "pass",
  className,
  onAcceptPending: _onAcceptPending,
  onRejectPending: _onRejectPending,
}: PointsProps) {
  if (mode === "readonly") {
    return (
      <div className={cn("flex items-baseline gap-2", className)}>
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-lg font-semibold tabular-nums">
          {value ?? "—"}
        </span>
      </div>
    );
  }

  // picker mode
  const suggestions = useMemo(
    () =>
      (points ?? [])
        .filter((p) => p.type === filterType && typeof p.value === "number")
        .map((p) => p.value as number)
        // dedupe + sort for a clean chip row
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b),
    [points, filterType],
  );

  const [internal, setInternal] = useState<string>(
    value != null ? String(value) : "",
  );
  const isDirtyRef = useRef(false);

  // Sync from prop when the user hasn't typed yet.
  useEffect(() => {
    if (isDirtyRef.current) return;
    setInternal(value != null ? String(value) : "");
  }, [value]);

  const commit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        onChange?.(null);
        return;
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return;
      onChange?.(n);
    },
    [onChange],
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1 text-sm font-medium">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="w-28"
          value={internal}
          onChange={(e) => {
            isDirtyRef.current = true;
            setInternal(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => {
            isDirtyRef.current = false;
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
        {suggestions.length > 0 && (
          <div className="flex items-center gap-1">
            {suggestions.map((n) => {
              const active = value === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    isDirtyRef.current = false;
                    setInternal(String(n));
                    onChange?.(n);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-muted/40 hover:bg-muted",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
