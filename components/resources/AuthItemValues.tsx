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

export interface AuthItemValuesResourceItem {
  id?: string | null;
  auth_id?: string | null;
  item_id?: string | null;
  value?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

type AuthOption = {
  auth_id?: string | null;
  name?: string | null;
};

type ItemOption = {
  item_id?: string | null;
  name?: string | null;
  description?: string | null;
  encrypted?: boolean | null;
  position?: number | null;
};

export interface AuthItemValuesProps {
  auth_item_value_ids?: string[];
  auth_item_values?: AuthItemValuesResourceItem[];
  auths?: AuthOption[];
  items?: ItemOption[];
  selected_auth_ids?: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  description?: string;
  show_auth_item_values?: boolean;
}

export function AuthItemValues({
  auth_item_value_ids,
  auth_item_values,
  auths,
  items,
  selected_auth_ids,
  disabled = false,
  onChange,
  label = "Auth Item Values",
  description = "Select which literal claim values apply to each auth.",
  show_auth_item_values = true,
}: AuthItemValuesProps) {
  const selectedIds = useMemo(() => auth_item_value_ids ?? [], [auth_item_value_ids]);
  const rows = useMemo(() => auth_item_values ?? [], [auth_item_values]);

  const authLookup = useMemo(() => {
    const map = new Map<string, string>();
    (auths ?? []).forEach((a) => {
      if (a.auth_id && a.name) map.set(a.auth_id, a.name);
    });
    return map;
  }, [auths]);

  const itemLookup = useMemo(() => {
    const map = new Map<string, ItemOption>();
    (items ?? []).forEach((i) => {
      if (i.item_id) map.set(i.item_id, i);
    });
    return map;
  }, [items]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const pendingIds = useMemo(
    () =>
      new Set(
        rows.filter((r) => r.pending && r.id).map((r) => r.id as string)
      ),
    [rows]
  );
  const showDiff = pendingIds.size > 0;

  const rowsByAuth = useMemo(() => {
    const groups = new Map<string, AuthItemValuesResourceItem[]>();
    rows.forEach((r) => {
      if (!r.id || !r.auth_id) return;
      if (selected_auth_ids && selected_auth_ids.length > 0 && !selected_auth_ids.includes(r.auth_id)) return;
      const list = groups.get(r.auth_id) ?? [];
      list.push(r);
      groups.set(r.auth_id, list);
    });
    return groups;
  }, [rows, selected_auth_ids]);

  const emit = useCallback(
    (nextIds: string[]) => onChange(Array.from(new Set(nextIds))),
    [onChange]
  );

  const toggle = useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        if (!selectedSet.has(id)) emit([...selectedIds, id]);
      } else {
        emit(selectedIds.filter((x) => x !== id));
      }
    },
    [emit, selectedIds, selectedSet]
  );

  const handleAccept = useCallback(() => {
    // Pending values stay selected; next non-pending save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    emit(selectedIds.filter((id) => !pendingIds.has(id)));
  }, [emit, pendingIds, selectedIds]);

  if (!show_auth_item_values) return null;

  const groups = Array.from(rowsByAuth.entries());

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
          No auth item values configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([authId, authRows]) => (
            <div key={authId} className="rounded-md border p-3 space-y-2 bg-card">
              <div className="font-medium text-sm">
                {authLookup.get(authId) ?? "Unknown auth"}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {authRows.map((row) => {
                  const rowId = row.id!;
                  const item = row.item_id ? itemLookup.get(row.item_id) : null;
                  const checked = selectedSet.has(rowId);
                  const isPending = pendingIds.has(rowId);
                  return (
                    <div
                      key={rowId}
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
                        <div className="truncate text-sm">{item?.name ?? row.item_id}</div>
                        {row.value && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item?.encrypted ? "••••••" : row.value}
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) => toggle(rowId, value)}
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
