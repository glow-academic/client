/**
 * ProviderKeys.tsx
 * Per-provider API key editor. Creatable-only — never pulls existing keys
 * from a global catalog (security). The user types a fresh API key per
 * provider; the server encrypts and creates a `keys_resource` row plus a
 * `provider_keys_resource` linking row.
 *
 * Existing saved rows surface as masked entries with a Reveal button that
 * calls the audited `/setting/decrypt` endpoint via `onReveal`.
 */

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
import { Check, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface ProviderKeyValue {
  /** Existing provider_keys_resource id when known. */
  id: string | null;
  provider_id: string;
  /** Existing keys_resource id when re-linking. */
  key_id?: string | null;
  /** Plaintext key — present only for newly-typed entries on this client. */
  key_value?: string | null;
  /** Optional display name for the new keys_resource row. */
  key_name?: string | null;
}

export interface ProviderKeyExisting {
  id?: string | null;
  provider_id?: string | null;
  key_id?: string | null;
  /** Display fields from the server. */
  name?: string | null;
  pending?: boolean | null;
}

export interface ProviderRef {
  id: string;
  name?: string | null;
  description?: string | null;
}

export interface ProviderKeysProps {
  /** Providers selected for this setting — one editor card per provider. */
  selected_providers?: ProviderRef[];
  values?: ProviderKeyValue[];
  existing?: ProviderKeyExisting[];
  disabled?: boolean;
  onChange: (values: ProviderKeyValue[]) => void;
  /** Resolves a key_id to plaintext via the audited decrypt endpoint. */
  onReveal?: (key_id: string) => Promise<string | null>;
  show_provider_keys?: boolean;
  label?: string;
  description?: string;
}

export function ProviderKeys({
  selected_providers,
  values,
  existing,
  disabled = false,
  onChange,
  onReveal,
  show_provider_keys = true,
  label = "Provider Keys",
  description = "Add an API key for each provider. Keys are encrypted server-side.",
}: ProviderKeysProps) {
  const providers = useMemo(() => selected_providers ?? [], [selected_providers]);
  const vals = useMemo(() => values ?? [], [values]);
  const existingRows = useMemo(() => existing ?? [], [existing]);

  // Map provider_id -> existing saved entries (one or many).
  const existingByProvider = useMemo(() => {
    const map = new Map<string, ProviderKeyExisting[]>();
    for (const e of existingRows) {
      if (!e.provider_id) continue;
      const list = map.get(e.provider_id) ?? [];
      list.push(e);
      map.set(e.provider_id, list);
    }
    return map;
  }, [existingRows]);

  const newByProvider = useMemo(() => {
    const map = new Map<string, ProviderKeyValue[]>();
    for (const v of vals) {
      if (v.id !== null) continue; // saved entries don't need to render here
      const list = map.get(v.provider_id) ?? [];
      list.push(v);
      map.set(v.provider_id, list);
    }
    return map;
  }, [vals]);

  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});

  const handleAddNew = useCallback(
    (providerId: string) => {
      onChange([
        ...vals,
        {
          id: null,
          provider_id: providerId,
          key_value: "",
          key_name: null,
        },
      ]);
    },
    [vals, onChange],
  );

  const handleEditNew = useCallback(
    (providerId: string, index: number, patch: Partial<ProviderKeyValue>) => {
      let seen = -1;
      const next = vals.map((v) => {
        if (v.id === null && v.provider_id === providerId) {
          seen += 1;
          if (seen === index) return { ...v, ...patch };
        }
        return v;
      });
      onChange(next);
    },
    [vals, onChange],
  );

  const handleRemoveNew = useCallback(
    (providerId: string, index: number) => {
      let seen = -1;
      const next = vals.filter((v) => {
        if (v.id === null && v.provider_id === providerId) {
          seen += 1;
          return seen !== index;
        }
        return true;
      });
      onChange(next);
    },
    [vals, onChange],
  );

  const handleReveal = useCallback(
    async (existingId: string, keyId: string) => {
      if (!onReveal) return;
      if (revealed[existingId]) {
        setRevealed((prev) => {
          const { [existingId]: _drop, ...rest } = prev;
          return rest;
        });
        return;
      }
      setRevealing((prev) => ({ ...prev, [existingId]: true }));
      try {
        const plaintext = await onReveal(keyId);
        if (plaintext != null) {
          setRevealed((prev) => ({ ...prev, [existingId]: plaintext }));
        }
      } finally {
        setRevealing((prev) => {
          const { [existingId]: _drop, ...rest } = prev;
          return rest;
        });
      }
    },
    [onReveal, revealed],
  );

  const pendingPairs = useMemo(() => {
    const set = new Set<string>();
    for (const e of existingRows) {
      if (e.pending && e.id) set.add(e.id);
    }
    return set;
  }, [existingRows]);
  const showDiff = pendingPairs.size > 0;

  const handleAccept = useCallback(() => {
    // No-op — accept = leave entries in place; next save persists them.
  }, []);
  const handleReject = useCallback(() => {
    onChange(vals.filter((v) => !(v.id && pendingPairs.has(v.id))));
  }, [onChange, pendingPairs, vals]);

  if (!show_provider_keys) return null;

  if (providers.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">
          Select at least one provider above to add API keys.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
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
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <div className="space-y-3">
        {providers.map((provider) => {
          const savedRows = existingByProvider.get(provider.id) ?? [];
          const newRows = newByProvider.get(provider.id) ?? [];
          return (
            <div key={provider.id} className="space-y-2">
              <div className="font-medium text-sm">
                {provider.name ?? provider.id}
              </div>

              {savedRows.map((row) => {
                const rowId = row.id as string;
                const isPending = pendingPairs.has(rowId);
                const isRevealed = !!revealed[rowId];
                const isLoadingReveal = !!revealing[rowId];
                return (
                  <div
                    key={rowId}
                    className={cn(
                      "flex items-center gap-2 rounded border px-2 py-1.5",
                      isPending && "ring-2 ring-success bg-success/10",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">
                        {row.name ?? "Saved key"}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {isRevealed ? revealed[rowId] : "••••••••••••••••"}
                      </div>
                    </div>
                    {isPending && (
                      <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                        Pending
                      </span>
                    )}
                    {row.key_id && onReveal && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={disabled || isLoadingReveal}
                        onClick={() =>
                          handleReveal(rowId, row.key_id as string)
                        }
                        title={isRevealed ? "Hide" : "Reveal"}
                      >
                        {isRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}

              {newRows.map((row, idx) => (
                <div
                  key={`new-${provider.id}-${idx}`}
                  className="flex flex-col gap-2 rounded border border-dashed px-2 py-2"
                >
                  <Input
                    type="text"
                    placeholder="Key name (optional, e.g. Default)"
                    value={row.key_name ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      handleEditNew(provider.id, idx, {
                        key_name: e.target.value || null,
                      })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="Paste API key…"
                      value={row.key_value ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        handleEditNew(provider.id, idx, {
                          key_value: e.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      disabled={disabled}
                      onClick={() => handleRemoveNew(provider.id, idx)}
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => handleAddNew(provider.id)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add key
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
