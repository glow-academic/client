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
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface AuthItemKeyOption {
  auth_id?: string | null;
  item_id?: string | null;
  key_id?: string | null;
  auth_name?: string | null;
  item_name?: string | null;
  key_name?: string | null;
  masked_key?: string | null;
}

export interface AuthItemKeyValue {
  id: string | null;
  auth_id: string;
  item_id: string;
  key_id: string;
}

export interface AuthItemKeyExisting {
  id?: string | null;
  auth_id?: string | null;
  item_id?: string | null;
  key_id?: string | null;
  pending?: boolean | null;
}

export interface AuthItemKeysProps {
  options?: AuthItemKeyOption[];
  values?: AuthItemKeyValue[];
  existing?: AuthItemKeyExisting[];
  disabled?: boolean;
  onChange: (values: AuthItemKeyValue[]) => void;
  label?: string;
  description?: string;
  show_auth_item_keys?: boolean;
}

const tripleKey = (authId: string, itemId: string, keyId: string) =>
  `${authId}:${itemId}:${keyId}`;

export function AuthItemKeys({
  options,
  values,
  existing,
  disabled = false,
  onChange,
  label = "Auth Item Keys",
  description = "Select which keys are available for each auth claim item.",
  show_auth_item_keys = true,
}: AuthItemKeysProps) {
  const opts = useMemo(() => options ?? [], [options]);
  const vals = useMemo(() => values ?? [], [values]);

  const valueByTriple = useMemo(() => {
    const map = new Map<string, AuthItemKeyValue>();
    for (const v of vals) {
      map.set(tripleKey(v.auth_id, v.item_id, v.key_id), v);
    }
    return map;
  }, [vals]);

  const existingIdByTriple = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of existing ?? []) {
      if (e.auth_id && e.item_id && e.key_id && e.id) {
        map.set(tripleKey(e.auth_id, e.item_id, e.key_id), e.id);
      }
    }
    return map;
  }, [existing]);

  const pendingTriples = useMemo(() => {
    const set = new Set<string>();
    for (const e of existing ?? []) {
      if (e.pending && e.auth_id && e.item_id && e.key_id) {
        set.add(tripleKey(e.auth_id, e.item_id, e.key_id));
      }
    }
    return set;
  }, [existing]);
  const showDiff = pendingTriples.size > 0;

  const byAuth = useMemo(() => {
    const groups = new Map<
      string,
      { auth_name: string | null; options: AuthItemKeyOption[] }
    >();
    for (const o of opts) {
      if (!o.auth_id || !o.item_id || !o.key_id) continue;
      const entry = groups.get(o.auth_id) ?? {
        auth_name: o.auth_name ?? null,
        options: [],
      };
      entry.options.push(o);
      groups.set(o.auth_id, entry);
    }
    return groups;
  }, [opts]);

  const toggle = useCallback(
    (authId: string, itemId: string, keyId: string, checked: boolean) => {
      const tk = tripleKey(authId, itemId, keyId);
      if (checked) {
        if (valueByTriple.has(tk)) return;
        const existingId = existingIdByTriple.get(tk) ?? null;
        onChange([
          ...vals,
          { id: existingId, auth_id: authId, item_id: itemId, key_id: keyId },
        ]);
      } else {
        onChange(
          vals.filter(
            (v) =>
              !(
                v.auth_id === authId &&
                v.item_id === itemId &&
                v.key_id === keyId
              )
          )
        );
      }
    },
    [valueByTriple, existingIdByTriple, vals, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending triples remain selected; next non-pending save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(
      vals.filter(
        (v) => !pendingTriples.has(tripleKey(v.auth_id, v.item_id, v.key_id))
      )
    );
  }, [onChange, pendingTriples, vals]);

  if (!show_auth_item_keys) return null;

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
          No auth/item/key options available.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([authId, group]) => (
            <div key={authId} className="rounded-md border p-3 space-y-2 bg-card">
              <div className="font-medium text-sm">
                {group.auth_name ?? authId}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.options.map((opt) => {
                  const itemId = opt.item_id!;
                  const keyId = opt.key_id!;
                  const tk = tripleKey(authId, itemId, keyId);
                  const checked = valueByTriple.has(tk);
                  const isPending = pendingTriples.has(tk);
                  return (
                    <div
                      key={tk}
                      className={cn(
                        "relative flex items-center justify-between rounded border px-2 py-1.5",
                        checked && !isPending && "border-primary bg-primary/5",
                        isPending && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      {isPending && (
                        <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                          Pending
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm">
                          {opt.item_name ?? itemId}
                          {opt.key_name ? ` → ${opt.key_name}` : ""}
                        </div>
                        {opt.masked_key && (
                          <div className="text-xs text-muted-foreground truncate">
                            {opt.masked_key}
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          toggle(authId, itemId, keyId, value)
                        }
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
