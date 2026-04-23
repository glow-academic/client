/**
 * Standards.tsx
 *
 * Self-contained rubric grid editor. Rows come from the currently selected
 * standard_groups (owned by the parent via StandardGroups picker); columns
 * are level names derived from the values themselves (plus any empty levels
 * the user has added). Cells are free-text descriptions.
 *
 * Data model:
 *   - Each cell is a standards_resource row with
 *     (standard_group_id, name, description, points).
 *   - Points are implied by column index (col 1 → 1pt, col N → Npt). Names
 *     are shared across rows — renaming a column renames every standard in
 *     that column.
 *
 * Controlled-state contract:
 *   - `values` is the single source of truth and comes from the parent.
 *     Every edit goes through `onValuesChange(next)`.
 *   - `standard_ids` is derived from values (entries with a non-null id).
 *   - Append-only server: on edit we drop the cell's stale id, the server
 *     creates a fresh standards_resource row and returns the id via
 *     form_state.standards. Parent then passes those resolved values back
 *     through the `values` prop — the grid has no internal `values` state.
 *
 * Levels are tracked locally (so the user can add an empty column before
 * typing any cell descriptions). The union of (names-in-values, levels)
 * is what gets rendered — level removals propagate into values via
 * onValuesChange so the two stay consistent from the parent's perspective.
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface StandardResourceItem {
  standard_id?: string | null;
  standard_group_id?: string | null;
  name?: string | null;
  description?: string | null;
  points?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
  selected?: boolean | null;
}

export interface StandardGroupResourceItem {
  standard_group_id?: string | null;
  name?: string | null;
  description?: string | null;
  points?: number | null;
  pass_points?: number | null;
  position?: number | null;
  active?: boolean | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
  selected?: boolean | null;
}

export interface StandardValue {
  id: string | null;
  name: string;
  description: string;
  points: number;
  standard_group_id: string;
}

export interface StandardsProps {
  /** Controlled grid values — every cell on the rubric. */
  values: StandardValue[];
  /** Rows: group IDs currently selected on the rubric. */
  standard_group_ids?: string[];
  /** Row label source — the selected StandardGroups catalog entries. */
  standard_groups?: StandardGroupResourceItem[];
  /** Show/hide toggle. */
  show_standards?: boolean;
  disabled?: boolean;
  /** Controlled emit — replaces `values` and `standard_ids` upstream. */
  onValuesChange: (values: StandardValue[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
}

function uniqPreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Ordered level names: unique names across values, sorted by ascending points. */
function derivedLevels(values: StandardValue[]): string[] {
  const sorted = [...values].sort((a, b) => a.points - b.points);
  return uniqPreserveOrder(sorted.map((v) => v.name));
}

export function Standards({
  values,
  standard_group_ids,
  standard_groups,
  show_standards = true,
  disabled = false,
  onValuesChange,
  label = "Standards",
  id = "standards",
  required = false,
  description,
}: StandardsProps) {
  const show = show_standards ?? true;
  const groupIds = useMemo(() => standard_group_ids ?? [], [standard_group_ids]);
  const allGroups = useMemo(() => standard_groups ?? [], [standard_groups]);

  const groupName = useCallback(
    (gid: string): string => {
      const g = allGroups.find((x) => x.standard_group_id === gid);
      return g?.name || "Unnamed Group";
    },
    [allGroups],
  );

  // --- Levels -------------------------------------------------------------
  // Derived-from-values plus any local "empty" extras the user added before
  // typing. Extras are flushed into values the moment the user types a cell.
  const [extraLevels, setExtraLevels] = useState<string[]>([]);

  const levels = useMemo(() => {
    const derived = derivedLevels(values);
    // Drop extras that now appear in derived (the user has typed at least
    // one cell, so the column is "real" and carries its own ordering).
    const remainingExtras = extraLevels.filter((n) => !derived.includes(n));
    return [...derived, ...remainingExtras];
  }, [values, extraLevels]);

  // If the user has empty extras that later get created via typing, they'll
  // drop out of `levels` above; no manual cleanup needed. But trim any
  // extras that have been explicitly removed elsewhere.
  const prevLevelsRef = useRef<string[]>(levels);
  useEffect(() => {
    prevLevelsRef.current = levels;
  }, [levels]);

  // --- Handlers -----------------------------------------------------------
  const cellFor = useCallback(
    (gid: string, levelName: string): StandardValue | undefined => {
      return values.find(
        (v) => v.standard_group_id === gid && v.name === levelName,
      );
    },
    [values],
  );

  const levelPoints = useCallback(
    (levelName: string): number => {
      const idx = levels.indexOf(levelName);
      return idx >= 0 ? idx + 1 : 0;
    },
    [levels],
  );

  const handleCellChange = useCallback(
    (gid: string, levelName: string, nextDescription: string) => {
      const points = levelPoints(levelName) || 1;
      const existing = values.find(
        (v) => v.standard_group_id === gid && v.name === levelName,
      );

      let next: StandardValue[];
      if (existing) {
        // Append-only: drop the stale id so the server creates a fresh
        // standards_resource row with this description.
        next = values.map((v) =>
          v.standard_group_id === gid && v.name === levelName
            ? { ...v, id: null, description: nextDescription, points }
            : v,
        );
      } else {
        next = [
          ...values,
          {
            id: null,
            name: levelName,
            description: nextDescription,
            points,
            standard_group_id: gid,
          },
        ];
      }
      onValuesChange(next);

      // If this level was an extra, it's now backed by real values.
      setExtraLevels((prev) => prev.filter((n) => n !== levelName));
    },
    [values, levelPoints, onValuesChange],
  );

  const handleAddLevel = useCallback(() => {
    const existing = new Set(levels);
    let n = levels.length + 1;
    let candidate = `Level ${n}`;
    while (existing.has(candidate)) {
      n += 1;
      candidate = `Level ${n}`;
    }
    setExtraLevels((prev) => [...prev, candidate]);
  }, [levels]);

  const handleRenameLevel = useCallback(
    (oldName: string, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === oldName) return;
      if (levels.includes(trimmed)) return; // collision — ignore

      // Move extras forward if applicable.
      setExtraLevels((prev) => prev.map((n) => (n === oldName ? trimmed : n)));

      // Rename every cell using this level and drop their ids (append-only).
      const next = values.map((v) =>
        v.name === oldName ? { ...v, id: null, name: trimmed } : v,
      );
      if (next.some((v) => v.name === trimmed)) {
        onValuesChange(next);
      }
    },
    [values, levels, onValuesChange],
  );

  const handleRemoveLevel = useCallback(
    (levelName: string) => {
      setExtraLevels((prev) => prev.filter((n) => n !== levelName));
      const next = values.filter((v) => v.name !== levelName);
      if (next.length !== values.length) onValuesChange(next);
    },
    [values, onValuesChange],
  );

  // --- Render -------------------------------------------------------------
  if (!show) return null;
  const hasGroups = groupIds.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddLevel}
          disabled={disabled || !hasGroups}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add level
        </Button>
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {!hasGroups ? (
        <div className="text-sm text-muted-foreground border rounded-md p-4">
          Select at least one standard group to start building your rubric.
        </div>
      ) : levels.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-md p-4">
          No levels yet. Click &ldquo;Add level&rdquo; to create your first
          column.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50">
              <tr>
                <th
                  className="text-left font-medium p-2 border-r align-top"
                  style={{ width: "18%" }}
                >
                  Criterion
                </th>
                {levels.map((levelName, idx) => {
                  const isLast = idx === levels.length - 1;
                  return (
                    <th
                      key={`${levelName}-${idx}`}
                      className={cn(
                        "align-top p-2 font-medium",
                        !isLast && "border-r",
                      )}
                      style={{ width: `${(100 - 18) / levels.length}%` }}
                    >
                      <div className="flex items-center gap-1">
                        <Input
                          defaultValue={levelName}
                          onBlur={(e) =>
                            handleRenameLevel(levelName, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          disabled={disabled}
                          className="h-7 text-xs font-medium"
                          key={levelName}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleRemoveLevel(levelName)}
                          disabled={disabled}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {levelPoints(levelName)} pt
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groupIds.map((gid, rowIdx) => (
                <tr
                  key={gid}
                  className={rowIdx % 2 === 1 ? "bg-muted/20" : ""}
                >
                  <td className="align-top p-2 border-r border-t font-medium">
                    <div className="break-words">{groupName(gid)}</div>
                  </td>
                  {levels.map((levelName, idx) => {
                    const isLast = idx === levels.length - 1;
                    const cell = cellFor(gid, levelName);
                    return (
                      <td
                        key={`${gid}-${levelName}`}
                        className={cn(
                          "align-top p-2 border-t",
                          !isLast && "border-r",
                        )}
                      >
                        <Textarea
                          value={cell?.description ?? ""}
                          onChange={(e) =>
                            handleCellChange(gid, levelName, e.target.value)
                          }
                          placeholder="Describe this level…"
                          className="min-h-[96px] resize-none text-xs"
                          disabled={disabled}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
