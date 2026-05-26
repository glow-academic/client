/**
 * AuthItemKeys.tsx
 * Per-(auth × item) secret editor for **encrypted** claim items.
 * Mirrors AuthItemValues.tsx shape: one inline password input per
 * (auth × item) pair. The user types a fresh secret; the server
 * encrypts and creates a `keys_resource` row plus an
 * `auth_item_keys_resource` linking row.
 *
 * Existing saved rows surface as masked entries with a Reveal button
 * (calls `onReveal(key_id)` which hits `/setting/decrypt`).
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
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface AuthItemKeyOption {
  auth_id?: string | null;
  item_id?: string | null;
  auth_name?: string | null;
  item_name?: string | null;
  item_description?: string | null;
  encrypted?: boolean | null;
}

export interface AuthItemKeyValue {
  id: string | null;
  auth_id: string;
  item_id: string;
  key_id?: string | null;
  key_value?: string | null;
  key_name?: string | null;
}

export interface AuthItemKeyExisting {
  id?: string | null;
  auth_id?: string | null;
  item_id?: string | null;
  key_id?: string | null;
  pending?: boolean | null;
}

export interface AuthItemKeysProps {
  /** Cross-product (auth × item) options from the server. */
  options?: AuthItemKeyOption[];
  values?: AuthItemKeyValue[];
  existing?: AuthItemKeyExisting[];
  disabled?: boolean;
  onChange: (values: AuthItemKeyValue[]) => void;
  onReveal?: (key_id: string) => Promise<string | null>;
  show_auth_item_keys?: boolean;
  label?: string;
  description?: string;
  /** Per-field pending lifecycle (multi-select). See Departments.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

const pairKey = (authId: string, itemId: string) => `${authId}:${itemId}`;

export function AuthItemKeys({
  options,
  values,
  existing,
  disabled = false,
  onChange,
  onReveal,
  show_auth_item_keys = true,
  label = "Auth Item Keys",
  description = "Add a key/secret for each auth claim item. Values are encrypted server-side.",
  onAcceptPending,
  onRejectPending,
}: AuthItemKeysProps) {
  // Encrypted claim items only — plaintext items are owned by AuthItemValues.
  const opts = useMemo(
    () => (options ?? []).filter((o) => o.encrypted === true),
    [options],
  );
  const vals = useMemo(() => values ?? [], [values]);
  const existingRows = useMemo(() => existing ?? [], [existing]);

  // (auth_id, item_id) -> the in-flight value (id=null means freshly typed).
  const valueByPair = useMemo(() => {
    const map = new Map<string, AuthItemKeyValue>();
    for (const v of vals) map.set(pairKey(v.auth_id, v.item_id), v);
    return map;
  }, [vals]);

  // (auth_id, item_id) -> saved row from the server.
  const existingByPair = useMemo(() => {
    const map = new Map<string, AuthItemKeyExisting>();
    for (const e of existingRows) {
      if (e.auth_id && e.item_id) map.set(pairKey(e.auth_id, e.item_id), e);
    }
    return map;
  }, [existingRows]);

  const pendingPairs = useMemo(() => {
    const set = new Set<string>();
    for (const e of existingRows) {
      if (e.pending && e.auth_id && e.item_id) {
        set.add(pairKey(e.auth_id, e.item_id));
      }
    }
    return set;
  }, [existingRows]);
  const showDiff = pendingPairs.size > 0;

  // Group options by auth_id so we render one card per auth, with the items
  // scoped to that auth's catalog (no global dedup — items belong to auths).
  const byAuth = useMemo(() => {
    const groups = new Map<
      string,
      { auth_name: string | null; options: AuthItemKeyOption[] }
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
      const existingValue = valueByPair.get(pk);

      // Empty input → drop the in-flight value entirely. Existing saved
      // rows stay (delete is a separate action).
      if (nextValue === "") {
        if (!existingValue) return;
        onChange(
          vals.filter(
            (v) => !(v.auth_id === authId && v.item_id === itemId && v.id === null),
          ),
        );
        return;
      }

      if (existingValue && existingValue.id === null) {
        // Replace the in-flight plaintext.
        onChange(
          vals.map((v) =>
            v.auth_id === authId && v.item_id === itemId && v.id === null
              ? { ...v, key_value: nextValue }
              : v,
          ),
        );
      } else {
        // New entry. id=null tells the server to encrypt + create.
        onChange([
          ...vals,
          {
            id: null,
            auth_id: authId,
            item_id: itemId,
            key_value: nextValue,
            key_name: null,
          },
        ]);
      }
    },
    [valueByPair, vals, onChange],
  );

  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});

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

  const pendingResourceIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of existingRows) {
      if (e.pending && e.id && e.auth_id && e.item_id) ids.push(e.id);
    }
    return ids;
  }, [existingRows]);

  const handleAccept = useCallback(() => {
    // Pending entries remain; next save confirms them.
    if (onAcceptPending && pendingResourceIds.length > 0) {
      onAcceptPending(pendingResourceIds);
    }
  }, [onAcceptPending, pendingResourceIds]);
  const handleReject = useCallback(() => {
    if (onRejectPending && pendingResourceIds.length > 0) {
      onRejectPending(pendingResourceIds);
      return;
    }
    onChange(
      vals.filter(
        (v) => !(v.id && pendingPairs.has(pairKey(v.auth_id, v.item_id))),
      ),
    );
  }, [onChange, onRejectPending, pendingPairs, pendingResourceIds, vals]);

  if (!show_auth_item_keys) return null;

  const groups = Array.from(byAuth.entries());

  return (
    <div className="space-y-2">
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

      {groups.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No encrypted claim items available.
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
                  const inflight = valueByPair.get(pk);
                  const saved = existingByPair.get(pk);
                  const isPending = pendingPairs.has(pk);
                  const savedId = saved?.id ?? null;
                  const isRevealed = !!(savedId && revealed[savedId]);
                  const isLoadingReveal = !!(savedId && revealing[savedId]);
                  return (
                    <div
                      key={pk}
                      className={cn(
                        "rounded border px-2 py-2 space-y-1",
                        inflight && !isPending && "border-primary bg-primary/5",
                        isPending && "ring-2 ring-success bg-success/10",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`aik-${pk}`} className="text-sm">
                          {opt.item_name ?? itemId}
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Encrypted
                          </span>
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
                      {savedId && saved?.key_id && !inflight ? (
                        // Saved row: masked + reveal button.
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0 text-xs text-muted-foreground font-mono truncate">
                            {isRevealed ? revealed[savedId] : "••••••••••••••••"}
                          </div>
                          {onReveal && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={disabled || isLoadingReveal}
                              onClick={() =>
                                handleReveal(
                                  savedId,
                                  saved.key_id as string,
                                )
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
                      ) : (
                        // No saved row yet (or user is replacing): plain input.
                        <Input
                          id={`aik-${pk}`}
                          type="password"
                          disabled={disabled}
                          value={inflight?.key_value ?? ""}
                          onChange={(e) =>
                            updateValue(authId, itemId, e.target.value)
                          }
                          placeholder={`Value for ${opt.item_name ?? "item"}`}
                          className="h-8"
                          autoComplete="new-password"
                        />
                      )}
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
