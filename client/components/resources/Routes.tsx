/**
 * Routes.tsx
 * Resource component for routes selection
 * Uses GenericPicker to select allowed routes for a profile
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
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
  // AI diff view props
  aiRouteResources?: Array<{
    route_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  // AI diff view props
  aiRouteResources,
  onAccept,
  onReject,
}: RoutesProps) {
  const ids = useMemo(() => route_ids ?? [], [route_ids]);
  const show = show_routes ?? false;
  const allRoutes = useMemo(() => routes ?? [], [routes]);
  const suggestionsList = useMemo(
    () => route_suggestions ?? [],
    [route_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiRouteResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiRouteResources
          ?.map((r) => r.route_id)
          .filter(Boolean) as string[]
      ),
    [aiRouteResources]
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

  // Accept AI suggestion - add AI-suggested routes to selection
  const handleAccept = useCallback(() => {
    if (!aiRouteResources?.length) return;
    const newIds = aiRouteResources
      .map((r) => r.route_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiRouteResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
      )}
      <SelectableGrid
        horizontal
        items={filteredRoutes}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleToggleRoute}
        getId={(route) => route.id}
        renderItem={(route, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(route.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-2 rounded-xl border bg-card text-card-foreground px-4 py-3 shadow-sm transition-all",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}
              <span className="text-sm font-medium leading-snug">
                {route.name}
              </span>
              {isSuggested(route.id) && !isAiSuggested && (
                <span className="text-xs text-muted-foreground">Suggested</span>
              )}
            </div>
          );
        }}
        emptyMessage={
          searchTerm ? "No routes match your search." : placeholder
        }
        disabled={disabled}
      />
    </div>
  );
}
