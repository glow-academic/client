/**
 * Providers.tsx
 * Resource component for single-select provider pick.
 * Mirrors Models.tsx / Modalities.tsx shape: SelectableGrid card layout
 * with search, suggested dot, pending badge, accept/reject affordances.
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

export interface ProviderResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

export interface ProvidersProps {
  provider_id?: string | null;
  provider_resource?: ProviderResourceItem | null;
  show_providers?: boolean;
  providers?: ProviderResourceItem[];
  disabled?: boolean;
  onChange: (providerId: string | null) => void;
  label?: string;
  required?: boolean;
  id?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Providers({
  provider_id,
  provider_resource: _provider_resource,
  show_providers = true,
  providers,
  disabled = false,
  onChange,
  label = "Provider",
  required = false,
  id = "provider",
  helpText,
  searchTerm = "",
  onSearchChange: _onSearchChange,
}: ProvidersProps) {
  const show = show_providers ?? true;
  const resourceId = provider_id ?? null;
  const allProviders = useMemo(() => providers ?? [], [providers]);

  // Pending state: items with pending=true from soft draft connections.
  const pendingItems = useMemo(() => {
    return allProviders.filter((p) => p.pending && p.id);
  }, [allProviders]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const providerItems = useMemo(() => {
    if (allProviders.length === 0) return [];
    return allProviders
      .filter((p) => p.id && p.name)
      .map((p) => ({
        id: p.id!,
        name: p.name!,
        description: p.description ?? null,
      }));
  }, [allProviders]);

  const filteredProviders = useMemo(() => {
    if (!searchTerm.trim()) return providerItems;
    const q = searchTerm.toLowerCase();
    return providerItems.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }, [providerItems, searchTerm]);

  const isSuggested = useCallback(
    (providerId: string) => {
      const p = allProviders.find((x) => x.id === providerId);
      return p?.suggested === true;
    },
    [allProviders],
  );

  const handleSelect = useCallback(
    (providerId: string) => {
      // Click-to-toggle: selecting the current card clears selection.
      if (providerId === resourceId) onChange(null);
      else onChange(providerId);
    },
    [resourceId, onChange],
  );

  const handleAccept = useCallback(() => {
    // Pending items are already in selection — next save persists them.
  }, []);

  const handleReject = useCallback(() => {
    if (resourceId && pendingIds.has(resourceId)) onChange(null);
  }, [resourceId, pendingIds, onChange]);

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

      <SelectableGrid<(typeof providerItems)[0]>
        horizontal
        items={filteredProviders}
        selectedId={resourceId || null}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(provider, isSelected) => {
          const isPending = pendingIds.has(provider.id);
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
              {isSuggested(provider.id) && !isSelected && !isPending && (
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
                    {provider.name || "Unnamed Provider"}
                  </h3>
                  {provider.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {provider.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage="No providers found. Try adjusting your search."
        disabled={disabled}
      />
      {helpText && <p className="text-sm text-muted-foreground">{helpText}</p>}
    </div>
  );
}
