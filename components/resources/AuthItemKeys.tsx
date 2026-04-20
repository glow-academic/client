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

export interface AuthItemKeysResourceItem {
  id?: string | null;
  auth_id?: string | null;
  key_id?: string | null;
  auth_name?: string | null;
  key_name?: string | null;
  key_description?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

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

export interface AuthItemKeysProps {
  auth_item_key_ids?: string[];
  auth_item_key_resources?: AuthItemKeysResourceItem[];
  auths?: AuthOption[];
  keys?: KeyOption[];
  selected_auth_ids?: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  description?: string;
  show_auth_item_keys?: boolean;
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
}: AuthItemKeysProps) {
  const selectedIds = useMemo(() => auth_item_key_ids ?? [], [auth_item_key_ids]);

  const resourcesById = useMemo(() => {
    const map = new Map<string, AuthItemKeysResourceItem>();
    (auth_item_key_resources ?? []).forEach((r) => {
      if (r.id) map.set(r.id, r);
    });
    return map;
  }, [auth_item_key_resources]);

  const authItems = useMemo(
    () =>
      (auths ?? [])
        .filter((a): a is Required<Pick<AuthOption, "auth_id" | "name">> & AuthOption => !!a.auth_id && !!a.name)
        .filter((a) =>
          selected_auth_ids && selected_auth_ids.length > 0
            ? selected_auth_ids.includes(a.auth_id!)
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

  const pairToId = useMemo(() => {
    const map = new Map<string, string>();
    resourcesById.forEach((r, id) => {
      if (r.auth_id && r.key_id) map.set(`${r.auth_id}:${r.key_id}`, id);
    });
    return map;
  }, [resourcesById]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pendingIds = useMemo(
    () =>
      new Set(
        (auth_item_key_resources ?? [])
          .filter((item) => item.pending && item.id)
          .map((item) => item.id as string)
      ),
    [auth_item_key_resources]
  );
  const showDiff = pendingIds.size > 0;

  const emit = useCallback(
    (nextIds: string[]) => {
      onChange(Array.from(new Set(nextIds)));
    },
    [onChange]
  );

  const togglePair = useCallback(
    (authId: string, keyId: string, checked: boolean) => {
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

      // No existing resource for this pair — nothing to select yet.
      // The parent artifact will handle creation via draft patches.
    },
    [pairToId, emit, selectedIds, selectedSet]
  );

  const handleAccept = useCallback(() => {
    // Pending pairs remain selected; the next non-pending draft save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    emit(selectedIds.filter((id) => !pendingIds.has(id)));
  }, [emit, pendingIds, selectedIds]);

  if (!show_auth_item_keys) return null;

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
                    const isPending = pairId ? pendingIds.has(pairId) : false;
                    return (
                      <div
                        key={`${authId}:${keyId}`}
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
                            togglePair(authId, keyId, value)
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
