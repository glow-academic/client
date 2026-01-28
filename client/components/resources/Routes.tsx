/**
 * Routes.tsx
 * Resource component for routes selection
 * Uses GenericPicker to select allowed routes for a profile
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
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
  showSelectedFilter?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  searchPlaceholder?: string;
}

export function Routes({
  route_ids,
  route_resources,
  show_routes = false,
  route_suggestions,
  routes,
  showSelectedFilter = false,
  disabled = false,
  onChange,
  label = "Routes",
  id = "routes",
  required = false,
  placeholder = "No routes available.",
  description,
  searchTerm,
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
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRoutes]);

  const isSuggested = useCallback(
    (routeId: string) => suggestionsList.includes(routeId),
    [suggestionsList]
  );

  const filteredRoutes = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    const baseList = showSelectedFilter
      ? routesItems.filter((route) => ids.includes(route.id))
      : routesItems;
    if (!term) {
      return baseList;
    }
    return baseList.filter((route) => route.name.toLowerCase().includes(term));
  }, [routesItems, ids, searchTerm, showSelectedFilter]);

  const handleToggleRoute = useCallback(
    (routeId: string) => {
      if (disabled) return;
      if (ids.includes(routeId)) {
        onChange(ids.filter((id) => id !== routeId));
        return;
      }
      onChange([...ids, routeId]);
    },
    [disabled, ids, onChange]
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
      <SelectableGrid
        horizontal
        items={filteredRoutes}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleToggleRoute}
        getId={(route) => route.id}
        renderItem={(route, isSelected) => (
          <div
            className={cn(
              "relative flex flex-col gap-2 rounded-xl border bg-card text-card-foreground px-4 py-3 shadow-sm transition-all",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
            <span className="text-sm font-medium leading-snug">
              {route.name}
            </span>
            {isSuggested(route.id) && (
              <span className="text-xs text-muted-foreground">Suggested</span>
            )}
          </div>
        )}
        emptyMessage={
          searchTerm ? "No routes match your search." : placeholder
        }
        disabled={disabled}
      />
    </div>
  );
}
