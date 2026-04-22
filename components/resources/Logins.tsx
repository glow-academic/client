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

export interface LoginsResourceItem {
  logins_id?: string | null;
  profile_id?: string | null;
  auth_id?: string | null;
  icon_id?: string | null;
  icon?: string | null;
  display_name?: string | null;
  login_type?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

type ProfileOption = {
  profile_id?: string | null;
  name?: string | null;
};

type AuthOption = {
  auth_id?: string | null;
  name?: string | null;
  slug?: string | null;
};

type IconOption = {
  icon_id?: string | null;
  name?: string | null;
  value?: string | null;
};

export interface LoginsProps {
  logins_ids?: string[];
  logins?: LoginsResourceItem[];
  profiles?: ProfileOption[];
  auths?: AuthOption[];
  icons?: IconOption[];
  show_logins?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  description?: string;
}

export function Logins({
  logins_ids,
  logins,
  profiles,
  auths,
  icons,
  show_logins = true,
  disabled = false,
  onChange,
  label = "Logins",
  description = "Select which login buttons appear on the sign-in page.",
}: LoginsProps) {
  const ids = useMemo(() => logins_ids ?? [], [logins_ids]);
  const allLogins = useMemo(() => logins ?? [], [logins]);

  const profileLookup = useMemo(() => {
    const map = new Map<string, string>();
    (profiles ?? []).forEach((p) => {
      if (p.profile_id && p.name) map.set(p.profile_id, p.name);
    });
    return map;
  }, [profiles]);

  const authLookup = useMemo(() => {
    const map = new Map<string, string>();
    (auths ?? []).forEach((a) => {
      if (a.auth_id && a.name) map.set(a.auth_id, a.name);
    });
    return map;
  }, [auths]);

  const iconLookup = useMemo(() => {
    const map = new Map<string, IconOption>();
    (icons ?? []).forEach((i) => {
      if (i.icon_id) map.set(i.icon_id, i);
    });
    return map;
  }, [icons]);

  const pendingIds = useMemo(
    () =>
      new Set(
        allLogins
          .filter((item) => item.pending && item.logins_id)
          .map((item) => item.logins_id as string)
      ),
    [allLogins]
  );
  const showDiff = pendingIds.size > 0;

  type GridItem = {
    id: string;
    displayName: string;
    sourceLabel: string;
    icon: IconOption | null;
    loginType: string | null;
    suggested: boolean;
  };

  const items = useMemo<GridItem[]>(
    () =>
      allLogins
        .filter((item) => item.logins_id)
        .map((item) => {
          const icon = item.icon_id ? iconLookup.get(item.icon_id) ?? null : null;
          const source =
            item.login_type === "profile" && item.profile_id
              ? profileLookup.get(item.profile_id) ?? "Unknown profile"
              : item.auth_id
                ? authLookup.get(item.auth_id) ?? "Unknown auth"
                : "—";
          return {
            id: item.logins_id!,
            displayName: item.display_name || source,
            sourceLabel: source,
            icon,
            loginType: item.login_type ?? null,
            suggested: !!item.suggested,
          };
        }),
    [allLogins, authLookup, iconLookup, profileLookup]
  );

  const handleSelect = useCallback(
    (id: string) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      onChange(next);
    },
    [ids, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending logins remain selected; next non-pending save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, pendingIds]);

  if (!show_logins) return null;

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
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No login buttons configured yet.
        </div>
      ) : (
        <SelectableGrid
          items={items}
          selectedId={null}
          selectedIds={ids}
          onSelect={handleSelect}
          getId={(item) => item.id}
          renderItem={(item, isSelected) => (
            <div
              className={cn(
                "rounded-md border p-3 transition-colors",
                isSelected && "border-primary bg-primary/5",
                pendingIds.has(item.id) && "ring-2 ring-success bg-success/10"
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon?.value && (
                  <div
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: item.icon.value }}
                  />
                )}
                <div className="font-medium text-sm truncate">
                  {item.displayName}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.loginType === "profile" ? "Profile" : "Auth"} · {item.sourceLabel}
              </div>
              {item.suggested && (
                <div className="text-[10px] uppercase tracking-wide text-primary mt-2">
                  Suggested
                </div>
              )}
            </div>
          )}
          disabled={disabled}
        />
      )}
    </div>
  );
}
