"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface AuthItemValueOption {
  auth_id?: string | null;
  item_id?: string | null;
  auth_name?: string | null;
  item_name?: string | null;
  item_description?: string | null;
  encrypted?: boolean | null;
}

export interface AuthItemValueValue {
  id: string | null;
  auth_id: string;
  item_id: string;
  value: string;
}

export interface AuthItemValueExisting {
  id?: string | null;
  auth_id?: string | null;
  item_id?: string | null;
  value?: string | null;
  pending?: boolean | null;
}

export interface AuthItemValuesProps {
  options?: AuthItemValueOption[];
  values?: AuthItemValueValue[];
  existing?: AuthItemValueExisting[];
  disabled?: boolean;
  onChange: (values: AuthItemValueValue[]) => void;
  label?: string;
  description?: string;
  show_auth_item_values?: boolean;
}

const pairKey = (authId: string, itemId: string) => `${authId}:${itemId}`;

export function AuthItemValues({
  options,
  values,
  existing,
  disabled = false,
  onChange,
  label = "Auth Item Values",
  description = "Enter the literal claim value each auth should send for each item.",
  show_auth_item_values = true,
}: AuthItemValuesProps) {
  // Plaintext claim values only — the AuthItemKeys component handles
  // encrypted items (encrypted=true). This split mirrors the server-side
  // distinction: encrypted items go through `auth_item_keys_resource`
  // (keys_resource encrypted), plaintext items through
  // `auth_item_values_resource` (literal value column).
  const opts = useMemo(
    () => (options ?? []).filter((o) => o.encrypted !== true),
    [options],
  );
  const vals = useMemo(() => values ?? [], [values]);

  const valueByPair = useMemo(() => {
    const map = new Map<string, AuthItemValueValue>();
    for (const v of vals) map.set(pairKey(v.auth_id, v.item_id), v);
    return map;
  }, [vals]);

  const existingByPair = useMemo(() => {
    const map = new Map<string, AuthItemValueExisting>();
    for (const e of existing ?? []) {
      if (e.auth_id && e.item_id) {
        map.set(pairKey(e.auth_id, e.item_id), e);
      }
    }
    return map;
  }, [existing]);

  const pendingPairs = useMemo(() => {
    const set = new Set<string>();
    for (const e of existing ?? []) {
      if (e.pending && e.auth_id && e.item_id) {
        set.add(pairKey(e.auth_id, e.item_id));
      }
    }
    return set;
  }, [existing]);
  const showDiff = pendingPairs.size > 0;

  const byAuth = useMemo(() => {
    const groups = new Map<
      string,
      { auth_name: string | null; options: AuthItemValueOption[] }
    >();
    for (const o of opts) {
      if (!o.auth_id || !o.item_id) continue;
      const entry = groups.get(o.auth_id) ?? {
        auth_name: o.auth_name ?? null,
        options: [],
      };
      entry.options.push(o);
      groups.set(o.auth_id, entry);
    }
    return groups;
  }, [opts]);

  const updateValue = useCallback(
    (authId: string, itemId: string, nextValue: string) => {
      const pk = pairKey(authId, itemId);
      const existingEntry = existingByPair.get(pk);
      const existingValue = valueByPair.get(pk);

      // Dropping to empty → remove the entry entirely.
      if (nextValue === "") {
        if (!existingValue) return;
        onChange(
          vals.filter(
            (v) => !(v.auth_id === authId && v.item_id === itemId)
          )
        );
        return;
      }

      // Keep the existing id if the value matches the server row; else drop id so
      // the server creates a new row (append-only contract).
      const reuseId =
        existingEntry?.id && existingEntry.value === nextValue
          ? existingEntry.id
          : null;

      if (existingValue) {
        onChange(
          vals.map((v) =>
            v.auth_id === authId && v.item_id === itemId
              ? { ...v, value: nextValue, id: reuseId }
              : v
          )
        );
      } else {
        onChange([
          ...vals,
          {
            id: reuseId,
            auth_id: authId,
            item_id: itemId,
            value: nextValue,
          },
        ]);
      }
    },
    [existingByPair, valueByPair, vals, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending values remain; next non-pending save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(
      vals.filter((v) => !pendingPairs.has(pairKey(v.auth_id, v.item_id)))
    );
  }, [onChange, pendingPairs, vals]);

  if (!show_auth_item_values) return null;

  const groups = Array.from(byAuth.entries());

  return (
    <div className="space-y-2">
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
      <p className="text-xs text-muted-foreground">{description}</p>
      {groups.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No auth/item options available.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([authId, group]) => (
            <div key={authId} className="space-y-2">
              <div className="font-medium text-sm">
                {group.auth_name ?? authId}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {group.options.map((opt) => {
                  const itemId = opt.item_id!;
                  const pk = pairKey(authId, itemId);
                  const current = valueByPair.get(pk);
                  const isPending = pendingPairs.has(pk);
                  return (
                    <div
                      key={pk}
                      className={cn(
                        "rounded border px-2 py-2 space-y-1",
                        current && !isPending && "border-primary bg-primary/5",
                        isPending && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`aiv-${pk}`}
                          className="text-sm"
                        >
                          {opt.item_name ?? itemId}
                        </Label>
                        {isPending && (
                          <div className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                            Pending
                          </div>
                        )}
                      </div>
                      {opt.item_description && (
                        <div className="text-xs text-muted-foreground">
                          {opt.item_description}
                        </div>
                      )}
                      <Input
                        id={`aiv-${pk}`}
                        type="text"
                        disabled={disabled}
                        value={current?.value ?? ""}
                        onChange={(e) =>
                          updateValue(authId, itemId, e.target.value)
                        }
                        placeholder={`Value for ${opt.item_name ?? "item"}`}
                        className="h-8"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
