/**
 * Logins.tsx — canonical logins picker.
 *
 * Shows every existing logins_resource row as a selectable card (toggle
 * to include it on this setting) plus a collapsible `+ New login` form
 * that appends a draft to the value-array. Matches StandardGroups' shape:
 *   - `logins`: full catalog
 *   - `logins_ids`: currently-attached ids
 *   - `onChange(ids)`: parent updates logins_ids
 *   - `onCreate(draft)`: parent appends {id: null, ...} to the value-array
 */
"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SvgIcon } from "@/components/common/SvgIcon";
import { cn } from "@/lib/utils";
import { Check, LogIn, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface LoginResource {
  logins_id?: string | null;
  auth_id?: string | null;
  profile_id?: string | null;
  icon_id?: string | null;
  icon?: string | null;
  display_name?: string | null;
  login_type?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface LoginAuth {
  auth_id?: string | null;
  name?: string | null;
}

export interface LoginProfile {
  profile_id?: string | null;
  name?: string | null;
}

export interface LoginIcon {
  icon_id?: string | null;
  name?: string | null;
  value?: string | null;
}

export interface LoginDraft {
  login_type: "auth" | "profile";
  auth_id: string | null;
  profile_id: string | null;
  display_name: string;
  icon_id: string | null;
}

export interface LoginsProps {
  logins_ids?: string[];
  logins?: LoginResource[];
  auths?: LoginAuth[];
  profiles?: LoginProfile[];
  icons?: LoginIcon[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  onCreate?: (draft: LoginDraft) => void;
  label?: string;
  description?: string;
  show_logins?: boolean;
}

type GridItem = {
  id: string;
  display_name: string;
  login_type: string;
  subtitle: string | null;
  icon: string | null;
  generated: boolean;
  suggested: boolean;
  pending: boolean;
};

export function Logins({
  logins_ids,
  logins,
  auths,
  profiles,
  icons,
  disabled = false,
  onChange,
  onCreate,
  label = "Logins",
  description = "Select which login buttons appear on the sign-in page.",
  show_logins = true,
}: LoginsProps) {
  const ids = useMemo(() => logins_ids ?? [], [logins_ids]);
  const catalog = useMemo(() => logins ?? [], [logins]);
  const authsList = useMemo(() => auths ?? [], [auths]);
  const profilesList = useMemo(() => profiles ?? [], [profiles]);

  // Inline-create form state (mirrors StandardGroups' draftName/...).
  const [createOpen, setCreateOpen] = useState(false);
  const [draftType, setDraftType] = useState<"auth" | "profile">("auth");
  const [draftAuthId, setDraftAuthId] = useState<string>("");
  const [draftProfileId, setDraftProfileId] = useState<string>("");
  const [draftName, setDraftName] = useState<string>("");
  const [draftIconId, setDraftIconId] = useState<string>("");

  const iconsList = useMemo(() => icons ?? [], [icons]);

  const resetDraft = useCallback(() => {
    setDraftType("auth");
    setDraftAuthId("");
    setDraftProfileId("");
    setDraftName("");
    setDraftIconId("");
  }, []);

  const authLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of authsList) {
      if (a.auth_id && a.name) map.set(a.auth_id, a.name);
    }
    return map;
  }, [authsList]);
  const profileLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profilesList) {
      if (p.profile_id && p.name) map.set(p.profile_id, p.name);
    }
    return map;
  }, [profilesList]);

  const gridItems = useMemo<GridItem[]>(
    () =>
      catalog
        .filter((l) => l.logins_id)
        .map((l) => {
          const loginType = l.login_type ?? "auth";
          const subtitle =
            loginType === "auth"
              ? l.auth_id
                ? authLookup.get(l.auth_id) ?? "Auth"
                : "Auth"
              : l.profile_id
                ? profileLookup.get(l.profile_id) ?? "Profile"
                : "Profile";
          return {
            id: l.logins_id!,
            display_name: l.display_name?.trim() || "Login",
            login_type: loginType,
            subtitle,
            icon: l.icon ?? null,
            generated: l.generated ?? false,
            suggested: l.suggested ?? false,
            pending: l.pending ?? false,
          };
        }),
    [catalog, authLookup, profileLookup]
  );

  const pendingIds = useMemo(
    () => new Set(gridItems.filter((g) => g.pending).map((g) => g.id)),
    [gridItems]
  );
  const showDiff = pendingIds.size > 0;

  const handleToggle = useCallback(
    (id: string) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      onChange(next);
    },
    [ids, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending rows are already in ids; next non-pending save confirms them.
  }, []);
  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, pendingIds, onChange]);

  const canSubmit = useMemo(() => {
    if (draftType === "auth") return !!draftAuthId;
    return !!draftProfileId;
  }, [draftType, draftAuthId, draftProfileId]);

  const handleCreateSubmit = useCallback(() => {
    if (!onCreate || !canSubmit) return;
    const fallbackName =
      draftType === "auth"
        ? authLookup.get(draftAuthId) ?? ""
        : profileLookup.get(draftProfileId) ?? "";
    onCreate({
      login_type: draftType,
      auth_id: draftType === "auth" ? draftAuthId || null : null,
      profile_id: draftType === "profile" ? draftProfileId || null : null,
      display_name: draftName.trim() || fallbackName,
      icon_id: draftIconId || null,
    });
    resetDraft();
    setCreateOpen(false);
  }, [
    onCreate,
    canSubmit,
    draftType,
    draftAuthId,
    draftProfileId,
    draftName,
    draftIconId,
    authLookup,
    profileLookup,
    resetDraft,
  ]);

  if (!show_logins) return null;

  return (
    <div className="space-y-2">
      {(label || onCreate) && (
        <div className="flex items-center gap-2">
          {label && (
            <Label className="flex items-center gap-1">
              {label}
              {description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {description}
                </span>
              )}
            </Label>
          )}
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
          {onCreate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setCreateOpen((v) => !v)}
              disabled={disabled}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {createOpen ? "Cancel" : "New login"}
            </Button>
          )}
        </div>
      )}

      {onCreate && createOpen && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={draftType}
                onValueChange={(v) => setDraftType(v as "auth" | "profile")}
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auth">Auth (SSO)</SelectItem>
                  <SelectItem value="profile">Profile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draftType === "auth" ? (
              <div className="space-y-1">
                <Label className="text-xs">Auth provider</Label>
                <Select
                  value={draftAuthId}
                  onValueChange={setDraftAuthId}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select auth…" />
                  </SelectTrigger>
                  <SelectContent>
                    {authsList
                      .filter((a) => a.auth_id && a.name)
                      .map((a) => (
                        <SelectItem key={a.auth_id!} value={a.auth_id!}>
                          {a.name!}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Profile</Label>
                <Select
                  value={draftProfileId}
                  onValueChange={setDraftProfileId}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select profile…" />
                  </SelectTrigger>
                  <SelectContent>
                    {profilesList
                      .filter((p) => p.profile_id && p.name)
                      .map((p) => (
                        <SelectItem key={p.profile_id!} value={p.profile_id!}>
                          {p.name!}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Display name</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Continue with Google (defaults to provider name)"
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Icon</Label>
              <Select
                value={draftIconId || "__none__"}
                onValueChange={(v) => setDraftIconId(v === "__none__" ? "" : v)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue>
                    {draftIconId ? (
                      (() => {
                        const picked = iconsList.find(
                          (i) => i.icon_id === draftIconId
                        );
                        return (
                          <span className="flex items-center gap-2">
                            {picked?.value && (
                              <SvgIcon
                                svg={picked.value}
                                className="h-3.5 w-3.5"
                                fallback={<LogIn className="h-3.5 w-3.5" />}
                              />
                            )}
                            <span className="truncate">{picked?.name ?? ""}</span>
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground">No icon</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">No icon</span>
                  </SelectItem>
                  {iconsList
                    .filter((i) => i.icon_id && i.name)
                    .map((i) => (
                      <SelectItem key={i.icon_id!} value={i.icon_id!}>
                        <span className="flex items-center gap-2">
                          {i.value && (
                            <SvgIcon
                              svg={i.value}
                              className="h-3.5 w-3.5"
                              fallback={<LogIn className="h-3.5 w-3.5" />}
                            />
                          )}
                          {i.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetDraft();
                setCreateOpen(false);
              }}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={disabled || !canSubmit}
            >
              Add login
            </Button>
          </div>
        </div>
      )}

      <SelectableGrid<GridItem>
        horizontal
        items={gridItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleToggle}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);
          return (
            <div
              className={cn(
                "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10"
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
              {!isSelected && !isPending && item.suggested && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex items-center gap-2">
                {item.icon ? (
                  <SvgIcon
                    svg={item.icon}
                    className="h-4 w-4 text-muted-foreground shrink-0"
                    fallback={
                      <LogIn className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  />
                ) : (
                  <LogIn className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {item.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.login_type === "auth" ? "Auth" : "Profile"}
                    {item.subtitle ? ` · ${item.subtitle}` : ""}
                  </div>
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage="No logins yet. Use + New login to add one."
        disabled={disabled}
      />
    </div>
  );
}
