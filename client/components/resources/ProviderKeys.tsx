"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProviderOption = {
  provider_id?: string | null;
  name?: string | null;
  description?: string | null;
};

type KeyOption = {
  key_id?: string | null;
  name?: string | null;
  description?: string | null;
  masked_key?: string | null;
};

type ProviderKeyResource = {
  id?: string | null;
  provider_id?: string | null;
  key_id?: string | null;
  provider_name?: string | null;
  key_name?: string | null;
  key_description?: string | null;
  generated?: boolean | null;
};

export interface ProviderKeysProps {
  provider_key_ids?: string[];
  provider_key_resources?: ProviderKeyResource[];
  providers?: ProviderOption[];
  keys?: KeyOption[];
  selected_provider_ids?: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  description?: string;
  show_provider_keys?: boolean;
  getProviderKeysAction?:
    | ((ids: string[]) => Promise<ProviderKeyResource[]>)
    | undefined;
  createProviderKeysAction?:
    | ((input: {
        provider_id: string;
        key_id: string;
      }) => Promise<{ provider_keys_id?: string | null }>)
    | undefined;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

export function ProviderKeys({
  provider_key_ids,
  provider_key_resources,
  providers,
  keys,
  selected_provider_ids,
  disabled = false,
  onChange,
  label = "Provider Keys",
  description = "Select which keys are available for each provider.",
  show_provider_keys = true,
  getProviderKeysAction,
  createProviderKeysAction,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
  isGenerating: _isGenerating = false,
  onAccept: _onAccept,
  onReject: _onReject,
}: ProviderKeysProps) {
  const selectedIds = useMemo(() => provider_key_ids ?? [], [provider_key_ids]);
  const [resourcesById, setResourcesById] = useState<Map<string, ProviderKeyResource>>(
    new Map()
  );
  const creatingRef = useRef<Set<string>>(new Set());

  const providerItems = useMemo(
    () =>
      (providers ?? [])
        .filter((p): p is Required<Pick<ProviderOption, "provider_id" | "name">> & ProviderOption => !!p.provider_id && !!p.name)
        .filter((p) =>
          selected_provider_ids && selected_provider_ids.length > 0
            ? selected_provider_ids.includes(p.provider_id)
            : true
        ),
    [providers, selected_provider_ids]
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
    if (!provider_key_resources || provider_key_resources.length === 0) return;
    setResourcesById((prev) => {
      const next = new Map(prev);
      provider_key_resources.forEach((r) => {
        if (r.id) next.set(r.id, r);
      });
      return next;
    });
  }, [provider_key_resources]);

  useEffect(() => {
    const missing = selectedIds.filter((id) => !resourcesById.has(id));
    if (missing.length === 0 || !getProviderKeysAction) return;
    let cancelled = false;
    void getProviderKeysAction(missing).then((items) => {
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
  }, [selectedIds, resourcesById, getProviderKeysAction]);

  const pairToId = useMemo(() => {
    const map = new Map<string, string>();
    resourcesById.forEach((r, id) => {
      if (r.provider_id && r.key_id) {
        map.set(`${r.provider_id}:${r.key_id}`, id);
      }
    });
    return map;
  }, [resourcesById]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const emit = useCallback(
    (nextIds: string[]) => {
      const deduped = Array.from(new Set(nextIds));
      onChange(deduped);
    },
    [onChange]
  );

  const togglePair = useCallback(
    async (providerId: string, keyId: string, checked: boolean) => {
      const pairKey = `${providerId}:${keyId}`;
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

      if (!createProviderKeysAction || creatingRef.current.has(pairKey)) return;
      creatingRef.current.add(pairKey);
      try {
        const result = await createProviderKeysAction({
          provider_id: providerId,
          key_id: keyId,
        });
        const createdId = result.provider_keys_id ?? null;
        if (!createdId) return;
        setResourcesById((prev) => {
          const next = new Map(prev);
          const providerName =
            providerItems.find((p) => p.provider_id === providerId)?.name ?? null;
          const keyName = keyItems.find((k) => k.key_id === keyId)?.name ?? null;
          const keyDescription =
            keyItems.find((k) => k.key_id === keyId)?.description ?? null;
          next.set(createdId, {
            id: createdId,
            provider_id: providerId,
            key_id: keyId,
            provider_name: providerName,
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
      createProviderKeysAction,
      providerItems,
      keyItems,
    ]
  );

  if (!show_provider_keys) return null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      {providerItems.length === 0 || keyItems.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          Select providers and keys to configure provider-key pairs.
        </div>
      ) : (
        <div className="space-y-3">
          {providerItems.map((provider) => {
            const providerId = provider.provider_id!;
            return (
              <div
                key={providerId}
                className="rounded-md border p-3 space-y-2 bg-card"
              >
                <div className="font-medium text-sm">{provider.name}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {keyItems.map((key) => {
                    const keyId = key.key_id!;
                    const pairId = pairToId.get(`${providerId}:${keyId}`);
                    const checked = pairId ? selectedSet.has(pairId) : false;
                    return (
                      <div
                        key={`${providerId}:${keyId}`}
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
                            void togglePair(providerId, keyId, value)
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
              r?.provider_name && r?.key_name
                ? `${r.provider_name}: ${r.key_name}`
                : id;
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
