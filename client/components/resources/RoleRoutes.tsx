/**
 * RoleRoutes.tsx
 * Resource component for per-role route configuration
 * Uses base routes list and creates role_routes_resource entries
 * Pattern follows ScenarioFlags.tsx
 */

"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface RoleRoutesProps {
  role_route_ids?: string[];
  role_route_resources?: Array<{
    id: string | null;
    role_id: string | null;
    route_id: string | null;
    generated?: boolean | null;
  }>;
  show_role_routes?: boolean;
  role_routes?: Array<{
    id: string | null;
    role_id: string | null;
    route_id: string | null;
    generated?: boolean | null;
  }>;
  role_ids?: string[];
  role_resources?: Array<{
    role_id: string | null;
    role: string | null;
    name: string | null;
    description?: string | null;
    icon_value?: string | null;
    color_hex?: string | null;
    generated?: boolean | null;
  }>;
  routes?: Array<{
    route_id: string | null;
    route: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  link_tool_id?: string | null; // Tool ID for AI link suggestions
}

export function RoleRoutes({
  role_route_ids: _role_route_ids,
  role_route_resources,
  show_role_routes = false,
  role_routes: _role_routes,
  role_ids = [],
  role_resources,
  routes,
  disabled = false,
  onChange,
  label = "Role Routes",
  id = "role_routes",
  required = false,
  description,
  group_id,
  link_tool_id,
}: RoleRoutesProps) {
  const show = show_role_routes ?? false;
  const currentResources = useMemo(
    () => role_route_resources ?? [],
    [role_route_resources]
  );
  const allRoutes = useMemo(() => routes ?? [], [routes]);

  const roleLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (role_resources ?? []).forEach((role) => {
      if (role.role_id) {
        map.set(role.role_id, role.name ?? role.role ?? "Untitled role");
      }
    });
    return map;
  }, [role_resources]);

  // Map: roleId -> Set of routeIds that are enabled
  const [routesByRole, setRoutesByRole] = useState<
    Map<string, Set<string>>
  >(new Map());
  // Map: "roleId:routeId" -> role_routes_resource id
  const [roleRouteIdMap, setRoleRouteIdMap] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    const nextRoutesByRole = new Map<string, Set<string>>();
    const nextIdMap = new Map<string, string>();

    currentResources.forEach((resource) => {
      if (resource.role_id && resource.route_id) {
        const key = `${resource.role_id}:${resource.route_id}`;
        if (!nextRoutesByRole.has(resource.role_id)) {
          nextRoutesByRole.set(resource.role_id, new Set());
        }
        nextRoutesByRole.get(resource.role_id)!.add(resource.route_id);
        if (resource.id) {
          nextIdMap.set(key, resource.id);
        }
      }
    });

    setRoutesByRole(nextRoutesByRole);
    setRoleRouteIdMap(nextIdMap);
  }, [currentResources]);

  // Sync roleRouteIdMap to parent via onChange (must be in useEffect, not during setState)
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = Array.from(roleRouteIdMap.values());
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onChange(ids);
    }
  }, [roleRouteIdMap, onChange]);

  const handleToggle = useCallback(
    (roleId: string, routeId: string, checked: boolean) => {
      const key = `${roleId}:${routeId}`;

      if (checked) {
        setRoutesByRole((prev) => {
          const next = new Map(prev);
          if (!next.has(roleId)) {
            next.set(roleId, new Set());
          }
          next.get(roleId)!.add(routeId);
          return next;
        });
      } else {
        setRoutesByRole((prev) => {
          const next = new Map(prev);
          if (next.has(roleId)) {
            next.get(roleId)!.delete(routeId);
          }
          return next;
        });
        // Clear the ID - useEffect will sync to parent via onChange
        setRoleRouteIdMap((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [createRoleRoute]
  );

  const routeItems = useMemo(() => {
    return allRoutes
      .filter((r) => r.route_id && r.route)
      .map((r) => ({
        id: r.route_id!,
        name: r.route!,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRoutes]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
        </div>
      )}
      <div className="space-y-2">
        {role_ids.map((roleId) => {
          const labelText = roleLabelMap.get(roleId) ?? roleId.slice(0, 8);
          const enabledRoutes = routesByRole.get(roleId) ?? new Set();
          return (
            <div
              key={roleId}
              className="space-y-2 rounded-lg border p-2"
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {routeItems.map((route) => {
                  const isEnabled = enabledRoutes.has(route.id);
                  return (
                    <div
                      key={route.id}
                      className={cn(
                        "flex items-start justify-between gap-2 rounded-md border px-2 py-1.5",
                        isEnabled && "border-primary/50 bg-accent/40"
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium">{route.name}</div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => {
                          handleToggle(roleId, route.id, checked);
                        }}
                        disabled={disabled}
                        className="shrink-0"
                      />
                    </div>
                  );
                })}
                {routeItems.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground">
                    No routes available.
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {role_ids.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No roles selected. Select roles first to configure routes.
          </div>
        )}
      </div>
    </div>
  );
}
