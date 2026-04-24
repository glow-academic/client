/**
 * ScenarioFlags.tsx — canonical scenario-flag picker.
 *
 * Mirrors `Flags.tsx` but scoped per scenario. Props are:
 *   - `options`: flat list of option rows (cross-product of scenarios ×
 *     flag types × values). Each row is one flags_resource entry tied to
 *     a scenario.
 *   - `existing`: current scenario_flags_resource junction rows (selected
 *     or pending).
 *   - `values`: denormalized state keyed by `{scenario_id}:{type}` →
 *     bool | null. null = unset (fallback to server default).
 *   - `onChange(scenario_id, type, next)`: toggle callback. Parent stores
 *     the bool on its form state and ships it either as `scenario_flag_ids`
 *     (via catalog lookup) or `scenario_flag_values` to the server.
 *
 * The component is fully controlled — no internal dirty refs or mirrored
 * state. Rows are grouped by (scenario_id, type) and render one Switch
 * per group.
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
import { SvgIcon } from "@/components/common/SvgIcon";
import { cn } from "@/lib/utils";
import { Check, Power, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface ScenarioFlagOption {
  scenario_id?: string | null;
  flag_id?: string | null;
  type?: string | null;
  value?: boolean | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
}

export interface ScenarioFlagExisting {
  id?: string | null; // scenario_flags_resource.id
  scenario_id?: string | null;
  flag_id?: string | null;
  type?: string | null;
  value?: boolean | null;
  pending?: boolean | null;
}

export interface ScenarioFlagScenario {
  id?: string | null;
  scenario_id?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface ScenarioFlagsProps {
  options: ScenarioFlagOption[];
  existing: ScenarioFlagExisting[];
  values: Record<string, boolean | null>; // "{scenario_id}:{type}" → bool | null
  scenarios: ScenarioFlagScenario[];
  onChange: (scenario_id: string, type: string, next: boolean | null) => void;
  label?: string;
  disabled?: boolean;
  show_scenario_flags?: boolean;
}

type ScenarioFlagGroup = {
  scenario_id: string;
  type: string;
  label: string;
  description: string | null;
  icon: string | null;
  trueRow: ScenarioFlagOption | null;
  falseRow: ScenarioFlagOption | null;
};

function deriveLabel(typeOrName: string | null | undefined): string {
  if (!typeOrName) return "";
  const stripped = typeOrName.replace(
    /^(show|scenario)_/,
    "",
  );
  const source = stripped || typeOrName;
  return source
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function scenarioKey(scenario: ScenarioFlagScenario): string | null {
  return (scenario.scenario_id || scenario.id || null) as string | null;
}

function scenarioLabel(scenario: ScenarioFlagScenario): string | null {
  const text = (scenario.name || scenario.title || scenario.description || "").trim();
  return text || null;
}

export function ScenarioFlags({
  options,
  existing,
  values,
  scenarios,
  onChange,
  label = "Scenario Flags",
  disabled = false,
  show_scenario_flags = true,
}: ScenarioFlagsProps) {
  // Group options by scenario_id, then by type. Each group has trueRow /
  // falseRow (one per value). The UI picks between these two flag_ids when
  // the user toggles the Switch.
  const groupsByScenario = useMemo(() => {
    const outer = new Map<string, Map<string, ScenarioFlagGroup>>();
    for (const row of options) {
      const sid = row.scenario_id;
      const type = row.type ?? row.name;
      if (!sid || !type) continue;
      const inner = outer.get(sid) ?? new Map<string, ScenarioFlagGroup>();
      const group =
        inner.get(type) ?? {
          scenario_id: sid,
          type,
          label: row.name ? deriveLabel(row.name) : deriveLabel(type),
          description: row.description ?? null,
          icon: row.icon ?? null,
          trueRow: null,
          falseRow: null,
        };
      if (row.value === true) group.trueRow = row;
      else if (row.value === false) group.falseRow = row;
      if (!group.description && row.description) group.description = row.description;
      if (!group.icon && row.icon) group.icon = row.icon;
      inner.set(type, group);
      outer.set(sid, inner);
    }
    return outer;
  }, [options]);

  // Pending lookup keyed by `{scenario_id}:{type}`. We infer a pending group
  // from junction rows flagged `pending: true` — the row's flag_id tells us
  // which type it belongs to via the catalog (options).
  const pendingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of existing) {
      if (!e.pending || !e.scenario_id) continue;
      const type = e.type
        ?? options.find((o) => o.flag_id && e.flag_id && o.flag_id === e.flag_id)?.type
        ?? null;
      if (type) set.add(`${e.scenario_id}:${type}`);
    }
    return set;
  }, [existing, options]);

  const showDiff = pendingKeys.size > 0;

  const handleToggle = useCallback(
    (scenario_id: string, type: string, checked: boolean) => {
      onChange(scenario_id, type, checked);
    },
    [onChange],
  );

  const handleAccept = useCallback(() => {
    // Pending keys confirm themselves on next non-pending save; no-op here.
  }, []);

  const handleReject = useCallback(() => {
    for (const key of pendingKeys) {
      const [sid, type] = key.split(":");
      if (sid && type) onChange(sid, type, null);
    }
  }, [pendingKeys, onChange]);

  // Order scenarios as provided; filter to those we have options for so the
  // component stays hidden when the catalog is empty for a scenario.
  const scenariosWithOptions = useMemo(() => {
    return scenarios
      .map((s) => ({ scenario: s, sid: scenarioKey(s) }))
      .filter((entry) => entry.sid && groupsByScenario.has(entry.sid))
      .map((entry) => entry as { scenario: ScenarioFlagScenario; sid: string });
  }, [scenarios, groupsByScenario]);

  if (!show_scenario_flags || scenariosWithOptions.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
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
        </div>
      )}
      <div className="space-y-4 pl-4">
        {scenariosWithOptions.map(({ scenario, sid }) => {
          const inner = groupsByScenario.get(sid);
          if (!inner) return null;
          const groups = Array.from(inner.values());
          const headerText =
            scenarioLabel(scenario) ?? sid.slice(0, 8);

          return (
            <div key={sid} className="space-y-2">
              <Label className="text-sm font-medium" title={headerText}>
                {headerText}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {groups.map((group) => {
                  const key = `${sid}:${group.type}`;
                  const current = values[key];
                  const checked = current === true;
                  const isPending = pendingKeys.has(key);
                  const resolvedIcon = group.icon ? (
                    <SvgIcon
                      svg={group.icon}
                      className="h-3.5 w-3.5 text-muted-foreground"
                      fallback={
                        <Power className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    />
                  ) : (
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  );
                  return (
                    <div
                      key={group.type}
                      className={cn(
                        "space-y-1 p-2 rounded-lg transition-all",
                        isPending && "ring-2 ring-success bg-success/10",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`sflag-${sid}-${group.type}`}
                          className="text-sm flex items-center gap-1 flex-1"
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
                          id={`sflag-${sid}-${group.type}`}
                          checked={checked}
                          onCheckedChange={(c) =>
                            handleToggle(sid, group.type, c)
                          }
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
                {groups.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground">
                    No scenario flags available.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
