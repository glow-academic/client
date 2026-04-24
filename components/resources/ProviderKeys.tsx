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

export interface ProviderKeyOption {
  provider_id?: string | null;
  key_id?: string | null;
  provider_name?: string | null;
  key_name?: string | null;
  masked_key?: string | null;
}

export interface ProviderKeyValue {
  id: string | null;
  provider_id: string;
  key_id: string;
}

export interface ProviderKeyExisting {
  id?: string | null;
  provider_id?: string | null;
  key_id?: string | null;
  pending?: boolean | null;
}

export interface ProviderKeysProps {
  options?: ProviderKeyOption[];
  values?: ProviderKeyValue[];
  existing?: ProviderKeyExisting[];
  disabled?: boolean;
  onChange: (values: ProviderKeyValue[]) => void;
  label?: string;
  description?: string;
  show_provider_keys?: boolean;
}

const pairKey = (providerId: string, keyId: string) => `${providerId}:${keyId}`;

export function ProviderKeys({
  options,
  values,
  existing,
  disabled = false,
  onChange,
  label = "Provider Keys",
  description = "Select which keys are available for each provider.",
  show_provider_keys = true,
}: ProviderKeysProps) {
  const opts = useMemo(() => options ?? [], [options]);
  const vals = useMemo(() => values ?? [], [values]);

  const valueByPair = useMemo(() => {
    const map = new Map<string, ProviderKeyValue>();
    for (const v of vals) {
      map.set(pairKey(v.provider_id, v.key_id), v);
    }
    return map;
  }, [vals]);

  const existingIdByPair = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of existing ?? []) {
      if (e.provider_id && e.key_id && e.id) {
        map.set(pairKey(e.provider_id, e.key_id), e.id);
      }
    }
    return map;
  }, [existing]);

  const pendingPairs = useMemo(() => {
    const set = new Set<string>();
    for (const e of existing ?? []) {
      if (e.pending && e.provider_id && e.key_id) {
        set.add(pairKey(e.provider_id, e.key_id));
      }
    }
    return set;
  }, [existing]);
  const showDiff = pendingPairs.size > 0;

  const byProvider = useMemo(() => {
    const groups = new Map<
      string,
      { provider_name: string | null; keys: ProviderKeyOption[] }
    >();
    for (const o of opts) {
      if (!o.provider_id || !o.key_id) continue;
      const entry = groups.get(o.provider_id) ?? {
        provider_name: o.provider_name ?? null,
        keys: [],
      };
      entry.keys.push(o);
      groups.set(o.provider_id, entry);
    }
    return groups;
  }, [opts]);

  const togglePair = useCallback(
    (providerId: string, keyId: string, checked: boolean) => {
      const pk = pairKey(providerId, keyId);
      if (checked) {
        if (valueByPair.has(pk)) return;
        const existingId = existingIdByPair.get(pk) ?? null;
        onChange([
          ...vals,
          { id: existingId, provider_id: providerId, key_id: keyId },
        ]);
      } else {
        onChange(
          vals.filter(
            (v) => !(v.provider_id === providerId && v.key_id === keyId)
          )
        );
      }
    },
    [valueByPair, existingIdByPair, vals, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending pairs remain selected; next non-pending save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(
      vals.filter((v) => !pendingPairs.has(pairKey(v.provider_id, v.key_id)))
    );
  }, [onChange, pendingPairs, vals]);

  if (!show_provider_keys) return null;

  const groups = Array.from(byProvider.entries());

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
          No provider/key options available.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([providerId, group]) => (
            <div
              key={providerId}
              className="rounded-md border p-3 space-y-2 bg-card"
            >
              <div className="font-medium text-sm">
                {group.provider_name ?? providerId}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.keys.map((key) => {
                  const keyId = key.key_id!;
                  const pk = pairKey(providerId, keyId);
                  const checked = valueByPair.has(pk);
                  const isPending = pendingPairs.has(pk);
                  return (
                    <div
                      key={pk}
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
                          {key.key_name ?? keyId}
                        </div>
                        {key.masked_key && (
                          <div className="text-xs text-muted-foreground truncate">
                            {key.masked_key}
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          togglePair(providerId, keyId, value)
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
