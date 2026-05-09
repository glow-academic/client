/**
 * Flags.tsx — canonical flag picker.
 *
 * Props are a flat array of flag resource rows (one per flags_resource entry;
 * typically two per logical flag: value=true and value=false) plus a
 * denormalized values map keyed by flag type (`{"setting_active": true,
 * "mcp": false}`). The component groups rows by type and renders one Switch
 * per type; toggling emits `onChange(type, next)` and the parent component
 * stores the boolean on its form state, shipping it either as a typed field
 * (`active: bool`) or via `flag_ids` lookup to the server.
 */
"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SvgIcon } from "@/components/common/SvgIcon";
import { Check, Power, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Back-compat alias — artifacts still importing `FlagConfig` continue to work
// until they're migrated to the new shape.
export type FlagConfig = FlagResource;

export interface FlagResource {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  value?: boolean | null;
  description?: string | null;
  icon_id?: string | null;
  icon?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

// Denormalized state: key = flag type (e.g. "setting_active"), value = bool|null.
// null means "unset" (falls back to the artifact's default on server).
export type FlagValues = Record<string, boolean | null>;

export interface FlagsProps {
  flags: FlagResource[]; // Flat server list — one per flags_resource row
  values: FlagValues; // Denormalized per-type state
  onChange: (type: string, next: boolean | null) => void;
  label?: string;
  columns?: 1 | 2 | 3 | 4;
  disabled?: boolean;
  headerRight?: React.ReactNode;
  show_flags?: boolean;
  /** Per-field pending lifecycle (multi-select). Receives flag
   *  resource ids that have ``pending=true``. Parent should remove
   *  them from ``pending_ids``; reject also clears the per-type
   *  toggles. See Departments.tsx for the full pattern. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

type FlagGroup = {
  type: string;
  label: string;
  description: string | null;
  icon: string | null;
  trueRow: FlagResource | null;
  falseRow: FlagResource | null;
};

// "setting_active" -> "Active"; "foo_bar_baz" -> "Foo Bar Baz"
function deriveLabel(typeOrName: string | null | undefined): string {
  if (!typeOrName) return "";
  // Strip common artifact prefixes so `setting_active` → `active` before labeling.
  const stripped = typeOrName.replace(
    /^(setting|persona|cohort|rubric|model|scenario|simulation|auth|document|field|parameter|tool|provider|profile|eval|agent|department|rubric)_/,
    ""
  );
  const source = stripped || typeOrName;
  return source
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export function Flags({
  flags,
  values,
  onChange,
  label,
  columns = 2,
  disabled = false,
  headerRight,
  show_flags = true,
  onAcceptPending,
  onRejectPending,
}: FlagsProps) {
  // Group flag rows by type — each logical flag surfaces as one toggle.
  const groups = useMemo<FlagGroup[]>(() => {
    const byType = new Map<string, FlagGroup>();
    for (const row of flags) {
      const type = row.type ?? row.name;
      if (!type) continue;
      const group = byType.get(type) ?? {
        type,
        label: row.name ? deriveLabel(row.name) : deriveLabel(type),
        description: row.description ?? null,
        icon: row.icon ?? null,
        trueRow: null,
        falseRow: null,
      };
      if (row.value === true) group.trueRow = row;
      else if (row.value === false) group.falseRow = row;
      // Inherit metadata from whichever row we see first.
      if (!group.description && row.description) group.description = row.description;
      if (!group.icon && row.icon) group.icon = row.icon;
      byType.set(type, group);
    }
    return Array.from(byType.values());
  }, [flags]);

  const pendingTypes = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      if (g.trueRow?.pending || g.falseRow?.pending) set.add(g.type);
    }
    return set;
  }, [groups]);
  // Flag resource ids that are currently pending (one per pending row;
  // a logical flag may contribute up to 2 — true row and false row).
  // Parent uses these to sync ``pending_ids`` on accept/reject.
  const pendingFlagIds = useMemo(() => {
    const ids: string[] = [];
    for (const g of groups) {
      if (g.trueRow?.pending && g.trueRow.id) ids.push(g.trueRow.id);
      if (g.falseRow?.pending && g.falseRow.id) ids.push(g.falseRow.id);
    }
    return ids;
  }, [groups]);
  const showDiff = pendingTypes.size > 0;

  const handleToggle = useCallback(
    (type: string, checked: boolean) => {
      onChange(type, checked);
    },
    [onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending toggles stay as the user's selection. Parent hook strips
    // pending flag resource ids from ``pending_ids`` so the next save
    // promotes those connections to active=true.
    if (onAcceptPending && pendingFlagIds.length > 0) {
      onAcceptPending(pendingFlagIds);
    }
  }, [onAcceptPending, pendingFlagIds]);

  const handleReject = useCallback(() => {
    if (onRejectPending && pendingFlagIds.length > 0) {
      onRejectPending(pendingFlagIds);
    }
    // Clear the per-type toggles regardless of the parent hook —
    // matches legacy behavior (rejecting a flag should null its value).
    for (const t of pendingTypes) onChange(t, null);
  }, [pendingTypes, pendingFlagIds, onRejectPending, onChange]);

  if (!show_flags || groups.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      {(label || headerRight) && (
        <div className="flex items-center gap-2">
          {label && <Label className="text-sm font-medium">{label}</Label>}
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
          {headerRight && <div className="ml-auto">{headerRight}</div>}
        </div>
      )}
      <div
        className={cn(
          "grid gap-3 pt-1",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-1 sm:grid-cols-2",
          columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {groups.map((group) => {
          const current = values[group.type];
          const checked = current === true;
          const isPending = pendingTypes.has(group.type);
          const resolvedIcon = group.icon ? (
            <SvgIcon
              svg={group.icon}
              className="h-3.5 w-3.5 text-muted-foreground"
              fallback={<Power className="h-3.5 w-3.5 text-muted-foreground" />}
            />
          ) : (
            <Power className="h-3.5 w-3.5 text-muted-foreground" />
          );

          return (
            <div
              key={group.type}
              className={cn(
                "space-y-1 p-2 rounded-lg transition-all",
                isPending && "ring-2 ring-success bg-success/10"
              )}
            >
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`flag-${group.type}`}
                  className="text-sm flex items-center gap-1"
                >
                  {resolvedIcon}
                  {group.label}
                  {isPending && (
                    <span className="ml-2 text-xs text-success font-medium">
                      Pending
                    </span>
                  )}
                </Label>
                <Switch
                  id={`flag-${group.type}`}
                  checked={checked}
                  onCheckedChange={(c) => handleToggle(group.type, c)}
                  disabled={disabled}
                />
              </div>
              {group.description && (
                <p className="text-xs text-muted-foreground pl-5">
                  {group.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
