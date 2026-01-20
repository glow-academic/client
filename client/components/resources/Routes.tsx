/**
 * Routes.tsx
 * Resource component for routes selection
 * Uses GenericPicker to select allowed routes for a profile
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCallback, useMemo } from "react";

export interface RoutesProps {
  route_ids?: string[];
  route_resources?: Array<{
    route_id: string | null;
    route: string | null;
    generated?: boolean | null;
  }>;
  show_routes?: boolean;
  route_suggestions?: string[];
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
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
}

export function Routes({
  route_ids,
  route_resources,
  show_routes = false,
  route_suggestions,
  routes,
  disabled = false,
  onChange,
  label = "Routes",
  id = "routes",
  required = false,
  placeholder = "Select routes...",
  description,
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search routes...",
}: RoutesProps) {
  const ids = useMemo(() => route_ids ?? [], [route_ids]);
  const show = show_routes ?? false;
  const allRoutes = useMemo(() => routes ?? [], [routes]);
  const suggestionsList = useMemo(
    () => route_suggestions ?? [],
    [route_suggestions]
  );

  const routesItems = useMemo(() => {
    return allRoutes
      .filter((r) => r.route_id && r.route)
      .map((r) => ({
        id: r.route_id!,
        name: r.route!,
        description: "",
      }));
  }, [allRoutes]);

  const isSuggested = useCallback(
    (routeId: string) => suggestionsList.includes(routeId),
    [suggestionsList]
  );

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
      <GenericPicker
        items={routesItems}
        selectedIds={ids}
        onSelect={onChange}
        getId={(route) => route.id}
        getLabel={(route) => route.name}
        getSearchText={(route) => route.name}
        initialSearchTerm={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        renderItem={(route, isSelected) => (
          <div
            className={cn(
              "flex flex-col gap-1 rounded-md border px-3 py-2 text-sm",
              isSelected && "bg-accent border-primary/40"
            )}
          >
            <span className="font-medium">{route.name}</span>
            {isSuggested(route.id) && (
              <span className="text-xs text-muted-foreground">Suggested</span>
            )}
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
