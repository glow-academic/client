/**
 * ModelFlags.tsx — canonical per-(model, flag-type) picker.
 *
 * Analogous to Flags.tsx but keyed by (model_id, flag_type). The server
 * sends `options` (cross-product of selected-models × flag-types ×
 * {true,false}) plus the currently-linked junction rows (`existing`). We
 * group options by (model_id, type) and render one Switch per group. The
 * parent owns the state map keyed `"{model_id}:{type}"` → boolean|null and
 * feeds `onChange(model_id, type, next)` back into its form state (via the
 * `model_flag_values` denormalized shape on the draft request).
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

export interface ModelFlagOption {
  model_id?: string | null;
  flag_id?: string | null;
  type?: string | null;
  value?: boolean | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
}

export interface ModelFlagExisting {
  id?: string | null;
  model_id?: string | null;
  flag_id?: string | null;
  type?: string | null;
  value?: boolean | null;
  pending?: boolean | null;
}

export interface ModelFlagsProps {
  options: ModelFlagOption[];
  existing: ModelFlagExisting[];
  /** key "{model_id}:{type}" → boolean|null */
  values: Record<string, boolean | null>;
  models: Array<{
    id?: string | null;
    model_id?: string | null;
    name?: string | null;
    description?: string | null;
  }>;
  onChange: (model_id: string, type: string, next: boolean | null) => void;
  label?: string;
  disabled?: boolean;
  show_model_flags?: boolean;
  /** Per-field pending lifecycle (multi-select, junction). Receives the
   *  set of pending junction-row ids. See ParameterFields.tsx for the
   *  junction pattern. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

type Group = {
  model_id: string;
  type: string;
  label: string;
  description: string | null;
  icon: string | null;
  trueOption: ModelFlagOption | null;
  falseOption: ModelFlagOption | null;
};

function deriveLabel(typeOrName: string | null | undefined): string {
  if (!typeOrName) return "";
  const stripped = typeOrName.replace(
    /^(model|setting|persona|cohort|rubric|scenario|simulation|auth|document|field|parameter|tool|provider|profile|eval|agent|department|rubric)_/,
    "",
  );
  const source = stripped || typeOrName;
  return source
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export function ModelFlags({
  options,
  existing,
  values,
  models,
  onChange,
  label = "Model Flags",
  disabled = false,
  show_model_flags = true,
  onAcceptPending,
  onRejectPending,
}: ModelFlagsProps) {
  // Stable lookup for model display names.
  const modelLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const model of models ?? []) {
      const id = model.model_id || model.id;
      if (!id) continue;
      const name = model.name?.trim() || model.description?.trim() || "";
      map.set(id, name || `Model ${id.slice(0, 8)}`);
    }
    return map;
  }, [models]);

  // Bucket options by (model_id, type). Each bucket has up to one trueOption
  // and one falseOption — matching the Flags.tsx shape.
  const groupsByModel = useMemo(() => {
    const byModel = new Map<string, Map<string, Group>>();
    for (const opt of options ?? []) {
      const modelId = opt.model_id ?? null;
      const type = opt.type ?? null;
      if (!modelId || !type) continue;
      let modelGroups = byModel.get(modelId);
      if (!modelGroups) {
        modelGroups = new Map<string, Group>();
        byModel.set(modelId, modelGroups);
      }
      let group = modelGroups.get(type);
      if (!group) {
        group = {
          model_id: modelId,
          type,
          label: opt.name ? deriveLabel(opt.name) : deriveLabel(type),
          description: opt.description ?? null,
          icon: opt.icon ?? null,
          trueOption: null,
          falseOption: null,
        };
        modelGroups.set(type, group);
      }
      if (opt.value === true) group.trueOption = opt;
      else if (opt.value === false) group.falseOption = opt;
      if (!group.description && opt.description) group.description = opt.description;
      if (!group.icon && opt.icon) group.icon = opt.icon;
    }
    return byModel;
  }, [options]);

  // Pending set: `{model_id}:{type}` keys whose existing junction is
  // marked pending — matches Flags.tsx visual treatment.
  const pendingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const row of existing ?? []) {
      if (!row.pending) continue;
      const modelId = row.model_id;
      const type = row.type;
      if (!modelId || !type) continue;
      set.add(`${modelId}:${type}`);
    }
    return set;
  }, [existing]);
  const pendingJunctionIds = useMemo(
    () =>
      (existing ?? [])
        .filter((row) => row.pending && row.id)
        .map((row) => row.id!) as string[],
    [existing],
  );
  const showDiff = pendingKeys.size > 0;

  const handleToggle = useCallback(
    (modelId: string, type: string, checked: boolean) => {
      onChange(modelId, type, checked);
    },
    [onChange],
  );

  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingJunctionIds.length > 0) {
      onAcceptPending(pendingJunctionIds);
    }
    // Pending state is confirmed by the next non-pending save. No-op here.
  }, [onAcceptPending, pendingJunctionIds]);

  const handleReject = useCallback(() => {
    if (onRejectPending && pendingJunctionIds.length > 0) {
      onRejectPending(pendingJunctionIds);
      return;
    }
    for (const key of pendingKeys) {
      const [modelId, type] = key.split(":");
      if (modelId && type) onChange(modelId, type, null);
    }
  }, [pendingKeys, pendingJunctionIds, onChange, onRejectPending]);

  const modelIds = useMemo(() => {
    return Array.from(groupsByModel.keys());
  }, [groupsByModel]);

  if (!show_model_flags || modelIds.length === 0) return null;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">{label}</Label>
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
        {modelIds.map((modelId) => {
          const labelText = modelLabelMap.get(modelId) ?? modelId.slice(0, 8);
          const groups = Array.from(groupsByModel.get(modelId)?.values() ?? []);
          return (
            <div key={modelId} className="space-y-2">
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {groups.map((group) => {
                  const key = `${modelId}:${group.type}`;
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
                      key={key}
                      className={cn(
                        "space-y-1 p-2 rounded-lg transition-all",
                        isPending && "ring-2 ring-success bg-success/10",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`model-flag-${key}`}
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
                          id={`model-flag-${key}`}
                          checked={checked}
                          onCheckedChange={(c) =>
                            handleToggle(group.model_id, group.type, c)
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
                    No model flags available.
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
