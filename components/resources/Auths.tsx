/**
 * Auths.tsx
 * Resource component for auth provider selection. Supports both single-select
 * (`auth_id` + `onChange`) and multi-select (`auth_ids` + `onIdsChange`)
 * modes — caller picks one. Mirrors Providers.tsx / Models.tsx shape:
 * SelectableGrid card layout with search, suggested dot, pending badge,
 * accept/reject affordances.
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
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

export interface AuthsResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  slug?: string | null;
  protocol?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

export interface AuthsProps {
  /** Single-select mode. Omit when using multi-select (`auth_ids`). */
  auth_id?: string | null;
  /** Multi-select mode. When provided, the picker toggles membership. */
  auth_ids?: string[];
  auth_resource?: AuthsResourceItem | null;
  show_auths?: boolean;
  auths?: AuthsResourceItem[];
  disabled?: boolean;
  /** Required in single-select mode. */
  onChange?: (authId: string | null) => void;
  /** Required in multi-select mode. */
  onIdsChange?: (authIds: string[]) => void;
  label?: string;
  required?: boolean;
  id?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Auths({
  auth_id,
  auth_ids,
  auth_resource: _auth_resource,
  show_auths = true,
  auths,
  disabled = false,
  onChange,
  onIdsChange,
  label = "Auths",
  required = false,
  id = "auths",
  helpText,
  searchTerm = "",
  onSearchChange: _onSearchChange,
}: AuthsProps) {
  const isMulti = auth_ids !== undefined;
  const show = show_auths ?? true;
  const resourceId = auth_id ?? null;
  const selectedSet = useMemo(() => new Set(auth_ids ?? []), [auth_ids]);
  const allAuths = useMemo(() => auths ?? [], [auths]);

  const pendingItems = useMemo(
    () => allAuths.filter((a) => a.pending && a.id),
    [allAuths],
  );
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((a) => a.id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const authItems = useMemo(() => {
    if (allAuths.length === 0) return [];
    return allAuths
      .filter((a) => a.id && a.name)
      .map((a) => ({
        id: a.id!,
        name: a.name!,
        description: a.description ?? null,
        slug: a.slug ?? null,
        protocol: a.protocol ?? null,
      }));
  }, [allAuths]);

  const filteredAuths = useMemo(() => {
    if (!searchTerm.trim()) return authItems;
    const q = searchTerm.toLowerCase();
    return authItems.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.slug && a.slug.toLowerCase().includes(q)),
    );
  }, [authItems, searchTerm]);

  const isSuggested = useCallback(
    (authId: string) => {
      const a = allAuths.find((x) => x.id === authId);
      return a?.suggested === true;
    },
    [allAuths],
  );

  const handleSelect = useCallback(
    (authId: string) => {
      if (isMulti) {
        const current = auth_ids ?? [];
        const next = current.includes(authId)
          ? current.filter((x) => x !== authId)
          : [...current, authId];
        onIdsChange?.(next);
        return;
      }
      if (authId === resourceId) onChange?.(null);
      else onChange?.(authId);
    },
    [isMulti, auth_ids, resourceId, onChange, onIdsChange],
  );

  const handleAccept = useCallback(() => {
    // Pending items already in selection — next save persists them.
  }, []);

  const handleReject = useCallback(() => {
    if (isMulti) {
      const current = auth_ids ?? [];
      const next = current.filter((x) => !pendingIds.has(x));
      if (next.length !== current.length) onIdsChange?.(next);
      return;
    }
    if (resourceId && pendingIds.has(resourceId)) onChange?.(null);
  }, [isMulti, auth_ids, resourceId, pendingIds, onChange, onIdsChange]);

  if (!show) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
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

      <SelectableGrid<(typeof authItems)[0]>
        horizontal
        items={filteredAuths}
        selectedId={isMulti ? null : (resourceId || null)}
        {...(isMulti ? { selectedIds: Array.from(selectedSet) } : {})}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(auth, isSelected) => {
          const isPending = pendingIds.has(auth.id);
          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
              {isSuggested(auth.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm leading-tight">
                    {auth.name || "Unnamed Auth"}
                  </h3>
                  {auth.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {auth.description}
                    </p>
                  )}
                  {auth.slug && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {auth.slug}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage="No auths found. Try adjusting your search."
        disabled={disabled}
      />
      {helpText && <p className="text-sm text-muted-foreground">{helpText}</p>}
    </div>
  );
}
