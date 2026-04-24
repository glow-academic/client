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

export interface LoginOption {
  login_type?: string | null;
  auth_id?: string | null;
  profile_id?: string | null;
  display_name?: string | null;
  icon_id?: string | null;
  icon?: string | null;
}

export interface LoginValue {
  id: string | null;
  login_type: "auth" | "profile";
  auth_id: string | null;
  profile_id: string | null;
  display_name: string | null;
  icon_id: string | null;
}

export interface LoginExisting {
  id?: string | null;
  login_type?: string | null;
  auth_id?: string | null;
  profile_id?: string | null;
  display_name?: string | null;
  icon?: string | null;
  pending?: boolean | null;
}

export interface LoginsProps {
  options?: LoginOption[];
  values?: LoginValue[];
  existing?: LoginExisting[];
  disabled?: boolean;
  onChange: (values: LoginValue[]) => void;
  label?: string;
  description?: string;
  show_logins?: boolean;
}

const optionKey = (
  loginType: string | null | undefined,
  authId: string | null | undefined,
  profileId: string | null | undefined
) => {
  if (loginType === "auth") return `auth:${authId ?? ""}`;
  if (loginType === "profile") return `profile:${profileId ?? ""}`;
  return `${loginType ?? ""}:${authId ?? ""}:${profileId ?? ""}`;
};

export function Logins({
  options,
  values,
  existing,
  disabled = false,
  onChange,
  label = "Logins",
  description = "Select which login buttons appear on the sign-in page.",
  show_logins = true,
}: LoginsProps) {
  const opts = useMemo(() => options ?? [], [options]);
  const vals = useMemo(() => values ?? [], [values]);

  const valueByKey = useMemo(() => {
    const map = new Map<string, LoginValue>();
    for (const v of vals) {
      map.set(optionKey(v.login_type, v.auth_id, v.profile_id), v);
    }
    return map;
  }, [vals]);

  const existingByKey = useMemo(() => {
    const map = new Map<string, LoginExisting>();
    for (const e of existing ?? []) {
      if (!e.login_type) continue;
      map.set(optionKey(e.login_type, e.auth_id, e.profile_id), e);
    }
    return map;
  }, [existing]);

  const pendingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of existing ?? []) {
      if (e.pending && e.login_type) {
        set.add(optionKey(e.login_type, e.auth_id, e.profile_id));
      }
    }
    return set;
  }, [existing]);
  const showDiff = pendingKeys.size > 0;

  type GridItem = {
    key: string;
    option: LoginOption;
    displayName: string;
    icon: string | null;
    loginType: string;
  };

  const items = useMemo<GridItem[]>(
    () =>
      opts
        .filter(
          (o) =>
            (o.login_type === "auth" && o.auth_id) ||
            (o.login_type === "profile" && o.profile_id)
        )
        .map((o) => {
          const key = optionKey(o.login_type, o.auth_id, o.profile_id);
          const existingRow = existingByKey.get(key);
          return {
            key,
            option: o,
            displayName:
              existingRow?.display_name || o.display_name || "Login",
            icon: existingRow?.icon ?? o.icon ?? null,
            loginType: o.login_type ?? "",
          };
        }),
    [opts, existingByKey]
  );

  const toggleOption = useCallback(
    (option: LoginOption) => {
      const key = optionKey(option.login_type, option.auth_id, option.profile_id);
      if (valueByKey.has(key)) {
        onChange(
          vals.filter(
            (v) =>
              optionKey(v.login_type, v.auth_id, v.profile_id) !== key
          )
        );
        return;
      }
      const existingRow = existingByKey.get(key);
      const loginType = option.login_type as "auth" | "profile";
      onChange([
        ...vals,
        {
          id: existingRow?.id ?? null,
          login_type: loginType,
          auth_id: option.auth_id ?? null,
          profile_id: option.profile_id ?? null,
          display_name:
            existingRow?.display_name ?? option.display_name ?? null,
          icon_id: option.icon_id ?? null,
        },
      ]);
    },
    [valueByKey, existingByKey, vals, onChange]
  );

  const selectedIds = useMemo(
    () => items.filter((i) => valueByKey.has(i.key)).map((i) => i.key),
    [items, valueByKey]
  );

  const handleSelect = useCallback(
    (key: string) => {
      const item = items.find((i) => i.key === key);
      if (!item) return;
      toggleOption(item.option);
    },
    [items, toggleOption]
  );

  const handleAccept = useCallback(() => {
    // Pending logins remain selected; next non-pending save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(
      vals.filter(
        (v) =>
          !pendingKeys.has(optionKey(v.login_type, v.auth_id, v.profile_id))
      )
    );
  }, [onChange, pendingKeys, vals]);

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
          No login options available.
        </div>
      ) : (
        <SelectableGrid
          items={items}
          selectedId={null}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          getId={(item) => item.key}
          renderItem={(item, isSelected) => (
            <div
              className={cn(
                "rounded-md border p-3 transition-colors",
                isSelected && "border-primary bg-primary/5",
                pendingKeys.has(item.key) &&
                  "ring-2 ring-success bg-success/10"
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon && (
                  <div
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: item.icon }}
                  />
                )}
                <div className="font-medium text-sm truncate">
                  {item.displayName}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.loginType === "profile" ? "Profile" : "Auth"}
              </div>
            </div>
          )}
          disabled={disabled}
        />
      )}
    </div>
  );
}
