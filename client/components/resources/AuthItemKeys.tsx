"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AuthOption = {
  auth_id?: string | null;
  name?: string | null;
  description?: string | null;
};

type KeyOption = {
  key_id?: string | null;
  name?: string | null;
  description?: string | null;
  masked_key?: string | null;
};

type AuthItemKeyResource = {
  id?: string | null;
  auth_id?: string | null;
  item_id?: string | null;
  key_id?: string | null;
  auth_name?: string | null;
  key_name?: string | null;
  key_description?: string | null;
  generated?: boolean | null;
};

export interface AuthItemKeysProps {
  auth_item_key_ids?: string[];
  auth_item_key_resources?: AuthItemKeyResource[];
  auths?: AuthOption[];
  keys?: KeyOption[];
  selected_auth_ids?: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  description?: string;
  show_auth_item_keys?: boolean;
  getAuthItemKeysAction?:
    | ((ids: string[]) => Promise<AuthItemKeyResource[]>)
    | undefined;
  createAuthItemKeysAction?:
    | ((input: {
        auth_id: string;
        key_id: string;
      }) => Promise<{ auth_item_keys_id?: string | null }>)
    | undefined;
}

export function AuthItemKeys({
  auth_item_key_ids,
  auth_item_key_resources,
  auths,
  keys,
  selected_auth_ids,
  disabled = false,
  onChange,
  label = "Auth Item Keys",
  description = "Select which keys are available for each auth.",
  show_auth_item_keys = true,
  getAuthItemKeysAction,
  createAuthItemKeysAction,
}: AuthItemKeysProps) {
  const selectedIds = useMemo(() => auth_item_key_ids ?? [], [auth_item_key_ids]);
  const [resourcesById, setResourcesById] = useState<Map<string, AuthItemKeyResource>>(
    new Map()
  );
  const creatingRef = useRef<Set<string>>(new Set());

  const authItems = useMemo(
    () =>
      (auths ?? [])
        .filter((a): a is Required<Pick<AuthOption, "auth_id" | "name">> & AuthOption => !!a.auth_id && !!a.name)
        .filter((a) =>
          selected_auth_ids && selected_auth_ids.length > 0
            ? selected_auth_ids.includes(a.auth_id)
            : true
        ),
    [auths, selected_auth_ids]
  );

  const keyItems = useMemo(
    () =>
      (keys ?? []).filter(
        (k): k is Required<Pick<KeyOption, "key_id" | "name">> & KeyOption =>
          !!k.key_id && !!k.name
      ),
    [keys]
  );

  useEffect(() => {
    if (!auth_item_key_resources || auth_item_key_resources.length === 0) return;
    setResourcesById((prev) => {
      const next = new Map(prev);
      auth_item_key_resources.forEach((r) => {
        if (r.id) next.set(r.id, r);
      });
      return next;
    });
  }, [auth_item_key_resources]);

  useEffect(() => {
    const missing = selectedIds.filter((id) => !resourcesById.has(id));
    if (missing.length === 0 || !getAuthItemKeysAction) return;
    let cancelled = false;
    void getAuthItemKeysAction(missing).then((items) => {
      if (cancelled) return;
      setResourcesById((prev) => {
        const next = new Map(prev);
        items.forEach((r) => {
          if (r.id) next.set(r.id, r);
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIds, resourcesById, getAuthItemKeysAction]);

  const pairToId = useMemo(() => {
    const map = new Map<string, string>();
    resourcesById.forEach((r, id) => {
      if (r.auth_id && r.key_id) map.set(`${r.auth_id}:${r.key_id}`, id);
    });
    return map;
  }, [resourcesById]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const emit = useCallback(
    (nextIds: string[]) => {
      onChange(Array.from(new Set(nextIds)));
    },
    [onChange]
  );

  const togglePair = useCallback(
    async (authId: string, keyId: string, checked: boolean) => {
      const pairKey = `${authId}:${keyId}`;
      const existingId = pairToId.get(pairKey);

      if (!checked) {
        if (!existingId) return;
        emit(selectedIds.filter((id) => id !== existingId));
        return;
      }

      if (existingId) {
        if (!selectedSet.has(existingId)) emit([...selectedIds, existingId]);
        return;
      }

      if (!createAuthItemKeysAction || creatingRef.current.has(pairKey)) return;
      creatingRef.current.add(pairKey);
      try {
        const result = await createAuthItemKeysAction({ auth_id: authId, key_id: keyId });
        const createdId = result.auth_item_keys_id ?? null;
        if (!createdId) return;
        setResourcesById((prev) => {
          const next = new Map(prev);
          const authName = authItems.find((a) => a.auth_id === authId)?.name ?? null;
          const keyName = keyItems.find((k) => k.key_id === keyId)?.name ?? null;
          const keyDescription =
            keyItems.find((k) => k.key_id === keyId)?.description ?? null;
          next.set(createdId, {
            id: createdId,
            auth_id: authId,
            key_id: keyId,
            auth_name: authName,
            key_name: keyName,
            key_description: keyDescription,
          });
          return next;
        });
        emit([...selectedIds, createdId]);
      } finally {
        creatingRef.current.delete(pairKey);
      }
    },
    [
      pairToId,
      emit,
      selectedIds,
      selectedSet,
      createAuthItemKeysAction,
      authItems,
      keyItems,
    ]
  );

  if (!show_auth_item_keys) return null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      {authItems.length === 0 || keyItems.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          Select auths and keys to configure auth-key pairs.
        </div>
      ) : (
        <div className="space-y-3">
          {authItems.map((auth) => {
            const authId = auth.auth_id!;
            return (
              <div key={authId} className="rounded-md border p-3 space-y-2 bg-card">
                <div className="font-medium text-sm">{auth.name}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {keyItems.map((key) => {
                    const keyId = key.key_id!;
                    const pairId = pairToId.get(`${authId}:${keyId}`);
                    const checked = pairId ? selectedSet.has(pairId) : false;
                    return (
                      <div
                        key={`${authId}:${keyId}`}
                        className={cn(
                          "flex items-center justify-between rounded border px-2 py-1.5",
                          checked && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm">{key.name}</div>
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
                            void togglePair(authId, keyId, value)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedIds.map((id) => {
            const r = resourcesById.get(id);
            const text =
              r?.auth_name && r?.key_name ? `${r.auth_name}: ${r.key_name}` : id;
            return (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => emit(selectedIds.filter((x) => x !== id))}
              >
                {text}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
